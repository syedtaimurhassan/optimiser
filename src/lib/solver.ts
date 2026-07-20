import {
  initRouting,
  RoutingIndexManager,
  RoutingModel,
  DefaultRoutingSearchParameters,
  FirstSolutionStrategy,
  setWorkerBridgeEnabled,
} from 'or-tools-wasm/routing'

/**
 * Penalty for leaving an intermediate stop unvisited. It must dwarf any real
 * travel-time arc so the solver only ever skips a stop because the K capacity
 * forces it to — never because skipping is "cheaper".
 */
export const SKIP_PENALTY = 10_000_000

// The OR-Tools routing WASM (~16 MB) is downloaded on first use. We warm it up
// once, in the background, so the first "Calculate" isn't stuck waiting on it.
let warmUpPromise: Promise<void> | null = null

/**
 * Download + initialize the OR-Tools routing runtime once (idempotent). Safe to
 * call eagerly (e.g. on app load) to hide the WASM download behind setup time,
 * and again from the solver — both share the same promise.
 *
 * GitHub Pages can't send the COOP/COEP headers that SharedArrayBuffer / threaded
 * WASM require, so we disable the worker bridge to use the single-threaded
 * (asyncify) build. `setWorkerBridgeEnabled` is called here (not at module top
 * level) so bundler tree-shaking can't drop it.
 */
export function warmUpSolver(): Promise<void> {
  if (!warmUpPromise) {
    warmUpPromise = (async () => {
      // The routing WASM needs SharedArrayBuffer, which only exists in a
      // cross-origin-isolated context. Our service worker provides that, but if
      // it's still false here the browser likely lacks COEP `credentialless`
      // support (e.g. older Safari). Fail fast with a clear message instead of
      // hanging forever on "loading-workers".
      if (typeof window !== 'undefined' && window.crossOriginIsolated === false) {
        throw new Error(
          'This browser could not enable the isolation the optimizer needs. ' +
            'Please use the latest Chrome or Edge (or reload once).',
        )
      }
      setWorkerBridgeEnabled(false)
      await initRouting()
    })().catch((e) => {
      warmUpPromise = null // allow a retry on the next call
      throw e
    })
  }
  return warmUpPromise
}

/**
 * Selective TSP: choose the best K intermediate stops (out of all candidates)
 * and order them, given an INTEGER travel-time matrix over the ordered points
 * `[start, ...candidates, end]` — so node 0 is the start and the last node is
 * the end.
 *
 * Returns the visited node indices in visiting order (start first, end last);
 * skipped candidates are omitted. Map indices back to coordinates in the caller
 * with `allPoints[i]`.
 *
 * Runs entirely in-browser via the OR-Tools WebAssembly routing solver.
 */
export async function solveSelectiveTSP(
  matrix: number[][],
  k: number,
): Promise<number[]> {
  const numNodes = matrix.length
  if (numNodes < 2) {
    throw new Error('Matrix must contain at least a start and an end node.')
  }

  const startNode = 0
  const endNode = numNodes - 1
  const capacity = Math.max(0, Math.floor(k)) // OR-Tools needs an integer capacity

  // Ensure the WASM runtime is loaded (shares the app's background warm-up).
  await warmUpSolver()

  // Yield once so any "Optimizing…" status can paint before the synchronous
  // solve briefly blocks the main thread.
  await new Promise((resolve) => setTimeout(resolve, 0))

  // 1 vehicle, fixed start node [0] and end node [N-1].
  const manager = new RoutingIndexManager(numNodes, 1, [startNode], [endNode])
  const routing = new RoutingModel(manager)

  try {
    // Arc cost = matrix duration. Callbacks receive solver indices, so convert
    // each back to its node before indexing the matrix.
    const transitIdx = routing.RegisterTransitCallback((fromIndex, toIndex) => {
      const from = manager.IndexToNode(fromIndex)
      const to = manager.IndexToNode(toIndex)
      return matrix[from][to]
    })
    routing.SetArcCostEvaluatorOfAllVehicles(transitIdx)

    // Constraint 1: every intermediate stop is OPTIONAL. A disjunction with a
    // huge penalty lets the solver skip it (required to visit only K of N).
    for (let node = startNode + 1; node < endNode; node++) {
      routing.AddDisjunction([manager.NodeToIndex(node)], SKIP_PENALTY)
    }

    // Constraint 2: a "stop counter" dimension. Each intermediate node adds 1,
    // start/end add 0, and the single vehicle's capacity caps the count at K.
    const demandIdx = routing.RegisterUnaryTransitCallback((fromIndex) => {
      const node = manager.IndexToNode(fromIndex)
      return node === startNode || node === endNode ? 0 : 1
    })
    routing.AddDimensionWithVehicleCapacity(
      demandIdx,
      0, // no slack
      [capacity], // vehicle capacity = K
      true, // start cumul fixed to zero
      'StopCounter',
    )

    // NOTE: this package's search parameters expose NO time limit (only
    // firstSolutionStrategy / solution_limit). PATH_CHEAPEST_ARC yields a good
    // route and the search terminates at a local optimum on its own — sub-second
    // for the sizes the public OSRM matrix allows (<= ~98 stops).
    const params = DefaultRoutingSearchParameters()
    params.firstSolutionStrategy = FirstSolutionStrategy.PATH_CHEAPEST_ARC

    const solution = await routing.SolveWithParameters(params)
    if (!solution) {
      throw new Error('OR-Tools could not find a feasible route for this K.')
    }

    // Walk start -> ... -> end, collecting visited nodes in order.
    const visited: number[] = []
    let index = routing.Start(0)
    visited.push(manager.IndexToNode(index))
    while (!routing.IsEnd(index)) {
      index = solution.Value(routing.NextVar(index))
      visited.push(manager.IndexToNode(index))
    }
    return visited
  } finally {
    // Always release the native WASM handles.
    routing.delete()
    manager.delete()
  }
}
