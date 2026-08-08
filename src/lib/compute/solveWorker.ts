import { TsEngine } from './engineTs.ts'
import { abortError, type SolveRequest } from './solverPort.ts'
import {
  PROTOCOL_VERSION,
  type SolveWorkerRequest,
  type WorkerRequest,
  type WorkerResponse,
} from './workerProtocol.ts'

/**
 * One search, off the main thread.
 *
 * Deliberately thin: it owns no policy, picks no seed, and decides nothing
 * about how many workers there should be. The pool does all of that, so the
 * only thing that has to be true here is that a message in produces a result
 * out.
 *
 * ── Cancellation without shared memory ────────────────────────────────────
 *
 * M9 removed cross-origin isolation from the production build, so there is no
 * SharedArrayBuffer and therefore no flag the main thread can write while this
 * worker is mid-solve. What there IS, is a message queue: `solve` yields to the
 * event loop regularly (that is how it keeps a UI painting on the main thread),
 * and every yield here is a chance for a queued `cancel` to be delivered and
 * flip the AbortController.
 *
 * The yield interval is therefore also the cancellation latency — around 12ms,
 * which is well inside anything a person notices. M10's WASM engine cannot
 * yield mid-call and will chunk its solve instead, for exactly this reason.
 */

const engine = new TsEngine('ts-worker')
const controllers = new Map<number, AbortController>()

const post = (message: WorkerResponse, transfer: Transferable[] = []) => {
  ;(self as unknown as Worker).postMessage(message, transfer)
}

function rebuild(request: SolveWorkerRequest): SolveRequest {
  const { n } = request
  return {
    matrix: {
      n,
      durations: new Int32Array(request.durations),
      distances: request.distances ? new Int32Array(request.distances) : undefined,
    },
    constraints: {
      serviceTimeSec: new Int32Array(request.serviceTimeSec),
      twOpenSec: new Int32Array(request.twOpenSec),
      twCloseSec: new Int32Array(request.twCloseSec),
      order: new Uint8Array(request.order),
      optional: new Uint8Array(request.optional),
    },
    endpoints: { start: request.start, end: request.end },
    selectK: request.selectK,
    skipPenalty: request.skipPenalty,
    objective: request.objective,
    budgetMs: request.budgetMs,
    seed: request.seed,
    seedOrder: request.seedOrder ? new Int32Array(request.seedOrder) : undefined,
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  if (message.type === 'cancel') {
    controllers.get(message.jobId)?.abort()
    return
  }

  const { jobId } = message
  if (message.version !== PROTOCOL_VERSION) {
    post({
      type: 'failed',
      jobId,
      message: `Worker speaks protocol ${PROTOCOL_VERSION}, got ${message.version}.`,
      aborted: false,
    })
    return
  }

  const controller = new AbortController()
  controllers.set(jobId, controller)

  try {
    const request = rebuild(message)
    const result = await engine.solve(
      request,
      (progress) =>
        post({
          type: 'progress',
          jobId,
          bestCost: progress.bestCost,
          iterations: progress.iterations,
          elapsedMs: progress.elapsedMs,
        }),
      controller.signal,
    )

    // The order buffer is transferred, not cloned. It is small, but it is also
    // the shape M10 hands back out of WASM linear memory, and having the
    // protocol already be transfer-shaped is the point.
    const order = result.order.slice()
    post(
      { type: 'done', jobId, order: order.buffer as ArrayBuffer, objective: result.costSec },
      [order.buffer as ArrayBuffer],
    )
  } catch (e) {
    const error = e as Error
    post({
      type: 'failed',
      jobId,
      message: error?.message ?? String(e),
      aborted: error?.name === abortError().name,
    })
  } finally {
    controllers.delete(jobId)
  }
}
