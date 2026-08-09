import { engineTs } from './engineTs.ts'
import {
  DEFAULT_DEPART_SEC,
  abortError,
  compareResults,
  objectiveValue,
  scheduleFor,
  toResult,
  validateOrder,
  type SolveProgress,
  type SolveRequest,
  type SolveResult,
  type SolverEngine,
} from './solverPort.ts'
import {
  PROTOCOL_VERSION,
  type SolveWorkerRequest,
  type WorkerEngineKind,
  type WorkerResponse,
  type WorkerStrategy,
} from './workerProtocol.ts'

/**
 * Tier B — the same search, run N times in parallel from different seeds, best
 * answer wins.
 *
 * ── Which search is not this file's business ──────────────────────────────
 *
 * The pool is engine-agnostic: it is told `ts` or `wasm` at construction and
 * passes that along to every worker. Everything below — the seeding, the
 * re-validation, the failure handling — is identical either way, and it has to
 * be, because the benchmark's whole job is to compare two engines under the
 * same conditions. A pool that treated them differently would be measuring
 * itself.
 *
 * ── Why independent workers rather than one parallel search ───────────────
 *
 * Because a genuinely parallel search needs shared memory, shared memory needs
 * SharedArrayBuffer, and SharedArrayBuffer needs cross-origin isolation, which
 * M9 deliberately stopped requiring. Independent restarts need none of it: each
 * worker gets its own copy of the matrix and its own seed, and they never speak
 * to each other.
 *
 * This is also a better use of the hardware than it first appears. The search
 * is an iterated local search whose outcome depends heavily on where it starts,
 * so N seeds is not N times the same work — it is the multi-start the single
 * engine performs SEQUENTIALLY within its budget, done concurrently instead.
 * Four workers for one second beats one worker for four seconds, because each
 * of the four gets the full second of wall-clock.
 *
 * ── What it does NOT do ───────────────────────────────────────────────────
 *
 * It does not change the answer's shape, the constraints it honours, or
 * anything a user could name. A tier buys speed; see registry.ts.
 */

/** Never spawn more than this, however many cores are claimed. */
const MAX_WORKERS = 6

/**
 * Leave a core for the main thread.
 *
 * A phone that reports 8 cores rarely has 8 it will actually give you, and
 * saturating them makes the UI janky at precisely the moment the user is
 * watching a progress line. The route arrives no sooner if the frame it is
 * drawn in cannot be painted.
 */
export function workerCount(hardwareConcurrency: number | null): number {
  const cores = hardwareConcurrency ?? 2
  return Math.max(1, Math.min(MAX_WORKERS, cores - 1))
}

/**
 * Which search each worker runs.
 *
 * ── Extra cores are diversification, not speedup ──────────────────────────
 *
 * The research for this milestone settled that, and the numbers are blunt. iOS
 * Safari reports a constant `hardwareConcurrency` of 4 on every iPhone from the
 * 11 to the 17 — it is a fingerprinting defence, not a core count — so a phone
 * gets three workers whatever silicon it has. Under sustained load phones are
 * thermally limited rather than compute limited, and schedulers migrate work
 * onto efficiency cores as the temperature climbs. Three workers is therefore
 * not three times the search; it is three chances at a good one.
 *
 * So they should not all be the same search. Worker 0 runs the measured default;
 * the others alternate into guided local search and the hybrid, which M10 found
 * win on different instance sizes — ILS at n = 300, GLS at n = 1000, and ILS
 * finishing early at n = 100 with two thirds of the budget unspent. Running one
 * of each means the pool wins wherever any of them would have.
 *
 * Worker 0 is pinned to ILS deliberately: with a single worker the pool must
 * behave exactly like the single-threaded engine, or a one-core device would
 * silently get a different answer from a two-core one.
 */
const STRATEGY_ROTATION: readonly WorkerStrategy[] = ['ils', 'gls', 'hybrid']

export function strategyFor(index: number): WorkerStrategy {
  return STRATEGY_ROTATION[index % STRATEGY_ROTATION.length]
}

/**
 * What a `WorkerEvent` actually tells us, which is often very little — a
 * cross-origin worker failure is reported with every field blank.
 */
function describeWorkerError(event: ErrorEvent | Event): string {
  const error = event as ErrorEvent
  const detail = [error.message, error.filename && `at ${error.filename}`]
    .filter(Boolean)
    .join(' ')
  return detail ? `solver worker failed: ${detail}` : 'solver worker failed to start'
}

/** One in-flight job's bookkeeping. */
interface Job {
  resolve: (result: SolveResult) => void
  reject: (error: Error) => void
  request: SolveRequest
  /** Best VALIDATED order seen so far, and what the referee scored it. */
  bestOrder: Int32Array | null
  bestObjective: number
  /** Lateness of `bestOrder`. Beaten before cost — see `compareResults`. */
  bestWarp: number
  outstanding: number
  failures: string[]
  onProgress?: (progress: SolveProgress) => void
  bestReported: number
  signal?: AbortSignal
}

