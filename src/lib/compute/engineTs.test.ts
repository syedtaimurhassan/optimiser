import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Search, TsEngine, engineTs } from './engineTs.ts'
import {
  SKIP_PENALTY,
  arcSum,
  makeConstraints,
  makeRng,
  objectiveValue,
  validateOrder,
  type SolveRequest,
} from './solverPort.ts'

/**
 * These tests exist to catch ONE class of bug above all others.
 *
 * Every move in this engine is accepted on the strength of a delta computed in
 * O(1) rather than by recomputing the route. If a delta is wrong, the engine
 * happily accepts moves that make the route worse, reports a cost that looks
 * fine, and produces a route that is merely a bit poor — the hardest kind of
 * defect to ever notice, and the exact reason the asymmetric-reversal term
 * exists.
 *
 * So the deltas are checked against a full recompute, on ASYMMETRIC matrices,
 * across every legal (i, j) — not sampled, exhausted.
 */

/** A deterministic asymmetric matrix. Every cell differs from its reverse. */
function randomMatrix(n: number, seed: number): Int32Array {
  const rng = makeRng(seed)
  const cells = new Int32Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      cells[i * n + j] = 1 + Math.floor(rng() * 1000)
    }
  }
  return cells
}

function request(n: number, cells: Int32Array, overrides: Partial<SolveRequest> = {}): SolveRequest {
  return {
    matrix: { n, durations: cells },
    constraints: makeConstraints(n),
    endpoints: { start: null, end: null },
    skipPenalty: SKIP_PENALTY,
    objective: 'duration',
    budgetMs: 0,
    seed: 1,
    ...overrides,
  }
}

/** Cost of a tour computed the slow, obviously-correct way. */
const trueCost = (cells: Int32Array, n: number, tour: ArrayLike<number>) => arcSum(cells, n, tour)

describe('reverseDelta — the asymmetric 2-opt term', () => {
  test('matches a full recompute for every legal (i, j), on an asymmetric matrix', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const n = 9
      const cells = randomMatrix(n, seed)
      const req = request(n, cells)

      for (let i = 1; i < n - 1; i++) {
        for (let j = i; j < n - 1; j++) {
          const search = new Search(req)
          search.tour = Int32Array.from({ length: n }, (_, t) => t)
          search.length = n
          search.refresh()

          const before = trueCost(cells, n, search.tour)
          const predicted = search.reverseDelta(i, j)
          search.applyReverse(i, j)
          const after = trueCost(cells, n, search.tour)

          assert.equal(
            predicted,
            after - before,
            `seed ${seed}: reversing [${i}..${j}] predicted ${predicted}, actually ${after - before}`,
          )
        }
      }
    }
  })

  test('a symmetric-only delta would be wrong here — proving the fixture bites', () => {
    const n = 6
    const cells = randomMatrix(n, 3)
    const req = request(n, cells)
    const search = new Search(req)
    search.tour = Int32Array.from({ length: n }, (_, t) => t)
    search.length = n
    search.refresh()

    // The textbook symmetric delta, which omits the cost of turning the
    // segment round. If this ever equals the real delta the matrix is not
    // asymmetric and the test above is not testing anything.
    const i = 2
    const j = 4
    const naive =
      cells[search.tour[i - 1] * n + search.tour[j]] +
      cells[search.tour[i] * n + search.tour[j + 1]] -
      cells[search.tour[i - 1] * n + search.tour[i]] -
      cells[search.tour[j] * n + search.tour[j + 1]]

    assert.notEqual(naive, search.reverseDelta(i, j))
  })

  test('reversal at a free end is priced with no phantom arc', () => {
    const n = 6
    const cells = randomMatrix(n, 11)
    const search = new Search(request(n, cells))
    search.tour = Int32Array.from({ length: n }, (_, t) => t)
    search.length = n
    search.refresh()

    const before = trueCost(cells, n, search.tour)
    const predicted = search.reverseDelta(0, n - 1)
    search.applyReverse(0, n - 1)
    assert.equal(predicted, trueCost(cells, n, search.tour) - before)
  })
})

