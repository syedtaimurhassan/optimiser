import {
  abortError,
  objectiveValue,
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
  type WorkerResponse,
} from './workerProtocol.ts'

/**
 * Tier B — the same TypeScript search, run N times in parallel from different
 * seeds, best answer wins.
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

/** One in-flight job's bookkeeping. */
interface Job {
  resolve: (result: SolveResult) => void
  reject: (error: Error) => void
  request: SolveRequest
  /** Best VALIDATED order seen so far, and what the referee scored it. */
  bestOrder: Int32Array | null
  bestObjective: number
  outstanding: number
  failures: string[]
  onProgress?: (progress: SolveProgress) => void
  bestReported: number
}

export class TsWorkerPool implements SolverEngine {
  readonly id = 'ts-workers'
  private readonly size: number
  private workers: Worker[] = []
  private nextJobId = 1
  private jobs = new Map<number, Job>()

  constructor(size: number) {
    this.size = Math.max(1, size)
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
      worker.onerror = () => {
        /* A dead worker is reported through its job's `failed`; nothing to do. */
      }
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
          if (objective < job.bestObjective) {
            job.bestObjective = objective
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

    job.outstanding--
    if (job.outstanding > 0) return
    this.jobs.delete(message.jobId)

    if (job.bestOrder) {
      job.resolve(toResult(job.request, job.bestOrder))
    } else {
      job.reject(new Error(job.failures[0] ?? 'Every solver worker failed.'))
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
    const jobId = this.nextJobId++
    const baseSeed = request.seed ?? 0x9e3779b9

    return new Promise<SolveResult>((resolve, reject) => {
      const job: Job = {
        resolve,
        reject,
        request,
        bestOrder: null,
        bestObjective: Infinity,
        outstanding: this.workers.length,
        failures: [],
        onProgress,
        bestReported: Infinity,
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
        const message = serialise(request, jobId, baseSeed + index * 0x9e3779b1)
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
function serialise(request: SolveRequest, jobId: number, seed: number): SolveWorkerRequest {
  const { matrix, constraints } = request
  return {
    type: 'solve',
    version: PROTOCOL_VERSION,
    jobId,
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
