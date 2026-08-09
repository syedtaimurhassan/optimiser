import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LatLng } from '../../types.ts'
import { haversine } from '../optimize.ts'
import {
  CANDIDATE_K,
  CANDIDATE_PADDING,
  DEFAULT_DETOUR_FACTOR,
  DEFAULT_SECONDS_PER_METRE,
  calibrateRatio,
  candidateNeeds,
  countBits,
  estimateGaps,
  getBit,
  makeBitset,
  setBit,
} from './sparse.ts'

/** A tidy grid: neighbours are unambiguous, so a candidate list can be asserted. */
const grid = (side: number): LatLng[] => {
  const points: LatLng[] = []
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) points.push({ lat: 52 + y * 0.01, lng: 13 + x * 0.01 })
  }
  return points
}

describe('bitset', () => {
  test('round-trips bits and counts them', () => {
    const bits = makeBitset(20)
    assert.equal(bits.length, 3)
    assert.equal(getBit(bits, 7), false)
    setBit(bits, 7)
    setBit(bits, 19)
    assert.equal(getBit(bits, 7), true)
    assert.equal(getBit(bits, 8), false)
    assert.equal(countBits(bits), 2)
  })
})

describe('candidateNeeds', () => {
  test('asks for padding × k neighbours per row', () => {
    const points = grid(8)
    const needs = candidateNeeds(points, { k: 5, padding: 2 })
    // Each row seeded 10 of its own, plus whoever named it in return.
    for (const row of needs) assert.ok(row.length >= 10, `row had ${row.length}`)
  })

  test('is symmetric: knowing i→j is worthless without j→i', () => {
    const needs = candidateNeeds(grid(6), { k: 3, padding: 2 })
    for (const [i, row] of needs.entries()) {
      for (const j of row) {
        assert.ok(needs[j].includes(i), `${i}→${j} wanted but ${j}→${i} not`)
      }
    }
  })

  test('never asks a row for itself', () => {
    const needs = candidateNeeds(grid(5), { k: 4, padding: 2 })
    for (const [i, row] of needs.entries()) assert.ok(!row.includes(i))
  })

  test('picks the nearest, not the first', () => {
    const points: LatLng[] = [
      { lat: 52, lng: 13 },
      { lat: 52.9, lng: 13 }, // far
      { lat: 52.001, lng: 13 }, // near
    ]
    const needs = candidateNeeds(points, { k: 1, padding: 1 })
    assert.ok(needs[0].includes(2))
  })

  test('a mandatory row is fetched whole, both ways', () => {
    const points = grid(4)
    const needs = candidateNeeds(points, { k: 1, padding: 1, mandatory: [0] })
    assert.equal(needs[0].length, points.length - 1)
    for (let j = 1; j < points.length; j++) {
      assert.ok(needs[j].includes(0), `column 0 missing from row ${j}`)
    }
  })

  test('a two-point route wants the one arc there is', () => {
    const needs = candidateNeeds([{ lat: 52, lng: 13 }, { lat: 52.01, lng: 13 }])
    assert.deepEqual(needs, [[1], [0]])
  })
})

describe('calibrateRatio', () => {
  const points = grid(6)
  const n = points.length

  test('falls back to the historical constant without enough evidence', () => {
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    assert.equal(calibrateRatio(matrix, known, points, 'duration'), DEFAULT_SECONDS_PER_METRE)
    assert.equal(calibrateRatio(matrix, known, points, 'distance'), DEFAULT_DETOUR_FACTOR)
  })

  test('reads the ratio the fetched arcs actually exhibit', () => {
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    // Every arc at exactly 0.2 s per straight-line metre.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        matrix[i * n + j] = Math.round(haversine(points[i], points[j]) * 0.2)
        setBit(known, i * n + j)
      }
    }
    assert.ok(Math.abs(calibrateRatio(matrix, known, points, 'duration') - 0.2) < 0.01)
  })

  test('is pessimistic on purpose: the upper quartile, not the median', () => {
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        // Half the arcs are twice as slow as the other half.
        const rate = (i + j) % 2 === 0 ? 0.1 : 0.2
        matrix[i * n + j] = Math.round(haversine(points[i], points[j]) * rate)
        setBit(known, i * n + j)
      }
    }
    const ratio = calibrateRatio(matrix, known, points, 'duration')
    assert.ok(ratio > 0.15, `expected the slow half to dominate, got ${ratio}`)
  })

  test('ignores unroutable cells rather than calling them very slow', () => {
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        matrix[i * n + j] = i === 0 ? 9_999_999 : Math.round(haversine(points[i], points[j]) * 0.15)
        setBit(known, i * n + j)
      }
    }
    assert.ok(Math.abs(calibrateRatio(matrix, known, points, 'duration') - 0.15) < 0.02)
  })
})