describe('orOptDelta — segment relocation', () => {
  test('matches a full recompute for every segment, gap and orientation', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const n = 8
      const cells = randomMatrix(n, seed)
      const req = request(n, cells)

      for (let len = 1; len <= 3; len++) {
        for (let p = 0; p + len <= n; p++) {
          for (let u = 0; u <= n - len; u++) {
            if (u === p) continue
            for (const reversed of [false, true]) {
              if (reversed && len === 1) continue
              const search = new Search(req)
              search.tour = Int32Array.from({ length: n }, (_, t) => t)
              search.length = n
              search.refresh()

              const before = trueCost(cells, n, search.tour)
              const predicted = search.orOptDelta(p, len, u, reversed)
              search.applyOrOpt(p, len, u, reversed)
              const after = trueCost(cells, n, search.tour)

              assert.equal(
                predicted,
                after - before,
                `seed ${seed}: move [${p}..${p + len - 1}] to gap ${u} reversed=${reversed}`,
              )
              assert.equal(search.length, n, 'relocation must not lose or duplicate a node')
              assert.equal(new Set(search.tour.slice(0, n)).size, n)
            }
          }
        }
      }
    }
  })
})

describe('descent never goes uphill', () => {
  test('local search only ever lowers the objective, across many instances', async () => {
    for (let seed = 1; seed <= 12; seed++) {
      const n = 30
      const cells = randomMatrix(n, seed)
      const req = request(n, cells, { endpoints: { start: 0, end: n - 1 }, budgetMs: 60 })
      req.constraints.optional[0] = 0
      req.constraints.optional[n - 1] = 0

      const search = new Search(req)
      search.construct(undefined)
      const initial = search.objective()
      search.localSearch(Date.now() + 50)
      const improved = search.objective()

      assert.ok(
        improved <= initial + 1e-9,
        `seed ${seed}: local search made it worse (${initial} -> ${improved})`,
      )
    }
  })
})

describe('optimality on instances small enough to brute-force', () => {
  /** Exact answer by permuting the free nodes. Only tractable to about n=8. */
  function bruteForce(req: SolveRequest): number {
    const { n } = req.matrix
    const middle: number[] = []
    for (let i = 1; i < n - 1; i++) middle.push(i)

    let best = Infinity
    const permute = (prefix: number[], rest: number[]) => {
      if (rest.length === 0) {
        const order = [0, ...prefix, n - 1]
        best = Math.min(best, objectiveValue(req, order))
        return
      }
      for (let i = 0; i < rest.length; i++) {
        permute([...prefix, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)])
      }
    }
    permute([], middle)
    return best
  }

  test('finds the optimum on every one of 20 small asymmetric instances', async () => {
    const engine = new TsEngine()
    for (let seed = 1; seed <= 20; seed++) {
      const n = 8
      const cells = randomMatrix(n, seed * 31)
      const req = request(n, cells, { endpoints: { start: 0, end: n - 1 }, budgetMs: 120, seed })
      req.constraints.optional[0] = 0
      req.constraints.optional[n - 1] = 0

      const result = await engine.solve(req)
      assert.deepEqual(validateOrder(req, result.order), [], `seed ${seed}: invalid result`)
      assert.equal(
        objectiveValue(req, result.order),
        bruteForce(req),
        `seed ${seed}: engine did not find the optimum`,
      )
    }
  })
})

