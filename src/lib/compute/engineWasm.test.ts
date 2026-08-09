import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { WasmEngine } from './engineWasm.ts'
import { engineTs } from './engineTs.ts'
import {
  SKIP_PENALTY,
  makeConstraints,
  makeRng,
  objectiveValue,
  validateOrder,
  type SolveRequest,
} from './solverPort.ts'

/**
 * The Rust engine, checked against the TypeScript one.
 *
 * ── Why this test can exist at all ────────────────────────────────────────
 *
 * The crate's own `cargo test` suite proves the engine is internally
 * consistent — every delta matches a full recompute, the optimum is found on 60
 * brute-forced instances. What it cannot prove is that the thing JavaScript
 * actually loads behaves the same way: the FFI could mis-order an argument, the
 * loader could hand over a detached view, the build could ship a stale artefact.
 *
 * So this drives the REAL `.wasm` through the REAL `SolverEngine` port, and
 * compares it against the engine M9 already trusts. Node cannot `fetch` a
 * `file:` URL, which is the only reason `WasmEngine` accepts bytes directly.
 *
 * ── What a disagreement means ─────────────────────────────────────────────
 *
 * The two engines are not required to return the SAME route — they are
 * different searches with different arithmetic, and on an instance with ties
 * they will diverge. They are required to return VALID routes, and the Rust one
 * is required not to be worse in any way that matters. Anything else is a bug in
 * one of them, and this is the only place that would notice.
 */

const artefact = (name: string) =>
  readFile(fileURLToPath(new URL(`./wasm/${name}`, import.meta.url)))

/** Both builds, so a SIMD-only regression cannot hide. */
const engines = {
  scalar: new WasmEngine('wasm-scalar', {
    variant: 'scalar',
    bytes: () => artefact('engine.wasm'),
  }),
  simd: new WasmEngine('wasm-simd', {
    variant: 'simd',
    bytes: () => artefact('engine-simd.wasm'),
  }),
}

/** A deterministic asymmetric matrix — every cell differs from its reverse. */
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
  const constraints = makeConstraints(n)
  const endpoints = overrides.endpoints ?? { start: null, end: null }
  if (endpoints.start !== null) constraints.optional[endpoints.start] = 0
  if (endpoints.end !== null) constraints.optional[endpoints.end] = 0
  return {
    matrix: { n, durations: cells },
    constraints,
    endpoints,
    skipPenalty: SKIP_PENALTY,
    objective: 'duration',
    budgetMs: 250,
    seed: 1,
    ...overrides,
    ...(overrides.constraints ? {} : { constraints }),
  }
}

describe('the wasm engine, through the port', () => {
  for (const [variant, engine] of Object.entries(engines)) {
    test(`${variant}: returns structurally valid routes`, async () => {
      for (let seed = 1; seed <= 6; seed++) {
        const n = 30
        const req = request(n, randomMatrix(n, seed), {
          endpoints: { start: 0, end: n - 1 },
          seed,
        })
        const result = await engine.solve(req)
        const problems = validateOrder(req, result.order)
        assert.deepEqual(problems, [], `seed ${seed}: ${problems.join('; ')}`)
        assert.equal(result.order.length, n, `seed ${seed}: not every stop was visited`)
      }
    })

    test(`${variant}: honours the K cap`, async () => {
      const n = 40
      const req = request(n, randomMatrix(n, 3), {
        endpoints: { start: 0, end: n - 1 },
        selectK: 15,
      })
      const result = await engine.solve(req)
      assert.deepEqual(validateOrder(req, result.order), [])
      assert.equal(result.order.length, 17, 'two pinned ends plus fifteen optional stops')
    })

    test(`${variant}: reports a cost that matches the referee`, async () => {
      // The engine's self-reported objective is never trusted anywhere, but the
      // ORDER it returns must be worth what `toResult` says it is.
      const n = 25
      const req = request(n, randomMatrix(n, 9), { endpoints: { start: 0, end: null } })
      const result = await engine.solve(req)

      let expected = 0
      for (let i = 0; i < result.order.length - 1; i++) {
        expected += req.matrix.durations[result.order[i] * n + result.order[i + 1]]
      }
      assert.equal(result.costSec, expected)
    })
  }

  test('both artefacts agree with each other', async () => {
    // Same seed, same instance: SIMD changes how the arithmetic is executed, not
    // what it computes. A divergence here means a vectorised path is wrong.
    for (let seed = 1; seed <= 4; seed++) {
      const n = 35
      const cells = randomMatrix(n, seed)
      const build = () => request(n, cells, { endpoints: { start: 0, end: n - 1 }, seed })
      const scalar = await engines.scalar.solve(build())
      const simd = await engines.simd.solve(build())
      assert.deepEqual(
        Array.from(simd.order),
        Array.from(scalar.order),
        `seed ${seed}: the two builds routed differently`,
      )
    }
  })
})

