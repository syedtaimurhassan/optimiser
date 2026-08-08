import {
  initRouting,
  RoutingIndexManager,
  RoutingModel,
  DefaultRoutingSearchParameters,
  FirstSolutionStrategy,
  setWorkerBridgeEnabled,
} from 'or-tools-wasm/routing'
import {
  abortError,
  capacityFor,
  costMatrixFor,
  effectiveOptional,
  makeRng,
  objectiveValue,
  resolveEndpoints,
  toResult,
  type SolveProgress,
  type SolveRequest,
  type SolveResult,
  type SolverEngine,
} from './solverPort.ts'

/**
 * The OR-Tools engine — DEV AND BENCH BUILDS ONLY.
 *
 * ── Why it still exists ───────────────────────────────────────────────────
 *
 * It is the oracle. When a new engine returns a different route, the question
 * is which one is wrong, and answering it needs an implementation nobody on
 * this project wrote. This one solved the problem for eight milestones, so its
 * answers are the baseline every replacement is measured against — until M15,
 * when the Rust engine has earned enough trust to stand alone.
 *
 * ── Why users never load it ───────────────────────────────────────────────
 *
 * It is imported dynamically, from `benchSeam.ts` alone, which is itself behind
 * a build flag Vite folds to a constant. Nothing in the production entry graph
 * reaches this file, so its ~16 MB of WebAssembly is never fetched and never
 * bundled. `npm run bench:verify-seam` fails the build if that stops being true.
 *
 * ── What is wrong with it, stated plainly ─────────────────────────────────
 *
 * 1. A JS closure is invoked from WASM once per ARC EVALUATION. `cost()` below
 *    is that closure. This is the single reason BEST_INSERTION and CHRISTOFIDES
 *    take >12s on a ten-node model while the others take 5-8ms, and it is the
 *    mistake M10 exists not to repeat in Rust.
 *
 * 2. `or-tools-wasm@0.9.1` forwards ONLY `firstSolutionStrategy` and
 *    `solution_limit` into the WASM. `local_search_metaheuristic` and
 *    `time_limit` are declared in its TypeScript and never serialised —
 *    verified in `build/javascript/browser/routing_api.js`, at every one of the
 *    seven call sites, on the latest published version. So this is a
 *    CONSTRUCTION heuristic with no local search, and all of its quality comes
 *    from the JS-side portfolio and GRASP restarts below.
 *
 * 3. It needs cross-origin isolation, because its binary was built with pthread
 *    support — not because anything in it is parallel.
 */

/** Cost of a forbidden virtual arc — larger than any penalty, so never used. */
const FORBIDDEN = 1_000_000_000

/** Hard cap on total solve attempts, independent of the clock. */
const MAX_ATTEMPTS = 400

/** GRASP noise magnitude as a fraction of the mean real arc cost. */
const NOISE_FRACTION = 0.25

/**
 * Constructive strategies the portfolio cycles through.
 *
 * BEST_INSERTION and CHRISTOFIDES are deliberately absent — see note 1 above.
 * A `SolveWithParameters` call cannot be interrupted, so one of them would blow
 * straight through the time ceiling.
 */
const PORTFOLIO: FirstSolutionStrategy[] = [
  FirstSolutionStrategy.PATH_CHEAPEST_ARC,
  FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION,
  FirstSolutionStrategy.SEQUENTIAL_CHEAPEST_INSERTION,
  FirstSolutionStrategy.LOCAL_CHEAPEST_INSERTION,
  FirstSolutionStrategy.GLOBAL_CHEAPEST_ARC,
  FirstSolutionStrategy.SAVINGS,
  FirstSolutionStrategy.PATH_MOST_CONSTRAINED_ARC,
]

let warmUpPromise: Promise<void> | null = null

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Mean of the finite, off-diagonal arcs — the scale for GRASP noise. */
function meanArc(cells: Int32Array, n: number): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const v = cells[i * n + j]
      if (v < FORBIDDEN) {
        sum += v
        count++
      }
    }
  }
  return count > 0 ? sum / count : 1
}

/** A perturbed copy: each real arc gets +[0, mag) integer noise. */
function noised(cells: Int32Array, n: number, mag: number, rng: () => number): Int32Array {
  const out = new Int32Array(cells.length)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = cells[i * n + j]
      out[i * n + j] = i === j || v >= FORBIDDEN ? v : v + Math.floor(rng() * mag)
    }
  }
  return out
}

/**
 * One construction on the augmented graph: real nodes plus two virtual depots
 * joined by zero-cost arcs to the allowed endpoints, optional nodes made
 * skippable by disjunction, and the K cap enforced by a capacity dimension.
 */
