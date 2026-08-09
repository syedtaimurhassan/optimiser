import {
  abortError,
  capacityFor,
  costMatrixFor,
  effectiveOptional,
  resolveEndpoints,
  toResult,
  type SolveProgress,
  type SolveRequest,
  type SolveResult,
  type SolverEngine,
} from './solverPort.ts'
import { WasmEngineModule, type EngineVariant } from './wasmModule.ts'

/**
 * The Rust engine, behind the same port as every other one.
 *
 * ── The host owns the clock ───────────────────────────────────────────────
 *
 * A wasm call cannot yield and cannot be interrupted. It also cannot read a
 * clock — `std::time` does not work on `wasm32-unknown-unknown` — and there is
 * no `SharedArrayBuffer` for a cancel flag, because M9 dropped cross-origin
 * isolation so that iOS Safari and Firefox would work at all.
 *
 * So the loop lives here. `step()` runs a bounded amount of work and returns;
 * between steps this file checks the deadline, checks the abort signal, reports
 * progress, and yields so a queued `cancel` message can actually be delivered.
 * Cancellation latency is one step, which is why the step is sized in
 * milliseconds rather than in iterations.
 *
 * ── The step size is measured, not guessed ────────────────────────────────
 *
 * A unit of work is roughly one node's candidate sweep, and how long that takes
 * varies by an order of magnitude between a desktop and a mid-range Android.
 * Guessing a fixed count would mean either a sloppy 200 ms cancellation on slow
 * hardware or a yield every 200 µs on fast hardware, where the yields
 * themselves become the bottleneck. So the budget is recalibrated after every
 * step from what the last one actually cost.
 *
 * The engine's own tests prove chunk size cannot change the answer: identical
 * routes at chunk sizes 1 through 100 000.
 */

/** How long one step should take. Also the cancellation latency. */
const STEP_TARGET_MS = 15

/** Clamp, so a mis-measurement cannot produce a step of 1 or of 10 million. */
const MIN_BUDGET = 32
const MAX_BUDGET = 4_000_000

/** Report progress at most this often. Cheap, but not free. */
const PROGRESS_INTERVAL_MS = 100

/**
 * Yield to the event loop.
 *
 * `MessageChannel` rather than `setTimeout(0)`: nested timeouts are clamped to
 * 4 ms, which against a 15 ms step would throw away a fifth of the budget doing
 * nothing. A channel message is a macrotask with no such clamp, so queued
 * messages — the `cancel` we are yielding for — still get delivered first.
 */
const yieldToEventLoop: () => Promise<void> =
  typeof MessageChannel === 'function'
    ? () =>
        new Promise((resolve) => {
          const channel = new MessageChannel()
          channel.port1.onmessage = () => {
            channel.port1.close()
            resolve()
          }
          channel.port2.postMessage(undefined)
        })
    : () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * `flags` bit 0 in `engine_create` — guided local search instead of iterated
 * local search. Kept next to the option that sets it so the two cannot drift.
 */
const FLAG_GLS = 1
const FLAG_HYBRID = 2

const STRATEGY_FLAGS: Record<'ils' | 'gls' | 'hybrid', number> = {
  ils: 0,
  gls: FLAG_GLS,
  hybrid: FLAG_HYBRID,
}

export interface WasmEngineOptions {
  /** Force an artefact instead of probing for SIMD. The bench compares both. */
  variant?: EngineVariant
  /**
   * Which escape from a local optimum.
   *
   * `ils` perturbs the ROUTE — double bridge, ruin-and-recreate, restarts.
   * `gls` perturbs the LANDSCAPE, raising the price of arcs the search keeps
   * choosing until the local optimum stops being one. Both are implemented so
   * the benchmark can settle which is better rather than the question being
   * decided by whichever was written first.
   */
  strategy?: 'ils' | 'gls' | 'hybrid'
  /**
   * Supply the artefact directly instead of fetching it.
   *
   * Node cannot `fetch` a `file:` URL, so the test suite reads the `.wasm` off
   * disk and hands it over — which is what lets the engine be cross-checked
   * against the TypeScript oracle without a browser. Lazy, so nothing is read
   * unless a solve actually happens.
   */
  bytes?: () => Promise<BufferSource>
}

