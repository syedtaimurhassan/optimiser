import type { Objective } from '../../types'

/**
 * The messages that cross the worker boundary.
 *
 * ── Why this is its own file ──────────────────────────────────────────────
 *
 * Both sides import it, and only this. A worker that imported the pool, or a
 * pool that imported the worker's module, would drag the entire engine into the
 * main-thread bundle — which is the one thing a worker exists to avoid.
 *
 * ── Why the request is flattened ──────────────────────────────────────────
 *
 * `SolveRequest` holds typed arrays inside nested objects. `postMessage` will
 * happily structured-clone that, but structured cloning COPIES, and copying an
 * n=1000 matrix is 4 MB per worker per solve. Flattening the buffers to the top
 * level is what makes them reachable as transferables, so the matrix moves as a
 * pointer and the sender's copy is neutered rather than duplicated.
 *
 * That is also why the pool sends each worker its OWN copy of the matrix: a
 * transferred buffer is gone from the sender, so N workers need N copies. It is
 * still one copy each rather than one clone each, and — from M10 — the same
 * shape that goes straight into WASM linear memory.
 */

/** Bumped when the shape changes, so a stale worker fails loudly. */
export const PROTOCOL_VERSION = 3

/**
 * Which engine the worker should run.
 *
 * The pool, not the worker, decides. A worker that chose for itself would have
 * to know about device capabilities and tiers, and there would be no way to ask
 * one worker for a TypeScript answer and another for a WebAssembly one — which
 * is exactly what the benchmark needs in order to compare them.
 */
export type WorkerEngineKind = 'ts' | 'wasm'

/**
 * Which escape from a local optimum this worker should use.
 *
 * The pool assigns them, so N workers are N genuinely different searches rather
 * than N runs of one search from different seeds. See `strategyFor`.
 */
export type WorkerStrategy = 'ils' | 'gls' | 'hybrid'

export interface SolveWorkerRequest {
  type: 'solve'
  version: number
  /** Correlates replies with requests; a late reply from a cancelled run is dropped. */
  jobId: number
  engine: WorkerEngineKind
  n: number
  durations: ArrayBuffer
  distances: ArrayBuffer | null
  serviceTimeSec: ArrayBuffer
  twOpenSec: ArrayBuffer
  twCloseSec: ArrayBuffer
  order: ArrayBuffer
  optional: ArrayBuffer
  seedOrder: ArrayBuffer | null
  start: number | null
  end: number | null
  selectK: number | null
  skipPenalty: number
  objective: Objective
  budgetMs: number
  seed: number
  /** Seconds from local midnight. Windows mean nothing without it. */
  departAtSec: number
  strategy: WorkerStrategy
}

export interface CancelWorkerRequest {
  type: 'cancel'
  jobId: number
}

export type WorkerRequest = SolveWorkerRequest | CancelWorkerRequest

export interface SolveWorkerProgress {
  type: 'progress'
  jobId: number
  bestCost: number
  iterations: number
  elapsedMs: number
}

export interface SolveWorkerDone {
  type: 'done'
  jobId: number
  /** Visited matrix indices, in order. */
  order: ArrayBuffer
  /** Objective this worker achieved. Re-scored by the pool, never trusted. */
  objective: number
}

export interface SolveWorkerFailed {
  type: 'failed'
  jobId: number
  message: string
  aborted: boolean
}

export type WorkerResponse = SolveWorkerProgress | SolveWorkerDone | SolveWorkerFailed