describe('constraints are obeyed, not merely aimed at', () => {
  test('pinned endpoints land in position', async () => {
    const n = 12
    const cells = randomMatrix(n, 7)
    const req = request(n, cells, { endpoints: { start: 3, end: 9 }, budgetMs: 80 })
    req.constraints.optional[3] = 0
    req.constraints.optional[9] = 0

    const result = await engineTs.solve(req)
    assert.equal(result.order[0], 3)
    assert.equal(result.order[result.order.length - 1], 9)
    assert.deepEqual(validateOrder(req, result.order), [])
  })

  test('a free-ended route visits everything and pins nothing', async () => {
    const n = 10
    const req = request(n, randomMatrix(n, 5), { budgetMs: 80 })
    const result = await engineTs.solve(req)
    assert.equal(result.order.length, n)
    assert.deepEqual(validateOrder(req, result.order), [])
  })

  test('the K cap is respected and the penalty is what pays for a skip', async () => {
    const n = 14
    const req = request(n, randomMatrix(n, 13), {
      endpoints: { start: 0, end: n - 1 },
      selectK: 5,
      budgetMs: 120,
    })
    req.constraints.optional[0] = 0
    req.constraints.optional[n - 1] = 0

    const result = await engineTs.solve(req)
    assert.deepEqual(validateOrder(req, result.order), [])
    assert.equal(result.order.length, 7, 'two pinned ends plus exactly K candidates')
  })

  test('mandatory nodes are never skipped, even under a tight K', async () => {
    const n = 12
    const req = request(n, randomMatrix(n, 17), {
      endpoints: { start: 0, end: n - 1 },
      selectK: 3,
      budgetMs: 120,
    })
    req.constraints.optional[0] = 0
    req.constraints.optional[n - 1] = 0
    req.constraints.optional[5] = 0
    req.constraints.optional[6] = 0

    const result = await engineTs.solve(req)
    assert.deepEqual(validateOrder(req, result.order), [])
    assert.ok([...result.order].includes(5))
    assert.ok([...result.order].includes(6))
  })
})

describe('the contract with the caller', () => {
  test('cancellation rejects rather than returning a worse route', async () => {
    const n = 60
    const req = request(n, randomMatrix(n, 23), { budgetMs: 5000 })
    const controller = new AbortController()
    const promise = engineTs.solve(req, undefined, controller.signal)
    controller.abort()
    await assert.rejects(promise, (e: Error) => e.name === 'AbortError')
  })

  test('an already-aborted signal never starts work', async () => {
    const req = request(8, randomMatrix(8, 2), { budgetMs: 1000 })
    await assert.rejects(
      engineTs.solve(req, undefined, AbortSignal.abort()),
      (e: Error) => e.name === 'AbortError',
    )
  })

  test('progress is reported and never goes backwards', async () => {
    const n = 80
    const req = request(n, randomMatrix(n, 29), { budgetMs: 300 })
    const seen: number[] = []
    await engineTs.solve(req, (p) => seen.push(p.bestCost))
    assert.ok(seen.length > 0, 'no progress was reported at all')
    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i] <= seen[i - 1] + 1e-9, 'best cost went up')
    }
  })

  test('the budget is a ceiling', async () => {
    const n = 120
    const req = request(n, randomMatrix(n, 31), { budgetMs: 200 })
    const started = Date.now()
    await engineTs.solve(req)
    assert.ok(Date.now() - started < 1500, 'solve overran its budget badly')
  })

  test('the same seed gives the same route twice', async () => {
    const n = 40
    const cells = randomMatrix(n, 41)
    const a = await engineTs.solve(request(n, cells, { budgetMs: 150, seed: 99 }))
    const b = await engineTs.solve(request(n, cells, { budgetMs: 150, seed: 99 }))
    assert.deepEqual([...a.order], [...b.order])
  })

  test('two points are a route, one is an error', async () => {
    const two = await engineTs.solve(request(2, randomMatrix(2, 1), { budgetMs: 10 }))
    assert.equal(two.order.length, 2)
    await assert.rejects(engineTs.solve(request(1, new Int32Array(1), { budgetMs: 10 })))
  })

  test('reported cost is the real arc sum, not the engine’s opinion of it', async () => {
    const n = 25
    const cells = randomMatrix(n, 43)
    const req = request(n, cells, { budgetMs: 120 })
    const result = await engineTs.solve(req)
    assert.equal(result.costSec, arcSum(cells, n, result.order))
  })
})

describe('the seed order is a hint, never an answer', () => {
  test('a deliberately terrible seed still produces a good route', async () => {
    const n = 30
    const cells = randomMatrix(n, 47)
    const reversedSeed = Int32Array.from({ length: n }, (_, i) => n - 1 - i)

    const withSeed = await engineTs.solve(
      request(n, cells, { budgetMs: 200, seedOrder: reversedSeed }),
    )
    const without = await engineTs.solve(request(n, cells, { budgetMs: 200 }))

    assert.deepEqual(validateOrder(request(n, cells), withSeed.order), [])
    // Not "identical" — the seed legitimately changes the search path. But a bad
    // seed must not survive into the answer as a bad route.
    assert.ok(withSeed.costSec < without.costSec * 1.25)
  })
})
