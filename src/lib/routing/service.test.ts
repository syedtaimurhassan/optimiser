import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRoutingService, splitBand, splitRoute } from './service.ts'
import { RoutingError, type MatrixBand, type MatrixProvider, type ProviderLimits } from './types.ts'

const points = Array.from({ length: 12 }, (_, i) => ({ lat: 52 + i / 100, lng: 13 + i / 100 }))
const indices = (n: number, from = 0) => Array.from({ length: n }, (_, i) => from + i)

const band = (sources: number[], destinations: number[]): MatrixBand => ({
  points,
  sources,
  destinations,
  objective: 'duration',
})

const LIMITS: ProviderLimits = {
  maxCells: 12,
  maxPoints: 8,
  minRequestGapMs: 0,
}

/**
 * A provider that answers `from*100 + to` for every cell, so a stitched grid
 * can be checked pair by pair rather than merely for its shape. A grid of the
 * right size with the wrong cells is the failure mode that matters.
 */
function fakeProvider(id: string, limits: Partial<ProviderLimits> = {}): MatrixProvider & {
  calls: MatrixBand[]
} {
  const calls: MatrixBand[] = []
  return {
    id,
    label: id,
    attribution: id,
    limits: { ...LIMITS, ...limits },
    calls,
    async table(b) {
      calls.push(b)
      return b.sources.map((s) => b.destinations.map((d) => s * 100 + d))
    },
    async route() {
      return {
        geometry: { type: 'LineString', coordinates: [] },
        distanceMeters: 1,
        durationSeconds: 1,
        legSeconds: [],
        legMeters: [],
      }
    },
  }
}

describe('splitBand', () => {
  test('leaves a band that already fits alone', () => {
    const pieces = splitBand(band(indices(3), indices(4, 4)), LIMITS)
    assert.equal(pieces.length, 1)
  })

  test('splits by rows first, keeping every piece a slice of the answer', () => {
    // 6×4 = 24 cells against a 12-cell budget.
    const pieces = splitBand(band(indices(6), indices(4, 6)), LIMITS)
    assert.equal(pieces.length, 2)
    assert.deepEqual(
      pieces.map((p) => p.destinations),
      [indices(4, 6), indices(4, 6)],
    )
  })

  test('splits columns when a single row is too wide for the point cap', () => {
    const pieces = splitBand(band([0], indices(11, 1)), LIMITS)
    assert.ok(pieces.length > 1)
    for (const piece of pieces) {
      const used = new Set([...piece.sources, ...piece.destinations])
      assert.ok(used.size <= LIMITS.maxPoints, `piece names ${used.size} points`)
      assert.ok(piece.sources.length * piece.destinations.length <= LIMITS.maxCells)
    }
  })

  test('every requested pair appears in exactly one piece', () => {
    const wanted = band(indices(6), indices(6, 6))
    const seen = new Set<string>()
    for (const piece of splitBand(wanted, LIMITS)) {
      for (const s of piece.sources) {
        for (const d of piece.destinations) {
          const key = `${s}->${d}`
          assert.ok(!seen.has(key), `${key} requested twice`)
          seen.add(key)
        }
      }
    }
    assert.equal(seen.size, 36)
  })

  test('an empty band is no requests at all', () => {
    assert.deepEqual(splitBand(band([], indices(3)), LIMITS), [])
  })
})

describe('splitRoute', () => {
  const limits: ProviderLimits = { ...LIMITS, maxPoints: 54 }
  const seq = (n: number) => Array.from({ length: n }, (_, i) => i)

  test('leaves a drawable sequence alone', () => {
    assert.deepEqual(splitRoute(seq(4), limits), [[0, 1, 2, 3]])
  })

  test('overlaps chunks by one point, so no leg goes missing', () => {
    const chunks = splitRoute(seq(10), limits)
    assert.ok(chunks.length > 1)
    for (let i = 1; i < chunks.length; i++) {
      assert.equal(chunks[i][0], chunks[i - 1].at(-1), 'chunks must share their seam point')
    }
    const legs = chunks.reduce((total, chunk) => total + chunk.length - 1, 0)
    assert.equal(legs, 9, 'a 10-point route has 9 legs however it is split')
  })

  test('visits every point, in order, exactly once', () => {
    const chunks = splitRoute(seq(11), limits)
    const flat = chunks.flatMap((chunk, i) => (i === 0 ? chunk : chunk.slice(1)))
    assert.deepEqual(flat, seq(11))
  })
})