async function runOnce(
  cells: Int32Array,
  n: number,
  start: number | null,
  end: number | null,
  optional: Uint8Array,
  cap: number,
  skipPenalty: number,
  strategy: FirstSolutionStrategy,
): Promise<number[] | null> {
  const VS = n
  const VE = n + 1

  // THE per-arc FFI crossing. Every arc evaluation inside the WASM search calls
  // back into JavaScript, here.
  const cost = (a: number, b: number): number => {
    if (a < n && b < n) return cells[a * n + b]
    if (a === VS) return b < n && (start === null || b === start) ? 0 : FORBIDDEN
    if (b === VE) return a < n && (end === null || a === end) ? 0 : FORBIDDEN
    return FORBIDDEN
  }

  const manager = new RoutingIndexManager(n + 2, 1, [VS], [VE])
  const routing = new RoutingModel(manager)
  try {
    const transitIdx = routing.RegisterTransitCallback((from, to) =>
      cost(manager.IndexToNode(from), manager.IndexToNode(to)),
    )
    routing.SetArcCostEvaluatorOfAllVehicles(transitIdx)

    for (let node = 0; node < n; node++) {
      if (optional[node] === 1) {
        routing.AddDisjunction([manager.NodeToIndex(node)], skipPenalty)
      }
    }

    const demandIdx = routing.RegisterUnaryTransitCallback((from) => {
      const node = manager.IndexToNode(from)
      if (node >= n) return 0
      return optional[node] === 1 ? 1 : 0
    })
    routing.AddDimensionWithVehicleCapacity(demandIdx, 0, [Math.max(0, cap)], true, 'StopCounter')

    const params = DefaultRoutingSearchParameters()
    params.firstSolutionStrategy = strategy

    const solution = await routing.SolveWithParameters(params)
    if (!solution) return null

    const visited: number[] = []
    let index = routing.Start(0)
    while (!routing.IsEnd(index)) {
      const node = manager.IndexToNode(index)
      if (node < n) visited.push(node)
      index = solution.Value(routing.NextVar(index))
    }
    return visited
  } catch {
    // Some strategies reject a model with optional nodes; skip rather than abort.
    return null
  } finally {
    routing.delete()
    manager.delete()
  }
}

export class OrToolsLegacyEngine implements SolverEngine {
  readonly id = 'ortools'

  warmUp(): Promise<void> {
    if (!warmUpPromise) {
      warmUpPromise = (async () => {
        setWorkerBridgeEnabled(false)
        await initRouting()
      })().catch((e: unknown) => {
        warmUpPromise = null
        throw e
      })
    }
    return warmUpPromise
  }

  async solve(
    request: SolveRequest,
    onProgress?: (progress: SolveProgress) => void,
    signal?: AbortSignal,
  ): Promise<SolveResult> {
    const n = request.matrix.n
    if (n < 2) throw new Error('Need at least two points to build a route.')
    if (signal?.aborted) throw abortError()

    const cells = costMatrixFor(request.matrix, request.objective)
    const { start, end } = resolveEndpoints(request)
    const optional = effectiveOptional(request)
    const cap = capacityFor(request)

    await this.warmUp()
    await yieldToEventLoop()

    const startedAt = Date.now()
    const deadline = startedAt + Math.max(0, request.budgetMs)
    let best: number[] | null = null
    let bestObjective = Infinity
    let attempts = 0
    let sinceImprovement = 0

    const consider = (visited: number[] | null) => {
      if (!visited || visited.length === 0) return
      attempts++
      const objective = objectiveValue(request, visited)
      if (objective < bestObjective) {
        bestObjective = objective
        best = visited
        sinceImprovement = 0
      } else {
        sinceImprovement++
      }
      onProgress?.({ bestCost: bestObjective, iterations: attempts, elapsedMs: Date.now() - startedAt })
    }

    const patience = Math.max(30, 3 * n)

    // Pass 1 — each distinct constructive heuristic once, on the clean matrix.
    for (let s = 0; s < PORTFOLIO.length; s++) {
      if (signal?.aborted) throw abortError()
      consider(await runOnce(cells, n, start, end, optional, cap, request.skipPenalty, PORTFOLIO[s]))
      if (s > 0 && Date.now() >= deadline && best) break
      await yieldToEventLoop()
    }

    // Pass 2 — GRASP-style noised restarts. Each result is scored on the
    // ORIGINAL matrix, so noise only perturbs the construction, never the cost.
    const magnitude = Math.max(1, Math.round(meanArc(cells, n) * NOISE_FRACTION))
    const rng = makeRng(request.seed ?? 0x9e3779b9)
    let i = 0
    sinceImprovement = 0
    while (Date.now() < deadline && attempts < MAX_ATTEMPTS && sinceImprovement < patience) {
      if (signal?.aborted) throw abortError()
      const strategy = PORTFOLIO[i % PORTFOLIO.length]
      consider(
        await runOnce(
          noised(cells, n, magnitude, rng),
          n,
          start,
          end,
          optional,
          cap,
          request.skipPenalty,
          strategy,
        ),
      )
      i++
      await yieldToEventLoop()
    }

    if (!best) throw new Error('OR-Tools could not find a feasible route.')
    return toResult(request, Int32Array.from(best))
  }
}