export class SolverWorkerPool implements SolverEngine {
  readonly id: string
  private readonly size: number
  private readonly engine: WorkerEngineKind
  private workers: Worker[] = []
  private nextJobId = 1
  private jobs = new Map<number, Job>()

  constructor(size: number, engine: WorkerEngineKind = 'ts', id?: string) {
    this.size = Math.max(1, size)
    this.engine = engine
    this.id = id ?? `${engine}-workers`
  }

  /**
   * Spin the workers up before they are needed.
   *
   * Worth doing during setup: constructing a Worker parses and compiles the
   * module, and paying for that after the driver taps Calculate is the whole
   * thing warm-up exists to avoid.
   */
  warmUp(): Promise<void> {
    try {
      this.ensureWorkers()
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e as Error)
    }
  }

  private ensureWorkers(): void {
    if (this.workers.length >= this.size) return
    while (this.workers.length < this.size) {
      // `new URL(..., import.meta.url)` is what keeps this working under the
      // '/optimiser/' base — Vite rewrites it to the hashed asset path. A bare
      // string would resolve against the document and 404 on Pages.
      const worker = new Worker(new URL('./solveWorker.ts', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data)
      /*
        A worker that never loads must not hang the app.

        This handler used to be empty, on the assumption that a dead worker
        would report itself through its job's `failed` message. It does not: a
        worker that 404s, is blocked by CSP, or fails to parse never runs our
        code at all, so it never posts anything. Its share of `outstanding`
        would then never be decremented and the solve promise would never
        settle — "Optimizing route…" forever, with no error and no timeout.
      */
      worker.onerror = (event) => this.loseWorker(worker, describeWorkerError(event))
      this.workers.push(worker)
    }
  }

  private receive(message: WorkerResponse): void {
    const job = this.jobs.get(message.jobId)
    // A reply for a job that already settled — a cancelled sibling finishing,
    // most often. Dropping it is the point of the id.
    if (!job) return

    if (message.type === 'progress') {
      if (message.bestCost < job.bestReported) {
        job.bestReported = message.bestCost
        job.onProgress?.({
          bestCost: message.bestCost,
          iterations: message.iterations,
          elapsedMs: message.elapsedMs,
        })
      }
      return
    }

    if (message.type === 'done') {
      const order = new Int32Array(message.order)
      /*
        The worker's own score is ignored.

        An engine never grades its own work — the same rule bench/lib/objective.mjs
        enforces across engines applies inside this one, because a worker that
        returned an invalid route with a wonderful objective would otherwise win
        every time.
      */
      try {
        const problems = validateOrder(job.request, order)
        if (problems.length === 0) {
          const objective = objectiveValue(job.request, order)
          /*
            Lateness beats cost, and it has to.

            N workers search from N seeds and the pool keeps the winner. Scored
            on cost alone, a worker that gave up on the windows wins every time —
            ignoring a constraint is always cheaper than honouring it — so the
            pool would systematically select the one answer that is wrong.
          */
          const { timeWarpSec } = scheduleFor(job.request, order)
          const incumbent = { timeWarpSec: job.bestWarp, objective: job.bestObjective }
          if (compareResults({ timeWarpSec, objective }, incumbent) < 0) {
            job.bestObjective = objective
            job.bestWarp = timeWarpSec
            job.bestOrder = order
          }
        } else {
          job.failures.push(`worker returned an invalid route: ${problems.join('; ')}`)
        }
      } catch (e) {
        // Scoring can throw on a malformed request (contradictory pins, a
        // distance objective with no distance matrix). Recorded as this
        // worker's failure rather than allowed to escape — an exception here
        // would leave `outstanding` un-decremented and the promise pending
        // forever, which is the one outcome worse than a bad route.
        job.failures.push((e as Error).message)
      }
    } else {
      job.failures.push(message.message)
    }

    this.settleOne(message.jobId, job)
  }

  /** One worker has reported in. Finish the job when the last one does. */
  private settleOne(jobId: number, job: Job): void {
    job.outstanding--
    if (job.outstanding > 0) return
    this.jobs.delete(jobId)

    if (job.bestOrder) {
      job.resolve(toResult(job.request, job.bestOrder))
      return
    }

    /*
      Every worker died and none of them produced a route, so answer in-process.

      Without this the FIRST solve after a bad deploy fails outright — the pool
      only discovers its workers are dead once they have failed to load, which
      is after the job has already been dispatched. Rejecting there would tell a
      driver at a kerb that routing is broken, when what is actually true is
      that it is about to be slower.
    */
    if (this.workers.length === 0 && !job.signal?.aborted) {
      /*
        Deliberately the TypeScript engine, even for a wasm pool.

        We are here because every worker died, and one likely reason is that
        the browser could not load a module from this origin at all. Answering
        with an engine that needs to fetch a 48 KB artefact to do anything
        would be betting on the same thing having just failed. `engineTs` needs
        nothing.
      */
      engineTs.solve(job.request, job.onProgress, job.signal).then(job.resolve, job.reject)
      return
    }

    job.reject(new Error(job.failures[0] ?? 'Every solver worker failed.'))
  }

  /**
   * A worker died. Drop it, and credit its share of every job in flight.
   *
   * Dropped rather than replaced: a worker that failed to load will fail to
   * load again, and respawning it would turn one broken URL into an infinite
   * loop of broken URLs.
   */
  private loseWorker(worker: Worker, message: string): void {
    const at = this.workers.indexOf(worker)
    if (at < 0) return
    this.workers.splice(at, 1)
    worker.terminate()

    for (const [jobId, job] of [...this.jobs]) {
      job.failures.push(message)
      this.settleOne(jobId, job)
    }
  }

  private cancel(jobId: number): void {
    for (const worker of this.workers) worker.postMessage({ type: 'cancel', jobId })
  }

  solve(
    request: SolveRequest,
    onProgress?: (progress: SolveProgress) => void,
    signal?: AbortSignal,
  ): Promise<SolveResult> {
    if (signal?.aborted) return Promise.reject(abortError())

    this.ensureWorkers()
    /*
      No workers left, so answer in-process instead of failing.

      A tier is supposed to buy speed and never capability (see registry.ts). A
      pool that cannot spawn workers has lost its speed; it has not earned the
      right to stop returning a route.
    */
    if (this.workers.length === 0) return engineTs.solve(request, onProgress, signal)

    const jobId = this.nextJobId++
    const baseSeed = request.seed ?? 0x9e3779b9

    return new Promise<SolveResult>((resolve, reject) => {
      const job: Job = {
        resolve,
        reject,
        request,
        bestOrder: null,
        bestObjective: Infinity,
        bestWarp: Infinity,
        outstanding: this.workers.length,
        failures: [],
        onProgress,
        bestReported: Infinity,
        signal,
      }
      this.jobs.set(jobId, job)

      const onAbort = () => {
        this.cancel(jobId)
        // Reject immediately rather than waiting for every worker to
        // acknowledge. A caller who cancelled is not waiting for a better
        // route, and the stragglers' replies are dropped by the id check.
        this.jobs.delete(jobId)
        reject(abortError())
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      this.workers.forEach((worker, index) => {
        const message = serialise(
          request,
          jobId,
          baseSeed + index * 0x9e3779b1,
          this.engine,
          strategyFor(index),
        )
        worker.postMessage(message, transferables(message))
      })
    })
  }

  /** Release the workers. Nothing calls this in the app; tests do. */
  dispose(): void {
    for (const worker of this.workers) worker.terminate()
    this.workers = []
    this.jobs.clear()
  }
}

/**
 * Flatten a request into transferable buffers.
 *
 * Every array is COPIED first (`.slice()`), because transferring neuters the
 * source and the caller's request must survive being handed to N workers — and
 * must still be scoreable by the referee when they come back.
 */
function serialise(
  request: SolveRequest,
  jobId: number,
  seed: number,
  engine: WorkerEngineKind,
  strategy: WorkerStrategy,
): SolveWorkerRequest {
  const { matrix, constraints } = request
  return {
    type: 'solve',
    version: PROTOCOL_VERSION,
    jobId,
    engine,
    n: matrix.n,
    durations: matrix.durations.slice().buffer as ArrayBuffer,
    distances: matrix.distances ? (matrix.distances.slice().buffer as ArrayBuffer) : null,
    serviceTimeSec: constraints.serviceTimeSec.slice().buffer as ArrayBuffer,
    twOpenSec: constraints.twOpenSec.slice().buffer as ArrayBuffer,
    twCloseSec: constraints.twCloseSec.slice().buffer as ArrayBuffer,
    order: constraints.order.slice().buffer as ArrayBuffer,
    optional: constraints.optional.slice().buffer as ArrayBuffer,
    seedOrder: request.seedOrder ? (request.seedOrder.slice().buffer as ArrayBuffer) : null,
    start: request.endpoints.start,
    end: request.endpoints.end,
    selectK: request.selectK ?? null,
    skipPenalty: request.skipPenalty,
    objective: request.objective,
    budgetMs: request.budgetMs,
    departAtSec: request.departAtSec ?? DEFAULT_DEPART_SEC,
    strategy,
    seed,
  }
}

function transferables(message: SolveWorkerRequest): Transferable[] {
  const buffers: Transferable[] = [
    message.durations,
    message.serviceTimeSec,
    message.twOpenSec,
    message.twCloseSec,
    message.order,
    message.optional,
  ]
  if (message.distances) buffers.push(message.distances)
  if (message.seedOrder) buffers.push(message.seedOrder)
  return buffers
}