describe('createRoutingService', () => {
  test('stitches split pieces back into the grid the caller asked for', async () => {
    const provider = fakeProvider('p')
    const service = createRoutingService({ primary: provider })

    const rows = await service.table(band(indices(6), indices(6, 6)))

    assert.ok(provider.calls.length > 1, 'expected the band to be split')
    assert.equal(rows.length, 6)
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        assert.equal(rows[r][c], r * 100 + (c + 6), `cell ${r},${c}`)
      }
    }
  })

  test('reports progress once per request', async () => {
    const provider = fakeProvider('p')
    const service = createRoutingService({ primary: provider })
    const seen: [number, number][] = []

    await service.table(band(indices(6), indices(6, 6)), (done, total) => seen.push([done, total]))

    assert.equal(seen.length, provider.calls.length)
    assert.deepEqual(seen.at(-1), [provider.calls.length, provider.calls.length])
  })

  test('fails over to the fallback and says it is degraded', async () => {
    const primary = fakeProvider('primary')
    primary.table = async () => {
      throw new RoutingError('rateLimited', 'primary', 'slow down', 429)
    }
    const fallback = fakeProvider('fallback')
    const service = createRoutingService({ primary, fallback, sleep: async () => {} })

    const rows = await service.table(band([0], [1]))

    assert.deepEqual(rows, [[1]])
    assert.equal(fallback.calls.length, 1)
    const status = service.getStatus()
    assert.equal(status.degraded, true)
    assert.equal(status.activeProviderId, 'fallback')
    assert.equal(status.reason, 'rateLimited')
  })

  test('re-splits for the fallback rather than replaying the primary’s plan', async () => {
    const primary = fakeProvider('primary', { maxCells: 100, maxPoints: 12 })
    primary.table = async () => {
      throw new RoutingError('network', 'primary', 'offline')
    }
    // Quarter the budget: the fallback must ask for more, smaller pieces.
    const fallback = fakeProvider('fallback', { maxCells: 4, maxPoints: 12 })
    const service = createRoutingService({ primary, fallback, sleep: async () => {} })

    await service.table(band(indices(4), indices(4, 4)))

    for (const call of fallback.calls) {
      assert.ok(call.sources.length * call.destinations.length <= 4)
    }
    assert.equal(fallback.calls.length, 4)
  })

  test('does not fail over when the request was simply too big', async () => {
    const primary = fakeProvider('primary')
    primary.table = async () => {
      throw new RoutingError('tooBig', 'primary', 'that will never fit')
    }
    const fallback = fakeProvider('fallback')
    const service = createRoutingService({ primary, fallback, sleep: async () => {} })

    await assert.rejects(() => service.table(band([0], [1])), /never fit/)
    assert.equal(fallback.calls.length, 0, 'a smaller provider cannot help with tooBig')
  })

  test('a rate-limited primary is left alone for the cooldown', async () => {
    let clock = 0
    const primary = fakeProvider('primary')
    let primaryCalls = 0
    primary.table = async () => {
      primaryCalls++
      throw new RoutingError('rateLimited', 'primary', 'slow down', 429)
    }
    const fallback = fakeProvider('fallback')
    const service = createRoutingService({
      primary,
      fallback,
      now: () => clock,
      sleep: async () => {},
      cooldownMs: 1000,
    })

    await service.table(band([0], [1]))
    assert.equal(primaryCalls, 1)

    clock = 500
    await service.table(band([0], [2]))
    assert.equal(primaryCalls, 1, 'still inside the cooldown')

    clock = 1500
    await service.table(band([0], [3]))
    assert.equal(primaryCalls, 2, 'cooldown expired, worth another try')
  })

  test('draws a route too long for one request in overlapping pieces', async () => {
    const provider = fakeProvider('p', { maxPoints: 54 })
    // Each chunk answers with its own leg per gap and a coordinate per point.
    provider.route = async (chunk) => ({
      geometry: {
        type: 'LineString',
        coordinates: chunk.map((p) => [p.lng, p.lat]),
      },
      distanceMeters: 100 * (chunk.length - 1),
      durationSeconds: 10 * (chunk.length - 1),
      legSeconds: chunk.slice(1).map(() => 10),
      legMeters: chunk.slice(1).map(() => 100),
    })
    const service = createRoutingService({ primary: provider, sleep: async () => {} })

    const many = Array.from({ length: 12 }, (_, i) => ({ lat: 52 + i / 100, lng: 13 }))
    const road = await service.route(many)

    assert.equal(road.legSeconds.length, 11, 'one leg per gap, across the seams')
    assert.equal(road.legMeters.length, 11)
    assert.equal(road.durationSeconds, 110)
    assert.equal(
      (road.geometry.coordinates as number[][]).length,
      12,
      'the seam point must be drawn once, not twice',
    )
  })

  test('drops the leg list entirely when one piece could not supply one', async () => {
    const provider = fakeProvider('p', { maxPoints: 54 })
    let call = 0
    provider.route = async (chunk) => ({
      geometry: { type: 'LineString', coordinates: chunk.map((p) => [p.lng, p.lat]) },
      distanceMeters: 1,
      durationSeconds: 1,
      // The second piece comes back without legs — a short array would shift
      // every arrival after the seam by one stop.
      legSeconds: call++ === 0 ? chunk.slice(1).map(() => 10) : [],
      legMeters: [],
    })
    const service = createRoutingService({ primary: provider, sleep: async () => {} })

    const many = Array.from({ length: 12 }, (_, i) => ({ lat: 52 + i / 100, lng: 13 }))
    const road = await service.route(many)
    assert.deepEqual(road.legSeconds, [])
  })

  test('paces consecutive requests to one provider', async () => {
    let clock = 0
    const slept: number[] = []
    const provider = fakeProvider('p', { minRequestGapMs: 1100, maxCells: 1, maxPoints: 8 })
    const service = createRoutingService({
      primary: provider,
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms)
        clock += ms
      },
    })

    await service.table(band([0, 1], [2]))

    assert.equal(provider.calls.length, 2)
    assert.deepEqual(slept, [1100], 'one gap between two requests, none before the first')
  })
})
