import {
  initRouting,
  RoutingIndexManager,
  RoutingModel,
  DefaultRoutingSearchParameters,
  FirstSolutionStrategy,
  setWorkerBridgeEnabled,
} from 'or-tools-wasm/routing'

/**
 * Penalty for leaving a candidate stop unvisited. It must dwarf any real arc so
 * the solver only skips a stop when the K capacity forces it to.
 */
export const SKIP_PENALTY = 10_000_000

/** Cost of a forbidden virtual arc — larger than any penalty, so it's never used. */
const FORBIDDEN = 1_000_000_000

/** Default wall-clock budget for the multi-start portfolio search (Deep). */
export const DEFAULT_TIME_BUDGET_MS = 3000

/** Hard cap on total solve attempts, independent of the clock (safety net). */
const MAX_ATTEMPTS = 400

/** GRASP noise magnitude as a fraction of the mean real arc cost. */
const NOISE_FRACTION = 0.25

/**
 * Constructive first-solution strategies we cycle through. `or-tools-wasm@0.9.1`
 * forwards ONLY `firstSolutionStrategy` (+ `solution_limit`) to the WASM solver —
 * `local_search_metaheuristic` (GLS) and `time_limit` are declared in the types
 * but never passed to the binding, so they are inert. We therefore get quality by
 * running a PORTFOLIO of constructive heuristics (plus noised restarts) under a
 * JS-side time budget, keeping the best. PATH_CHEAPEST_ARC is first so a zero
 * budget degrades to the original single greedy pass. The insertion / savings /
 * global-arc strategies are the ones that break the start-anchoring bias.
 */
// NOTE: BEST_INSERTION and CHRISTOFIDES are deliberately excluded — in this WASM
// build they can take >12s on even a ~10-node model, and since a SolveWithParameters
// call can't be interrupted mid-solve, one of them would blow past the time
// ceiling. The remaining strategies all return in single-digit milliseconds.
const PORTFOLIO: FirstSolutionStrategy[] = [
  FirstSolutionStrategy.PATH_CHEAPEST_ARC,
  FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION,
  FirstSolutionStrategy.SEQUENTIAL_CHEAPEST_INSERTION,
  FirstSolutionStrategy.LOCAL_CHEAPEST_INSERTION,
  FirstSolutionStrategy.GLOBAL_CHEAPEST_ARC,
  FirstSolutionStrategy.SAVINGS,
  FirstSolutionStrategy.PATH_MOST_CONSTRAINED_ARC,
]

// The OR-Tools routing WASM (~16 MB) is downloaded on first use. We warm it up
// once, in the background, so the first "Calculate" isn't stuck waiting on it.
let warmUpPromise: Promise<void> | null = null

/**
 * Download + initialize the OR-Tools routing runtime once (idempotent). Safe to
 * call eagerly (e.g. on app load) to hide the WASM download behind setup time.
 */
export function warmUpSolver(): Promise<void> {
  if (!warmUpPromise) {
    warmUpPromise = (async () => {
      if (typeof window !== 'undefined' && window.crossOriginIsolated === false) {
        throw new Error(
          'This browser could not enable the isolation the optimizer needs. ' +
            'Please use the latest Chrome or Edge (or reload once).',
        )
      }
      setWorkerBridgeEnabled(false)
      await initRouting()
    })().catch((e) => {
      warmUpPromise = null
      throw e
    })
  }
  return warmUpPromise
}

export interface SolveOptions {
  /** Real node index that must be the route's start, or null to let the solver choose. */
  startNode: number | null
  /** Real node index that must be the route's end, or null to let the solver choose. */
  endNode: number | null
  /** Max number of candidate stops to visit (excludes fixed start/end). */
  k: number
  /** Wall-clock budget (ms) for the multi-start portfolio. Default 3000 (Deep). */
  timeBudgetMs?: number
  /** Optional progress hook: (attempts so far, best objective so far). */
  onProgress?: (attempts: number, bestObjective: number) => void
}

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Small deterministic PRNG (mulberry32) so noised restarts are reproducible. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * True objective of a visited real-node sequence, evaluated on the ORIGINAL
 * matrix: traversal cost + SKIP_PENALTY per unvisited candidate. This mirrors
 * OR-Tools' objective (the virtual depot arcs are zero), and — crucially — lets
 * us compare a solution produced on a NOISED matrix against the real one.
 */
function objectiveOf(visited: number[], matrix: number[][], n: number): number {
  if (visited.length === 0) return Infinity
  let sum = 0
  for (let i = 0; i < visited.length - 1; i++) {
    sum += matrix[visited[i]][visited[i + 1]]
  }
  // Fixed endpoints are always visited, so unvisited candidates = n − visited.
  const skipped = n - visited.length
  return sum + SKIP_PENALTY * skipped
}

/** Mean of the finite, off-diagonal arcs — the scale for GRASP noise. */
function meanArc(matrix: number[][]): number {
  const n = matrix.length
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const v = matrix[i][j]
      if (v < FORBIDDEN) {
        sum += v
        count++
      }
    }
  }
  return count > 0 ? sum / count : 1
}

/** A perturbed copy of the matrix: each real arc gets +[0, mag) integer noise. */
function noiseMatrix(matrix: number[][], mag: number, rng: () => number): number[][] {
  return matrix.map((row, i) =>
    row.map((v, j) =>
      i === j || v >= FORBIDDEN ? v : v + Math.floor(rng() * mag),
    ),
  )
}

