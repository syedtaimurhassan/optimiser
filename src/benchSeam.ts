/**
 * Benchmark test seam — DEV/BENCH BUILDS ONLY.
 *
 * This module is imported from main.tsx behind `import.meta.env.VITE_BENCH_SEAM`,
 * which Vite statically replaces at build time. In a normal production build the
 * flag is undefined, the branch is dead, and this file is dropped from the
 * bundle entirely — `npm run bench:verify-seam` asserts exactly that, so the
 * seam can never silently ship.
 *
 * The point of a seam rather than a benchmark entry point: the harness measures
 * the SAME artifact users download — same bundle, same lazy WASM fetch, same
 * host — instead of a lookalike built with different flags.
 *
 * Engines are registered by name so a future TypeScript or Rust core can be
 * measured against the OR-Tools baseline without the harness changing.
 */
import { solveSelectiveTSP, warmUpSolver, SKIP_PENALTY } from './lib/solver'
import { useRoutesStore } from './store/routesStore'
import { initRouting, setWorkerBridgeEnabled } from 'or-tools-wasm/routing'

export interface BenchSolveOptions {
  startNode: number | null
  endNode: number | null
  k: number
  timeBudgetMs?: number
}

export interface BenchSeam {
  /** Bumped when the seam's shape changes, so the harness can fail loudly. */
  version: number
  /**
   * The routes store, so acceptance tests can exercise the data model directly
   * — creating routes, inserting stops, transitioning statuses — without
   * needing UI that does not exist until M3.
   */
  routesStore: typeof useRoutesStore
  skipPenalty: number
  isCrossOriginIsolated: () => boolean
  warmUp: () => Promise<void>
  /**
   * Initialises the routing runtime WITHOUT src/lib/solver.ts's
   * `crossOriginIsolated` pre-check, so the benchmark can find out what the
   * WASM itself does when isolation is absent — rather than only re-discovering
   * our own guard. Bench-only; never called by the app.
   */
  warmUpUnguarded: () => Promise<void>
  engines: Record<
    string,
    (matrix: number[][], options: BenchSolveOptions) => Promise<number[]>
  >
}

declare global {
  interface Window {
    __bench?: BenchSeam
  }
}

window.__bench = {
  version: 2,
  routesStore: useRoutesStore,
  skipPenalty: SKIP_PENALTY,
  isCrossOriginIsolated: () => globalThis.crossOriginIsolated === true,
  warmUp: () => warmUpSolver(),
  warmUpUnguarded: async () => {
    setWorkerBridgeEnabled(false)
    await initRouting()
  },
  engines: {
    ortools: (matrix, options) => solveSelectiveTSP(matrix, options),
  },
}