describe('the wasm engine against the TypeScript oracle', () => {
  test('is never meaningfully worse, over a spread of instances', async () => {
    const losses: string[] = []
    for (let seed = 1; seed <= 8; seed++) {
      const n = 60
      const cells = randomMatrix(n, seed)
      const build = () =>
        request(n, cells, { endpoints: { start: 0, end: n - 1 }, seed, budgetMs: 400 })

      const req = build()
      const [wasm, ts] = await Promise.all([
        engines.scalar.solve(build()),
        engineTs.solve(build()),
      ])

      assert.deepEqual(validateOrder(req, wasm.order), [], `seed ${seed}: wasm route invalid`)

      const wasmObjective = objectiveValue(req, wasm.order)
      const tsObjective = objectiveValue(req, ts.order)
      if (wasmObjective > tsObjective) {
        const gap = ((wasmObjective - tsObjective) / tsObjective) * 100
        losses.push(`seed ${seed}: +${gap.toFixed(2)}%`)
      }
    }

    // Not "never worse" — these are different searches and either can win a
    // given instance. Losing MOST of them would mean the port dropped something.
    assert.ok(
      losses.length <= 3,
      `the wasm engine lost on ${losses.length} of 8 instances: ${losses.join(', ')}`,
    )
  })

  test('finds the optimum on instances small enough to brute-force', async () => {
    for (let n = 6; n <= 8; n++) {
      for (let seed = 1; seed <= 4; seed++) {
        const cells = randomMatrix(n, seed)
        const req = request(n, cells, { endpoints: { start: 0, end: n - 1 }, seed })

        // Every ordering of the interior.
        const interior = Array.from({ length: n - 2 }, (_, i) => i + 1)
        let best = Infinity
        const permute = (rest: number[], acc: number[]) => {
          if (rest.length === 0) {
            const order = [0, ...acc, n - 1]
            let cost = 0
            for (let i = 0; i < order.length - 1; i++) cost += cells[order[i] * n + order[i + 1]]
            best = Math.min(best, cost)
            return
          }
          for (let i = 0; i < rest.length; i++) {
            permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]])
          }
        }
        permute(interior, [])

        const result = await engines.scalar.solve(req)
        assert.equal(result.costSec, best, `n=${n} seed=${seed}: missed the optimum`)
      }
    }
  })
})

describe('cancellation', () => {
  test('rejects with an AbortError rather than returning a worse route', async () => {
    const n = 200
    const req = request(n, randomMatrix(n, 5), { budgetMs: 10_000 })
    const controller = new AbortController()

    const started = Date.now()
    const solving = engines.scalar.solve(req, undefined, controller.signal)
    setTimeout(() => controller.abort(), 60)

    await assert.rejects(solving, (error: Error) => error.name === 'AbortError')

    // The whole design exists to make this number small: the host can only stop
    // between steps, and a step is sized to ~15 ms.
    const elapsed = Date.now() - started
    assert.ok(elapsed < 500, `cancellation took ${elapsed}ms, which is not responsive`)
  })

  test('a signal that is already aborted never starts', async () => {
    const n = 20
    const req = request(n, randomMatrix(n, 2))
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(
      engines.scalar.solve(req, undefined, controller.signal),
      (error: Error) => error.name === 'AbortError',
    )
  })
})

describe('progress', () => {
  test('reports, and never reports a cost worse than the one before', async () => {
    const n = 120
    const req = request(n, randomMatrix(n, 4), { budgetMs: 600 })
    const seen: number[] = []
    await engines.scalar.solve(req, (progress) => seen.push(progress.bestCost))

    assert.ok(seen.length > 0, 'no progress was reported at all')
    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i] <= seen[i - 1], `progress went backwards: ${seen[i - 1]} -> ${seen[i]}`)
    }
  })
})
