import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { LatLng } from '../../types.ts'
import { buildCostGrid, patchTourArcs, tourHasEstimates } from './grid.ts'
import { getBit, makeBitset, setBit } from './sparse.ts'
import { RoutingError, type MatrixBand, type ProviderLimits } from './types.ts'
import type { RoutingService } from './service.ts'

const points = (n: number): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: 52 + Math.floor(i / 12) * 0.01 + (i % 5) * 0.001,
    lng: 13 + (i % 12) * 0.01 + (i % 3) * 0.001,
  }))

const LIMITS: ProviderLimits = { maxCells: 400, maxPoints: 60, minRequestGapMs: 0 }

/** Answers a fixed, recognisable cost and records every pair it was asked for. */
function fakeService(limits = LIMITS): RoutingService & { asked: Set<string>; bands: MatrixBand[] } {
  const asked = new Set<string>()
  const bands: MatrixBand[] = []
  return {
    asked,
    bands,
    limits: () => limits,
    getStatus: () => ({ degraded: false, activeProviderId: 'fake', attribution: 'fake' }),
    async table(band) {
      bands.push(band)
      return band.sources.map((s) =>
        band.destinations.map((d) => {
          asked.add(`${s},${d}`)
          return s === d ? 0 : 1000 + s * 10 + d
        }),
      )
    },
    async route() {
      throw new Error('not used')
    },
  }
}

describe('buildCostGrid', () => {
  test('a cold grid fetches, and every cell it fetched is marked real', async () => {
    const service = fakeService()
    const pts = points(40)
    const grid = await buildCostGrid({ points: pts, objective: 'duration', service })

    assert.ok(grid.requests > 0)
    assert.equal(grid.matrix.length, 40 * 40)
    for (const key of service.asked) {
      const [i, j] = key.split(',').map(Number)
      assert.ok(getBit(grid.known, i * 40 + j), `${key} was fetched but not marked known`)
    }
  })

  test('a small round is one dense request, not a sparse plan', async () => {
    // 15 stops is 225 cells against a 400-cell budget: asking sparsely would be
    // strictly more code for exactly the same one round trip.
    const service = fakeService()
    const grid = await buildCostGrid({ points: points(15), objective: 'duration', service })

    assert.equal(service.bands.length, 1)
    assert.equal(grid.estimatedCells, 0, 'a dense fetch leaves nothing to guess')
  })

  /* The headline claim of the milestone, as a test. */
  test('reopening a route makes zero requests', async () => {
    const service = fakeService()
    const pts = points(40)
    const cold = await buildCostGrid({ points: pts, objective: 'duration', service })

    const warm = await buildCostGrid({
      points: pts,
      objective: 'duration',
      service,
      seed: { costs: cold.matrix, known: cold.known },
    })

    assert.equal(warm.requests, 0)
    assert.deepEqual(Array.from(warm.matrix), Array.from(cold.matrix))
  })

  test('adding one stop fetches that stop’s arcs, not the whole grid', async () => {
    // Real OSRM limits, because this is the milestone's own claim and it should
    // be measured against the provider the app actually uses.
    const osrm: ProviderLimits = { maxCells: 10_000, maxPoints: 450, minRequestGapMs: 0 }
    const service = fakeService(osrm)
    // 120 stops is 14,400 cells: past the budget, so this is the sparse regime
    // where the answer is not "refetch, it is only one request anyway".
    const before = 120
    const pts = points(before)
    const cold = await buildCostGrid({ points: pts, objective: 'duration', service })

    // One more stop: the seed is the old grid padded with an unknown row/column.
    const grown = [...pts, { lat: 52.024, lng: 13.055 }]
    const n = grown.length
    const costs = new Int32Array(n * n)
    const known = makeBitset(n * n)
    for (let i = 0; i < before; i++) {
      for (let j = 0; j < before; j++) {
        costs[i * n + j] = cold.matrix[i * before + j]
        if (getBit(cold.known, i * before + j)) setBit(known, i * n + j)
      }
    }

    const after = fakeService(osrm)
    const grid = await buildCostGrid({
      points: grown,
      objective: 'duration',
      service: after,
      seed: { costs, known },
    })

    // One row and one column, in one request — not an n×n.
    assert.equal(grid.requests, 1, `${grid.requests} requests to add one stop`)
    assert.ok(
      after.asked.size < before * before * 0.1,
      `${after.asked.size} cells fetched to add one stop to ${before}`,
    )
    for (let j = 0; j < before; j++) {
      if (!getBit(grid.known, before * n + j)) continue
      assert.ok(after.asked.has(`${before},${j}`), `new stop → ${j} claimed real but never fetched`)
    }
  })

  test('unfetched cells are filled but stay marked as guesses', async () => {
    const service = fakeService()
    const pts = points(60)
    const grid = await buildCostGrid({ points: pts, objective: 'duration', service })

    assert.ok(grid.estimatedCells > 0, 'a 60-stop round should not be dense at this budget')
    let guesses = 0
    for (let i = 0; i < 60; i++) {
      for (let j = 0; j < 60; j++) {
        if (i === j) continue
        assert.ok(grid.matrix[i * 60 + j] > 0, `${i}→${j} came out free`)
        if (!getBit(grid.known, i * 60 + j)) guesses++
      }
    }
    assert.equal(guesses, grid.estimatedCells)
  })

  /*
    The whole of the app's offline story for planning. Before M12 an
    unreachable matrix service failed the solve outright, so a driver in a dead
    zone who wanted to reorder four stops got an error message and nothing else.
  */
  test('a dead network degrades the grid instead of failing the solve', async () => {
    const service = fakeService()
    service.table = async () => {
      throw new RoutingError('network', 'fake', 'no route to host')
    }

    const grid = await buildCostGrid({ points: points(40), objective: 'duration', service })

    assert.equal(grid.degraded, true)
    assert.equal(grid.requests, 0)
    assert.ok(grid.estimatedCells > 0)
    assert.ok(grid.matrix[1 * 40 + 2] > 0, 'a plannable cost, not a hole')
  })

  test('a cancelled solve is not quietly turned into a worse answer', async () => {
    const service = fakeService()
    service.table = async () => {
      throw new RoutingError('aborted', 'fake', 'Cancelled.')
    }
    await assert.rejects(
      () => buildCostGrid({ points: points(40), objective: 'duration', service }),
      /Cancelled/,
    )
  })

  test('one dead band does not throw away the bands that worked', async () => {
    const service = fakeService()
    const real = service.table.bind(service)
    let call = 0
    service.table = async (band, onProgress) => {
      if (call++ === 0) throw new RoutingError('network', 'fake', 'flaky')
      return real(band, onProgress)
    }

    const grid = await buildCostGrid({ points: points(60), objective: 'duration', service })

    assert.equal(grid.degraded, true)
    assert.ok(grid.fetchedCells > 0, 'the surviving bands should still have been written')
  })

  test('the pinned endpoints are fetched whole', async () => {
    const service = fakeService()
    const pts = points(60)
    const grid = await buildCostGrid({
      points: pts,
      objective: 'duration',
      service,
      mandatory: [0, 59],
    })

    const at = (i: number, j: number) => i * 60 + j
    for (let j = 0; j < 60; j++) {
      if (j !== 0) assert.ok(getBit(grid.known, at(0, j)), `start→${j} was guessed`)
      if (j !== 59) assert.ok(getBit(grid.known, at(j, 59)), `${j}→end was guessed`)
    }
  })
})