describe('estimateGaps', () => {
  const points = grid(4)
  const n = points.length

  test('leaves fetched cells alone and fills the rest', () => {
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    const at = (i: number, j: number) => i * n + j
    matrix[at(0, 1)] = 12_345
    setBit(known, at(0, 1))

    const { estimatedCells } = estimateGaps(matrix, known, points, 'duration')

    assert.equal(matrix[at(0, 1)], 12_345, 'a real cell was overwritten')
    assert.equal(estimatedCells, n * n - n - 1)
    for (let i = 0; i < n; i++) assert.equal(matrix[at(i, i)], 0)
    assert.ok(matrix[at(1, 0)] > 0, 'the reverse arc should have been estimated')
  })

  test('an estimate is never zero for two different places', () => {
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    estimateGaps(matrix, known, points, 'duration')
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) assert.ok(matrix[i * n + j] > 0, `${i}→${j} came out free`)
      }
    }
  })
})

/**
 * The measurement the whole sparse design rests on, run against the real OSRM
 * matrix committed in bench/fixtures/ rather than against a synthetic one.
 *
 * If this ever fails, the padding constant is wrong for real roads and the
 * search is being handed a neighbour list with holes in it.
 */
describe('haversine candidates against a real road matrix', () => {
  const here = import.meta.dirname
  const points = JSON.parse(
    readFileSync(join(here, '../../../samples/bikes_low_battery.json'), 'utf8'),
  ) as LatLng[]
  const fixture = JSON.parse(
    readFileSync(join(here, '../../../bench/fixtures/bikes_low_battery.matrix.json'), 'utf8'),
  ) as { matrix: number[][]; n: number }

  const recallAt = (padding: number): number => {
    const needs = candidateNeeds(points, { k: CANDIDATE_K, padding })
    let hits = 0
    let total = 0
    for (let i = 0; i < fixture.n; i++) {
      const byRoad = [...fixture.matrix[i].keys()]
        .filter((j) => j !== i)
        .sort((a, b) => fixture.matrix[i][a] - fixture.matrix[i][b])
        .slice(0, CANDIDATE_K)
      const asked = new Set(needs[i])
      for (const j of byRoad) if (asked.has(j)) hits++
      total += byRoad.length
    }
    return hits / total
  }

  test('unpadded straight-line neighbours miss a quarter of the real ones', () => {
    const recall = recallAt(1)
    assert.ok(recall < 0.9, `expected the naive list to be visibly lossy, got ${recall}`)
  })

  test('the shipped padding recovers almost all of them', () => {
    const recall = recallAt(CANDIDATE_PADDING)
    assert.ok(recall > 0.93, `recall fell to ${(recall * 100).toFixed(1)}%`)
  })

  test('the 8 m/s constant is optimistic on a real road network', () => {
    const n = fixture.n
    const matrix = new Int32Array(n * n)
    const known = makeBitset(n * n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i * n + j] = fixture.matrix[i][j]
        if (i !== j) setBit(known, i * n + j)
      }
    }
    const ratio = calibrateRatio(matrix, known, points, 'duration')
    assert.ok(
      ratio > DEFAULT_SECONDS_PER_METRE,
      `real roads measured ${ratio.toFixed(4)} s/m against the assumed ${DEFAULT_SECONDS_PER_METRE}`,
    )
  })
})