export class WasmEngine implements SolverEngine {
  readonly id: string
  private readonly options: WasmEngineOptions
  private module: WasmEngineModule | null = null
  private loading: Promise<WasmEngineModule> | null = null

  constructor(id = 'wasm', options: WasmEngineOptions = {}) {
    this.id = id
    this.options = options
  }

  /**
   * Fetch and compile the artefact.
   *
   * Idempotent, and concurrent callers share one load — two solves starting
   * together must not fetch the engine twice.
   */
  async warmUp(): Promise<void> {
    await this.ensureModule()
  }

  private ensureModule(): Promise<WasmEngineModule> {
    if (this.module) return Promise.resolve(this.module)
    if (!this.loading) {
      this.loading = this.resolveSource()
        .then((options) => WasmEngineModule.load(options))
        .then((module) => {
          this.module = module
          return module
        })
        .catch((error) => {
          // Clear the latch so a transient network failure can be retried
          // rather than poisoning the engine for the rest of the session.
          this.loading = null
          throw error
        })
    }
    return this.loading
  }

  private async resolveSource(): Promise<{ variant?: EngineVariant; bytes?: BufferSource }> {
    const { variant, bytes } = this.options
    return { variant, bytes: bytes ? await bytes() : undefined }
  }

  /** Which artefact is loaded, for the diagnostics panel. Null until warm. */
  loadedVariant(): EngineVariant | null {
    return this.module?.variant ?? null
  }

  async solve(
    request: SolveRequest,
    onProgress?: (progress: SolveProgress) => void,
    signal?: AbortSignal,
  ): Promise<SolveResult> {
    const { n } = request.matrix
    if (n < 2) throw new Error('Need at least two points to build a route.')
    if (signal?.aborted) throw abortError()

    const module = await this.ensureModule()
    if (signal?.aborted) throw abortError()

    const { start, end } = resolveEndpoints(request)
    const driver = module.createDriver({
      n,
      // The engine sees ONE matrix — the one the objective is measured in.
      // Everything else a route is worth is computed by `toResult`, for every
      // engine, so no two engines can disagree about it.
      cost: costMatrixFor(request.matrix, request.objective),
      optional: effectiveOptional(request),
      selectK: request.selectK == null ? -1 : capacityFor(request),
      skipPenalty: request.skipPenalty,
      start: start ?? -1,
      end: end ?? -1,
      seed: (request.seed ?? 0x9e3779b9) >>> 0,
      seedOrder: request.seedOrder,
      flags: STRATEGY_FLAGS[this.options.strategy ?? 'ils'],
    })

    const startedAt = Date.now()
    const deadline = startedAt + Math.max(0, request.budgetMs)
    let budget = MIN_BUDGET * 8
    let lastProgress = 0

    const report = (force: boolean) => {
      if (!onProgress) return
      const now = Date.now()
      if (!force && now - lastProgress < PROGRESS_INTERVAL_MS) return
      lastProgress = now
      onProgress({
        bestCost: driver.bestObjective(),
        iterations: driver.iterations(),
        elapsedMs: now - startedAt,
      })
    }

    try {
      for (;;) {
        const before = Date.now()
        const finished = driver.step(budget)
        const elapsed = Date.now() - before

        report(false)

        if (finished) break
        if (Date.now() >= deadline) break

        /*
          Recalibrate. `elapsed` is integer milliseconds, so a step that came in
          under 1 ms measures as 0 and would make the ratio infinite — treat it
          as half a millisecond, which grows the budget fast without a divide by
          zero.
        */
        const ratio = STEP_TARGET_MS / Math.max(elapsed, 0.5)
        budget = Math.round(budget * Math.min(Math.max(ratio, 0.25), 4))
        budget = Math.min(Math.max(budget, MIN_BUDGET), MAX_BUDGET)

        await yieldToEventLoop()
        if (signal?.aborted) throw abortError()
      }

      report(true)
      return toResult(request, driver.best())
    } finally {
      // Including on the cancellation path. A driver that outlives its solve is
      // several megabytes of linear memory that never comes back — and linear
      // memory cannot shrink, so the leak is permanent for the page.
      driver.destroy()
    }
  }
}

/** Tier C: the Rust engine, single-threaded. */
export const engineWasm = new WasmEngine('wasm')
