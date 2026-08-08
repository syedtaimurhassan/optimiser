import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_FIRST,
  ORDER_LAST,
  SKIP_PENALTY,
  arcSum,
  arrivalsFor,
  capacityFor,
  makeConstraints,
  objectiveValue,
  resolveEndpoints,
  toResult,
  toSolveMatrix,
  validateOrder,
  type SolveRequest,
} from './solverPort.ts'

/**
 * Cell (i,j) is `10*i + j`, so a matrix read the wrong way round fails loudly
 * rather than passing on a symmetric fixture that cannot tell the two apart.
 * The same trick costMatrix.test.ts uses, and for the same reason.
 */
const grid = [
  [0, 1, 2, 3],
  [10, 0, 12, 13],
  [20, 21, 0, 23],
  [30, 31, 32, 0],
]

function request(overrides: Partial<SolveRequest> = {}): SolveRequest {
  const n = 4
  return {
    matrix: { n, durations: toSolveMatrix(grid) },
    constraints: makeConstraints(n),
    endpoints: { start: null, end: null },
    skipPenalty: SKIP_PENALTY,
    objective: 'duration',
    budgetMs: 0,
    ...overrides,
  }
}

describe('toSolveMatrix', () => {
  test('flattens row-major', () => {
    const flat = toSolveMatrix(grid)
    assert.equal(flat.length, 16)
    assert.equal(flat[1 * 4 + 2], 12)
    assert.equal(flat[2 * 4 + 1], 21)
  })

  test('is an Int32Array, not an array of arrays', () => {
    assert.ok(toSolveMatrix(grid) instanceof Int32Array)
  })
})

describe('arcSum', () => {
  test('sums the arcs in visiting order, not the reverse', () => {
    // 0->1 = 1, 1->2 = 12, 2->3 = 23
    assert.equal(arcSum(toSolveMatrix(grid), 4, [0, 1, 2, 3]), 36)
    // 3->2 = 32, 2->1 = 21, 1->0 = 10
    assert.equal(arcSum(toSolveMatrix(grid), 4, [3, 2, 1, 0]), 63)
  })
})

describe('resolveEndpoints', () => {
  test('reads pins out of the order array', () => {
    const req = request()
    req.constraints.order[2] = ORDER_FIRST
    req.constraints.order[3] = ORDER_LAST
    assert.deepEqual(resolveEndpoints(req), { start: 2, end: 3 })
  })

  test('the endpoints field agrees with a matching pin', () => {
    const req = request({ endpoints: { start: 1, end: null } })
    req.constraints.order[1] = ORDER_FIRST
    assert.deepEqual(resolveEndpoints(req), { start: 1, end: null })
  })

  test('throws when two different nodes claim the start', () => {
    const req = request({ endpoints: { start: 0, end: null } })
    req.constraints.order[2] = ORDER_FIRST
    assert.throws(() => resolveEndpoints(req), /pinned to the start/)
  })

  test('throws when one node is pinned to both ends', () => {
    const req = request({ endpoints: { start: 1, end: 1 } })
    assert.throws(() => resolveEndpoints(req), /both the start and the end/)
  })
})

describe('capacityFor', () => {
  test('null K means every optional node', () => {
    assert.equal(capacityFor(request({ selectK: null })), 4)
  })

  test('mandatory nodes do not count towards K', () => {
    const req = request({ selectK: null })
    req.constraints.optional[0] = 0
    req.constraints.optional[3] = 0
    assert.equal(capacityFor(req), 2)
  })

  test('K is clamped to the number of optional nodes', () => {
    assert.equal(capacityFor(request({ selectK: 99 })), 4)
    assert.equal(capacityFor(request({ selectK: -5 })), 0)
  })
})

describe('objectiveValue', () => {
  test('is arcs plus a penalty per unvisited optional node', () => {
    const req = request()
    // Visiting 0->1 costs 1; nodes 2 and 3 are optional and skipped.
    assert.equal(objectiveValue(req, [0, 1]), 1 + 2 * SKIP_PENALTY)
  })

  test('a mandatory node left out costs nothing extra — it is invalid, not dear', () => {
    const req = request()
    req.constraints.optional[3] = 0
    assert.equal(objectiveValue(req, [0, 1, 2]), 1 + 12 + SKIP_PENALTY * 0)
    assert.deepEqual(validateOrder(req, [0, 1, 2]), ['mandatory node 3 was skipped'])
  })

  test('scores a distance objective on the distance matrix', () => {
    const distances = toSolveMatrix(grid.map((row) => row.map((v) => v * 100)))
    const req = request({
      matrix: { n: 4, durations: toSolveMatrix(grid), distances },
      objective: 'distance',
      selectK: null,
    })
    assert.equal(objectiveValue(req, [0, 1, 2, 3]), 3600)
  })

  test('refuses a distance objective with no distance matrix', () => {
    const req = request({ objective: 'distance' })
    assert.throws(() => objectiveValue(req, [0, 1]), /needs a distance matrix/)
  })
})

describe('validateOrder', () => {
  test('accepts a well-formed full order', () => {
    assert.deepEqual(validateOrder(request(), [0, 1, 2, 3]), [])
  })

  test('catches repeats and out-of-range indices', () => {
    const problems = validateOrder(request(), [0, 1, 1, 9])
    assert.ok(problems.some((p) => p.includes('visited twice: 1')))
    assert.ok(problems.some((p) => p.includes('out of range: 9')))
  })

  test('catches a pinned endpoint out of position', () => {
    const req = request({ endpoints: { start: 2, end: 3 } })
    const problems = validateOrder(req, [0, 1, 2, 3])
    assert.deepEqual(problems, ['pinned start 2 is not first (got 0)'])
  })

  test('catches an exceeded K cap', () => {
    const req = request({ selectK: 2 })
    const problems = validateOrder(req, [0, 1, 2, 3])
    assert.deepEqual(problems, ['K cap exceeded: visited 4 optional nodes, cap is 2'])
  })
})

describe('arrivalsFor', () => {
  test('accumulates travel and service time from a zero start', () => {
    const req = request()
    req.constraints.serviceTimeSec[1] = 100
    // arrive 0 at t=0; drive 0->1 = 1; serve 100; drive 1->2 = 12
    assert.deepEqual([...arrivalsFor(req, [0, 1, 2])], [0, 1, 113])
  })
})

describe('toResult', () => {
  test('reports duration and distance separately', () => {
    const distances = toSolveMatrix(grid.map((row) => row.map((v) => v * 100)))
    const req = request({ matrix: { n: 4, durations: toSolveMatrix(grid), distances } })
    const result = toResult(req, Int32Array.from([0, 1, 2]))
    assert.equal(result.costSec, 13)
    assert.equal(result.distanceM, 1300)
    assert.deepEqual([...result.visited], [1, 1, 1, 0])
  })

  test('distance is zero, not a lie, when no distance matrix was given', () => {
    const result = toResult(request(), Int32Array.from([0, 1]))
    assert.equal(result.distanceM, 0)
  })
})