const at3 = (i: number, j: number) => i * 3 + j

describe('patchTourArcs', () => {
  const grid = () => ({ matrix: new Int32Array(9), known: makeBitset(9), n: 3 })

  test('writes the road router’s own leg times back into the grid', () => {
    const g = grid()
    const corrected = patchTourArcs(g, [0, 1, 2], [111, 222])

    assert.equal(corrected, 2)
    assert.equal(g.matrix[at3(0, 1)], 111)
    assert.equal(g.matrix[at3(1, 2)], 222)
    assert.ok(getBit(g.known, at3(0, 1)))
  })

  test('counts only the arcs that were guesses', () => {
    const g = grid()
    setBit(g.known, at3(0, 1))
    assert.equal(patchTourArcs(g, [0, 1, 2], [111, 222]), 1)
  })

  test('refuses a leg list that does not match the tour', () => {
    const g = grid()
    assert.equal(patchTourArcs(g, [0, 1, 2], [111]), 0)
    assert.equal(g.matrix[at3(0, 1)], 0, 'a mismatched list must change nothing')
  })
})

describe('tourHasEstimates', () => {
  test('sees a guessed arc in the middle of a real tour', () => {
    const g = { known: makeBitset(9), n: 3 }
    setBit(g.known, at3(0, 1))
    assert.equal(tourHasEstimates(g, [0, 1, 2]), true)
    setBit(g.known, at3(1, 2))
    assert.equal(tourHasEstimates(g, [0, 1, 2]), false)
  })
})
