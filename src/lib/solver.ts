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
}

/**
 * Optimize a route over an integer cost matrix, selecting the best K candidate
 * stops and ordering them. Handles fixed OR free start/end via two virtual depot
 * nodes joined by zero-cost arcs to the allowed endpoints:
 *
 *   - both fixed  -> classic fixed-endpoint route
 *   - one fixed   -> open at the other end
 *   - both free   -> fully open path (upload-and-go)
 *
 * Returns the visited REAL node indices in order (actual start first, end last).
 */
export async function solveSelectiveTSP(
  matrix: number[][],
  { startNode, endNode, k }: SolveOptions,
): Promise<number[]> {
  const n = matrix.length
  if (n < 2) throw new Error('Need at least two points to build a route.')

  const VS = n // virtual start depot
  const VE = n + 1 // virtual end depot
  const numNodes = n + 2
  const capacity = Math.max(0, Math.floor(k))

  const isFixedEndpoint = (node: number) => node === startNode || node === endNode

  // Arc cost for the augmented graph (real nodes 0..n-1, plus VS and VE).
  const cost = (a: number, b: number): number => {
    if (a < n && b < n) return matrix[a][b]
    if (a === VS) return b < n && (startNode === null || b === startNode) ? 0 : FORBIDDEN
    if (b === VE) return a < n && (endNode === null || a === endNode) ? 0 : FORBIDDEN
    return FORBIDDEN
  }

  await warmUpSolver()
  await new Promise((resolve) => setTimeout(resolve, 0)) // let status paint

  const manager = new RoutingIndexManager(numNodes, 1, [VS], [VE])
  const routing = new RoutingModel(manager)

  try {
    const transitIdx = routing.RegisterTransitCallback((fromIndex, toIndex) =>
      cost(manager.IndexToNode(fromIndex), manager.IndexToNode(toIndex)),
    )
    routing.SetArcCostEvaluatorOfAllVehicles(transitIdx)

    // Candidate stops (everything except fixed endpoints) are optional...
    for (let node = 0; node < n; node++) {
      if (!isFixedEndpoint(node)) {
        routing.AddDisjunction([manager.NodeToIndex(node)], SKIP_PENALTY)
      }
    }

    // ...and capped at K via a stop-counter dimension.
    const demandIdx = routing.RegisterUnaryTransitCallback((fromIndex) => {
      const node = manager.IndexToNode(fromIndex)
      if (node >= n) return 0 // virtual depots
      return isFixedEndpoint(node) ? 0 : 1
    })
    routing.AddDimensionWithVehicleCapacity(demandIdx, 0, [capacity], true, 'StopCounter')

    const params = DefaultRoutingSearchParameters()
    params.firstSolutionStrategy = FirstSolutionStrategy.PATH_CHEAPEST_ARC

    const solution = await routing.SolveWithParameters(params)
    if (!solution) {
      throw new Error('OR-Tools could not find a feasible route.')
    }

    // Walk the tour, collecting real nodes in order (skip the virtual depots).
    const visited: number[] = []
    let index = routing.Start(0)
    while (!routing.IsEnd(index)) {
      const node = manager.IndexToNode(index)
      if (node < n) visited.push(node)
      index = solution.Value(routing.NextVar(index))
    }
    return visited
  } finally {
    routing.delete()
    manager.delete()
  }
}
