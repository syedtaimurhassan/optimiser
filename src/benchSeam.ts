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
 * ── What M9 changed ───────────────────────────────────────────────────────
 *
 * `engines` used to hold one entry that WAS the app's solver. Now every engine
 * is a `SolverEngine` behind the port, and OR-Tools is among them only here:
 * it is imported dynamically, from this dev-only module, so it cannot reach a
 * production bundle. It stays as the correctness ORACLE — the thing a new
 * engine's answers are checked against — until M15.
 */
import { useRoutesStore } from './store/routesStore'
import { useUiStore } from './store/uiStore'
import { engineTs } from './lib/compute/engineTs'
import { TsWorkerPool, workerCount } from './lib/compute/engineTsWorkers'
import {
  SKIP_PENALTY,
  makeConstraints,
  objectiveValue,
  toSolveMatrix,
  validateOrder,
  type SolveRequest,
  type SolverEngine,
} from './lib/compute/solverPort'
import { activeSelection } from './lib/compute/active'
import { claimedTier, describeSelection } from './lib/compute/registry'
import { detectAll } from './lib/device/capabilities'

export interface BenchSolveOptions {
  startNode: number | null
  endNode: number | null
  k: number
  timeBudgetMs?: number
  /** Milliseconds after which the run is cancelled. Omit for no cancellation. */
  cancelAfterMs?: number
  seed?: number
}

export interface BenchSolveOutcome {
  visited: number[]
  objective: number
  problems: string[]
  wallMs: number
  progressReports: number
  /** Only set when the run was cancelled. */
  aborted?: boolean
}

export interface BenchSeam {
  /** Bumped when the seam's shape changes, so the harness can fail loudly. */
  version: number
  routesStore: typeof useRoutesStore
  uiStore: typeof useUiStore
  skipPenalty: number
  isCrossOriginIsolated: () => boolean
  /** Which engine the registry picked here, and which tier the device claims. */
  describeEngine: () => Promise<{
    id: string
    tier: string
    claimed: string
    label: string
    degraded: boolean
  }>
  warmUp: () => Promise<void>
  /** Names of every engine this build can run. */
  engineIds: () => string[]
  /**
   * Solve one instance with one engine and report the raw result.
   *
   * Scoring happens here AND in Node against `bench/lib/objective.mjs`, because
   * an engine never grades its own work.
   */
  solve: (
    engineId: string,
    matrix: number[][],
    options: BenchSolveOptions,
  ) => Promise<BenchSolveOutcome>
}

declare global {
  interface Window {
    __bench?: BenchSeam
  }
}

/** Engines, built lazily — OR-Tools must not download 16 MB to be listed. */
const ENGINES: Record<string, () => Promise<SolverEngine>> = {
  ts: async () => engineTs,
  'ts-workers': async () => {
    if (!pool) pool = new TsWorkerPool(workerCount(navigator.hardwareConcurrency ?? null))
    return pool
  },
  /*
    The oracle.

    A dynamic import, so the OR-Tools chunk is only fetched when the benchmark
    actually asks for it — and so a static analysis of the production entry
    never reaches it at all.
  */
  ortools: async () => {
    const { OrToolsLegacyEngine } = await import('./lib/compute/engineOrToolsLegacy')
    return new OrToolsLegacyEngine()
  },
}

let pool: TsWorkerPool | null = null

function buildRequest(
  matrix: number[][],
  { startNode, endNode, k, timeBudgetMs, seed }: BenchSolveOptions,
): SolveRequest {
  const n = matrix.length
  const constraints = makeConstraints(n)
  if (startNode !== null) constraints.optional[startNode] = 0
  if (endNode !== null) constraints.optional[endNode] = 0
  return {
    matrix: { n, durations: toSolveMatrix(matrix) },
    constraints,
    endpoints: { start: startNode, end: endNode },
    selectK: k,
    skipPenalty: SKIP_PENALTY,
    objective: 'duration',
    budgetMs: timeBudgetMs ?? 3000,
    seed,
  }
}

window.__bench = {
  version: 4,
  routesStore: useRoutesStore,
  uiStore: useUiStore,
  skipPenalty: SKIP_PENALTY,
  isCrossOriginIsolated: () => globalThis.crossOriginIsolated === true,

  describeEngine: async () => {
    const caps = await detectAll()
    const selection = activeSelection()
    return {
      id: selection.engine.id,
      tier: selection.tier,
      claimed: claimedTier(caps),
      label: describeSelection(selection),
      degraded: selection.degraded,
    }
  },

  warmUp: () => activeSelection().engine.warmUp(),

  engineIds: () => Object.keys(ENGINES),

  solve: async (engineId, matrix, options) => {
    const build = ENGINES[engineId]
    if (!build) throw new Error(`unknown engine "${engineId}"`)
    const engine = await build()
    const request = buildRequest(matrix, options)

    const controller = new AbortController()
    if (options.cancelAfterMs !== undefined) {
      setTimeout(() => controller.abort(), options.cancelAfterMs)
    }

    let progressReports = 0
    const startedAt = performance.now()
    try {
      const result = await engine.solve(
        request,
        () => {
          progressReports++
        },
        controller.signal,
      )
      const visited = Array.from(result.order)
      return {
        visited,
        objective: objectiveValue(request, visited),
        problems: validateOrder(request, visited),
        wallMs: performance.now() - startedAt,
        progressReports,
      }
    } catch (e) {
      const error = e as Error
      if (error.name === 'AbortError') {
        return {
          visited: [],
          objective: Infinity,
          problems: [],
          wallMs: performance.now() - startedAt,
          progressReports,
          aborted: true,
        }
      }
      throw e
    }
  },
}