/**
 * One construction: build the augmented graph (real nodes + virtual start/end
 * depots joined by zero-cost arcs to the allowed endpoints), select the best K
 * candidates via disjunctions, cap them with a capacity dimension, and solve with
 * a single first-solution strategy. Returns the visited REAL nodes in order, or
 * null if this strategy produced nothing for the model.
 */
async function runOnce(
  matrix: number[][],
  startNode: number | null,
  endNode: number | null,
  k: number,
  strategy: FirstSolutionStrategy,
): Promise<number[] | null> {
  const n = matrix.length
  const VS = n // virtual start depot
  const VE = n + 1 // virtual end depot
  const numNodes = n + 2
  const capacity = Math.max(0, Math.floor(k))

  const isFixedEndpoint = (node: number) => node === startNode || node === endNode

  const cost = (a: number, b: number): number => {
    if (a < n && b < n) return matrix[a][b]
    if (a === VS) return b < n && (startNode === null || b === startNode) ? 0 : FORBIDDEN
    if (b === VE) return a < n && (endNode === null || a === endNode) ? 0 : FORBIDDEN
    return FORBIDDEN
  }

  const manager = new RoutingIndexManager(numNodes, 1, [VS], [VE])
  const routing = new RoutingModel(manager)
  try {
    const transitIdx = routing.RegisterTransitCallback((fromIndex, toIndex) =>
      cost(manager.IndexToNode(fromIndex), manager.IndexToNode(toIndex)),
    )
    routing.SetArcCostEvaluatorOfAllVehicles(transitIdx)

    for (let node = 0; node < n; node++) {
      if (!isFixedEndpoint(node)) {
        routing.AddDisjunction([manager.NodeToIndex(node)], SKIP_PENALTY)
      }
    }

    const demandIdx = routing.RegisterUnaryTransitCallback((fromIndex) => {
      const node = manager.IndexToNode(fromIndex)
      if (node >= n) return 0 // virtual depots
      return isFixedEndpoint(node) ? 0 : 1
    })
    routing.AddDimensionWithVehicleCapacity(demandIdx, 0, [capacity], true, 'StopCounter')

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
    // Some strategies (e.g. CHRISTOFIDES/SAVINGS) can reject a model with optional
    // nodes; skip them rather than aborting the whole search.
    return null
  } finally {
    routing.delete()
    manager.delete()
  }
}

/**
 * Optimize a route over an integer cost matrix, selecting the best K candidate
 * stops and ordering them, with fixed OR free start/end (two virtual depot nodes
 * joined by zero-cost arcs to the allowed endpoints):
 *
 *   - both fixed  -> classic fixed-endpoint route
 *   - one fixed   -> open at the other end
 *   - both free   -> fully open path (upload-and-go)
 *
 * Search strategy: because the WASM binding exposes no metaheuristic or time
 * limit, we run a JS-side, time-boxed MULTI-START — a portfolio of constructive
 * heuristics followed by GRASP-style noised restarts — and keep the lowest true
 * objective. This escapes the start-anchored greedy optimum that a single
 * PATH_CHEAPEST_ARC pass falls into.
 *
 * Returns the visited REAL node indices in order (actual start first, end last).
 */
export async function solveSelectiveTSP(
  matrix: number[][],
  { startNode, endNode, k, timeBudgetMs, onProgress }: SolveOptions,
): Promise<number[]> {
  const n = matrix.length
  if (n < 2) throw new Error('Need at least two points to build a route.')

  const budget = Math.max(0, timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS)

  await warmUpSolver()
  await yieldToEventLoop() // let the "Optimizing…" status paint before we block

  const deadline = Date.now() + budget
  let best: number[] | null = null
  let bestObj = Infinity
  let attempts = 0
  let sinceImprovement = 0

  const consider = (visited: number[] | null) => {
    if (!visited || visited.length === 0) return
    attempts++
    const obj = objectiveOf(visited, matrix, n)
    if (obj < bestObj) {
      bestObj = obj
      best = visited
      sinceImprovement = 0
    } else {
      sinceImprovement++
    }
    onProgress?.(attempts, bestObj)
  }

  // The budget is a CEILING, not a fixed spend: once the restart pass has gone a
  // while with no improvement, we've converged, so stop early (keeps trivial
  // inputs snappy). Patience scales with problem size — harder instances (more
  // nodes) get more restarts before we call it converged.
  const patience = Math.max(30, 3 * n)

  // Pass 1 — each distinct constructive heuristic once, on the clean matrix.
  // PATH_CHEAPEST_ARC (index 0) always runs, guaranteeing at least a baseline.
  for (let s = 0; s < PORTFOLIO.length; s++) {
    consider(await runOnce(matrix, startNode, endNode, k, PORTFOLIO[s]))
    if (s > 0 && Date.now() >= deadline && best) break
    await yieldToEventLoop()
  }

  // Pass 2 — GRASP-style noised restarts to spend the rest of the budget,
  // diversifying away from any single local optimum. Each result is scored on
  // the ORIGINAL matrix, so noise only perturbs the construction, never the cost.
  const noiseMag = Math.max(1, Math.round(meanArc(matrix) * NOISE_FRACTION))
  const rng = makeRng(0x9e3779b9)
  let i = 0
  sinceImprovement = 0
  while (
    Date.now() < deadline &&
    attempts < MAX_ATTEMPTS &&
    sinceImprovement < patience
  ) {
    const strategy = PORTFOLIO[i % PORTFOLIO.length]
    const perturbed = noiseMatrix(matrix, noiseMag, rng)
    consider(await runOnce(perturbed, startNode, endNode, k, strategy))
    i++
    await yieldToEventLoop()
  }

  if (!best) throw new Error('OR-Tools could not find a feasible route.')
  return best
}
