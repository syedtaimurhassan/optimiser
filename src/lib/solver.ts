import { activeSelection } from './compute/active.ts'
import {
  SKIP_PENALTY,
  makeConstraints,
  toSolveMatrix,
} from './compute/solverPort.ts'

/**
 * Compatibility façade over the M9 port.
 *
 * ── What this used to be ──────────────────────────────────────────────────
 *
 * Until M9 this file WAS the solver: it built an OR-Tools routing model, ran a
 * hand-written portfolio of seven constructive heuristics under a JS-side time
 * budget, and knew that the WASM binding forwarded only `firstSolutionStrategy`.
 * All of that now lives behind `SolverEngine`, and the OR-Tools implementation
 * has moved to `compute/engineOrToolsLegacy.ts` where only dev builds can reach
 * it.
 *
 * ── Why it still exists ───────────────────────────────────────────────────
 *
 * Two callers still speak this shape, and rewriting them was not what M9 was
 * for. It is a boundary, not a layer: everything inside `compute/` uses flat
 * typed arrays, and this is the one place a `number[][]` is still accepted —
 * converted immediately, once, and never seen again.
 *
 * Slated for deletion. Nothing new should call it.
 */

export { SKIP_PENALTY }

/** Default wall-clock budget for a search. */
export const DEFAULT_TIME_BUDGET_MS = 3000

/**
 * Warm up whatever engine this device selected.
 *
 * Idempotent, and safe to ignore — an engine that has not been warmed up still
 * solves, just with the download or the worker spin-up on the critical path.
 *
 * Note what is NOT here any more: the `crossOriginIsolated` pre-check that used
 * to throw "please use the latest Chrome or Edge". No engine in the production
 * bundle needs SharedArrayBuffer, so the app no longer refuses to optimise on
 * a browser that declines to be isolated.
 */
export function warmUpSolver(): Promise<void> {
  return activeSelection().engine.warmUp()
}

export interface SolveOptions {
  /** Real node index that must be the route's start, or null for free. */
  startNode: number | null
  /** Real node index that must be the route's end, or null for free. */
  endNode: number | null
  /** Max number of candidate stops to visit (excludes fixed start/end). */
  k: number
  /** Wall-clock budget (ms). */
  timeBudgetMs?: number
  /** Progress hook, kept for signature compatibility. */
  onProgress?: (attempts: number, bestObjective: number) => void
  /** Cancels the solve. */
  signal?: AbortSignal
}

/**
 * Optimise over an integer cost matrix, returning the visited node indices in
 * order.
 *
 * The legacy signature, preserved. `matrix` is a jagged array of arrays and is
 * flattened on entry.
 */
export async function solveSelectiveTSP(
  matrix: number[][],
  { startNode, endNode, k, timeBudgetMs, onProgress, signal }: SolveOptions,
): Promise<number[]> {
  const n = matrix.length
  if (n < 2) throw new Error('Need at least two points to build a route.')

  const constraints = makeConstraints(n)
  if (startNode !== null) constraints.optional[startNode] = 0
  if (endNode !== null) constraints.optional[endNode] = 0

  const result = await activeSelection().engine.solve(
    {
      matrix: { n, durations: toSolveMatrix(matrix) },
      constraints,
      endpoints: { start: startNode, end: endNode },
      selectK: k,
      skipPenalty: SKIP_PENALTY,
      objective: 'duration',
      budgetMs: timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS,
    },
    onProgress ? (progress) => onProgress(progress.iterations, progress.bestCost) : undefined,
    signal,
  )

  return Array.from(result.order)
}
