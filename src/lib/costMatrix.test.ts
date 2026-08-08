import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  END_KEY,
  START_KEY,
  haversineCost,
  matrixCacheKey,
  matrixCost,
  missingKeys,
  toCachedMatrix,
  toCachedMatrixFlat,
  withFallback,
  type MatrixPoint,
} from './costMatrix.ts'

const point = (key: string, lat: number, lng: number): MatrixPoint => ({ key, lat, lng })

/**
 * Three points whose costs are deliberately asymmetric — cell (i,j) is
 * `10*i + j`. A matrix read the wrong way round therefore fails loudly rather
 * than passing on a symmetric fixture that cannot tell the two apart.
 */
const grid = [
  [0, 1, 2],
  [10, 0, 12],
  [20, 21, 0],
]

describe('toCachedMatrix', () => {
  test('flattens row-major and keeps the keys in matrix order', () => {
    const cached = toCachedMatrix(grid, [START_KEY, 'a', END_KEY], 'duration')
    assert.equal(cached.n, 3)
    assert.deepEqual(cached.keys, [START_KEY, 'a', END_KEY])
    assert.deepEqual(cached.costs, [0, 1, 2, 10, 0, 12, 20, 21, 0])
  })

  test('a short row is padded rather than left undefined', () => {
    const cached = toCachedMatrix([[0, 1], [2]], ['a', 'b'], 'distance')
    assert.deepEqual(cached.costs, [0, 1, 2, 0])
  })
})

describe('matrixCost', () => {
  const cost = matrixCost(toCachedMatrix(grid, ['a', 'b', 'c'], 'duration'))

  test('reads by key, not by position', () => {
    assert.equal(cost('b', 'c'), 12)
    assert.equal(cost('c', 'b'), 21)
  })

  test('a pair it has never heard of is null, never zero', () => {
    // Zero would be indistinguishable from "these two are the same place",
    // and a cheapest-insert reading it would put the new stop there every time.
    assert.equal(cost('a', 'zzz'), null)
    assert.equal(cost('zzz', 'a'), null)
  })
})

describe('missingKeys', () => {
  const points = [point('a', 55.6, 12.5), point('b', 55.7, 12.6), point('c', 55.8, 12.7)]

  test('names only the points the cache has never seen', () => {
    const cached = toCachedMatrix([[0, 1], [1, 0]], ['a', 'c'], 'duration')
    assert.deepEqual(missingKeys(cached, points), ['b'])
  })

  test('no cache means every point is missing', () => {
    assert.deepEqual(missingKeys(null, points), ['a', 'b', 'c'])
  })

  test('a stop deleted since the solve is simply absent — never missing', () => {
    const cached = toCachedMatrix(grid, ['a', 'b', 'gone'], 'duration')
    assert.deepEqual(missingKeys(cached, points), ['c'])
  })
})

describe('haversineCost', () => {
  const points = [point('a', 55.6, 12.5), point('b', 55.61, 12.5)]

  test('metres when optimising on distance', () => {
    const cost = haversineCost(points, 'distance')
    // ~1.1 km for a hundredth of a degree of latitude.
    assert.ok(Math.round(cost('a', 'b')!) > 1050 && Math.round(cost('a', 'b')!) < 1150)
  })

  test('the same distance at 8 m/s when optimising on duration', () => {
    const metres = haversineCost(points, 'distance')('a', 'b')!
    assert.equal(haversineCost(points, 'duration')('a', 'b'), metres / 8)
  })
})

describe('withFallback', () => {
  test('falls back per PAIR, not per matrix', () => {
    // The point of the milestone: a route with one newly added stop should use
    // real costs for all 44 existing legs and an estimate for the two new ones,
    // not an estimate for all 46.
    const real = matrixCost(toCachedMatrix(grid, ['a', 'b', 'c'], 'duration'))
    const cost = withFallback(real, () => 999)
    assert.equal(cost('a', 'b'), 1)
    assert.equal(cost('a', 'new'), 999)
  })
})

describe('matrixCacheKey', () => {
  test('is per route AND per objective — the two grids are different numbers', () => {
    assert.notEqual(matrixCacheKey('r1', 'duration'), matrixCacheKey('r1', 'distance'))
    assert.notEqual(matrixCacheKey('r1', 'duration'), matrixCacheKey('r2', 'duration'))
  })
})

describe('toCachedMatrixFlat', () => {
  test('takes the flat grid the compute path produces', () => {
    const flat = Int32Array.from([0, 1, 2, 10, 0, 12, 20, 21, 0])
    const cached = toCachedMatrixFlat(flat, 3, ['a', 'b', 'c'], 'duration')
    assert.deepEqual(cached.costs, [0, 1, 2, 10, 0, 12, 20, 21, 0])
    assert.equal(cached.n, 3)
    assert.deepEqual(cached.keys, ['a', 'b', 'c'])
  })

  test('agrees cell for cell with the jagged builder', () => {
    const flat = Int32Array.from(grid.flat())
    assert.deepEqual(
      toCachedMatrixFlat(flat, 3, ['a', 'b', 'c'], 'duration').costs,
      toCachedMatrix(grid, ['a', 'b', 'c'], 'duration').costs,
    )
  })

  test('refuses a key list that disagrees with the grid rather than padding', () => {
    // A zero-filled row reads as "these two stops are next door", which is the
    // most expensive possible thing to be silently wrong about.
    const flat = new Int32Array(9)
    assert.throws(() => toCachedMatrixFlat(flat, 3, ['a', 'b'], 'duration'), /3 rows but 2 keys/)
    assert.throws(() => toCachedMatrixFlat(flat, 4, ['a', 'b', 'c', 'd'], 'duration'), /holds 9 cells/)
  })

  test('stores plain numbers, so a row written before M9 is the same shape', () => {
    const cached = toCachedMatrixFlat(new Int32Array(4), 2, ['a', 'b'], 'distance')
    assert.ok(Array.isArray(cached.costs))
  })
})
