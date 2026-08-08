import type { Objective, OrderConstraint } from '../../types'

/**
 * The seam between the app and whatever is doing the arithmetic.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * Until M9 the pipeline called `solveSelectiveTSP(matrix: number[][])` directly,
 * so the app knew that its optimiser was OR-Tools, that OR-Tools wanted a
 * jagged array of arrays, and that it had to be warmed up before use. Replacing
 * the engine meant touching every one of those assumptions.
 *
 * Everything above this line now speaks only `SolveRequest` and `SolveResult`.
 * Everything below it is free to be TypeScript, WebAssembly, a worker pool, or
 * a remote service, and several of them can coexist and be compared.
 *
 * ── The shape is the point ────────────────────────────────────────────────
 *
 * `durations` is a FLAT `Int32Array`, indexed `m[i * n + j]`. Not `number[][]`.
 * This is not tidiness:
 *
 *   - a jagged array is n separate heap objects with n separate bounds checks,
 *     and the engine's inner loop reads one cell of it a few million times;
 *   - an `Int32Array` is one contiguous buffer, so it can be handed to a worker
 *     with `postMessage(buf, [buf])` — a pointer move, not a structured clone
 *     of a million boxed doubles;
 *   - and it is already the exact layout WASM linear memory wants, so M10 can
 *     copy it in with one `set()` rather than marshalling per row.
 *
 * The M0 audit found the current engine crossing the JS/WASM boundary once per
 * ARC EVALUATION. A flat buffer is the first half of never doing that again.
 *
 * ── Layering ──────────────────────────────────────────────────────────────
 *
 * Pure `lib/`: no React, no store, no DOM. Types only from `types.ts`, which is
 * itself only types.
 */

// ────────────────────────────────────────────────────────────── constants

/**
 * Penalty for leaving an optional stop unvisited. It must dwarf any real arc so
 * an engine only skips a stop when the K cap forces it to.
 *
 * Lives here rather than in an engine because it is part of the QUESTION, not
 * part of an answer: two engines that disagree about it are not comparable.
 */
export const SKIP_PENALTY = 10_000_000

/**
 * Sentinels for "no time window". Deliberately not `undefined` — these live in
 * `Int32Array`s, which cannot hold it, and a typed array of a nullable number
 * is a contradiction. `TW_NEVER` is well inside i32 so arithmetic on it cannot
 * overflow the way `2147483647` would.
 */
export const TW_ALWAYS = 0
export const TW_NEVER = 1_000_000_000

/** `order` codes, matching `OrderConstraint` in types.ts positionally. */
export const ORDER_AUTO = 0
export const ORDER_FIRST = 1
export const ORDER_LAST = 2

/** The declared `OrderConstraint` for an `order` byte. */
export const ORDER_NAMES: readonly OrderConstraint[] = ['auto', 'first', 'last']

// ─────────────────────────────────────────────────────────────── request

/**
 * The cost grid, flat and row-major.
 *
 * `durations` is always present and always SECONDS, because arrival times and
 * (from M11) time windows are meaningless without it. `distances` is METRES and
 * optional, because the app fetches one OSRM table per solve, not two.
 *
 * When `objective` is `'distance'` the caller must supply `distances`, and the
 * engine minimises those; `durations` still drives arrivals. `planRoute` fills
 * the gap with the 8 m/s convention this codebase already uses everywhere it
 * has metres and needs seconds — see `haversineCost` in costMatrix.ts.
 */
export interface SolveMatrix {
  n: number
  /** Seconds. `m[i * n + j]`, length n². */
  durations: Int32Array
  /** Metres. `m[i * n + j]`, length n². Required when objective is 'distance'. */
  distances?: Int32Array
}

/**
 * Per-node constraints, one entry per matrix index.
 *
 * All five arrays are length n and positionally aligned with the matrix. The
 * time-window fields are DECLARED AND IGNORED in M9 — M11 implements them, and
 * they are here now so that adding them is not a signature change that ripples
 * back through the pipeline.
 */
export interface StopConstraints {
  /** How long the driver stands at each node. Zero for a non-stop endpoint. */
  serviceTimeSec: Int32Array
  /** Seconds from local midnight. `TW_ALWAYS` when unconstrained. */
  twOpenSec: Int32Array
  /** Seconds from local midnight. `TW_NEVER` when unconstrained. */
  twCloseSec: Int32Array
  /** `ORDER_AUTO` | `ORDER_FIRST` | `ORDER_LAST`. */
  order: Uint8Array
  /** 1 when the node may be skipped, 0 when it must be visited. */
  optional: Uint8Array
}

/**
 * A driver's break. Declared for M11; ignored in M9.
 *
 * Deliberately a window plus a duration rather than a fixed time: a break is
 * "45 minutes somewhere between 11:30 and 14:00", and pinning it to a clock
 * time would make it a stop.
 */
export interface SolveBreak {
  earliestSec: number
  latestSec: number
  durationSec: number
}

/**
 * Pinned ends of the route, as matrix indices.
 *
 * Redundant with `constraints.order`, and that redundancy is resolved in
 * exactly one place: `resolveEndpoints()`. Both exist because the app thinks in
 * terms of "the route starts here" while the solver thinks in terms of per-node
 * constraints, and translating at the boundary beats translating at each use.
 */
export interface SolveEndpoints {
  start: number | null
  end: number | null
}

export interface SolveRequest {
  matrix: SolveMatrix
  constraints: StopConstraints
  endpoints: SolveEndpoints
  break?: SolveBreak
  /**
   * Visit at most this many OPTIONAL nodes, or null/undefined for all of them.
   *
   * Retained from the pre-M9 app, where "best K of N" was the headline feature.
   * The default is now visit-all; K is the option rather than the rule.
   */
  selectK?: number | null
  skipPenalty: number
  objective: Objective
  /** Wall-clock ceiling. An engine may finish early; it may not overrun. */
  budgetMs: number
  /** Seeds the engine's PRNG, so a run is reproducible. */
  seed?: number
}

// ──────────────────────────────────────────────────────────────── result

export interface SolveProgress {
  /** Objective of the best solution so far — arcs + skip penalties. */
  bestCost: number
  iterations: number
  elapsedMs: number
}

export interface SolveResult {
  /** Visited matrix indices, in visiting order. Pinned start first, end last. */
  order: Int32Array
  /** Length n. 1 where that node is in `order`. */
  visited: Uint8Array
  /** Driving seconds along `order`, excluding service time. */
  costSec: number
  /** Driving metres along `order`, or 0 when no distance matrix was supplied. */
  distanceM: number
  /** False when a time window is missed. Always true until M11. */
  feasible: boolean
  /** Total lateness in seconds. Always 0 until M11. */
  timeWarpSec: number
  /** Arrival at each entry of `order`, seconds from route start. */
  arrivalSec: Int32Array
}

/**
 * An engine.
 *
 * `warmUp` exists because an engine may have a multi-megabyte artefact to fetch
 * or a worker pool to spin up, and the app wants that happening during setup
 * rather than after the driver taps Calculate. It must be idempotent and it must
 * be safe to ignore — `solve` is required to work without it.
 *
 * `signal` is how a solve is cancelled. An engine that honours it must reject
 * with an `AbortError`, not resolve with a partial answer, because a caller
 * that asked to stop is not waiting for a worse route.
 */
export interface SolverEngine {
  readonly id: string
  warmUp(): Promise<void>
  solve(
    request: SolveRequest,
    onProgress?: (progress: SolveProgress) => void,
    signal?: AbortSignal,
  ): Promise<SolveResult>
}

// ─────────────────────────────────────────────────────────────── helpers

/**
 * Default constraints for a plain n-node problem: no service time, no windows,
 * no pinning, everything optional.
 *
 * Callers override the few fields they care about. Building the arrays here
 * rather than at each call site is what stops one caller from forgetting
 * `twCloseSec` and quietly getting a window that closes at midnight.
 */
export function makeConstraints(n: number): StopConstraints {
  const twCloseSec = new Int32Array(n)
  twCloseSec.fill(TW_NEVER)
  const optional = new Uint8Array(n)
  optional.fill(1)
  return {
    serviceTimeSec: new Int32Array(n),
    twOpenSec: new Int32Array(n),
    twCloseSec,
    order: new Uint8Array(n),
    optional,
  }
}

/** Build a flat matrix from the row-major arrays the network adapter returns. */
export function toSolveMatrix(rows: readonly (readonly number[])[]): Int32Array {
  const n = rows.length
  const flat = new Int32Array(n * n)
  for (let i = 0; i < n; i++) {
    const row = rows[i]
    for (let j = 0; j < n; j++) flat[i * n + j] = row?.[j] ?? 0
  }
  return flat
}

/**
 * Reconcile `endpoints` with `constraints.order` into one answer.
 *
 * `endpoints` wins where both speak, because it is what the app actually sets.
 * A genuine CONFLICT — two different nodes both claiming to be the start —
 * throws rather than picking one: silently dropping a pin would produce a route
 * that is subtly not the one that was asked for, and nothing downstream could
 * tell.
 */
export function resolveEndpoints(request: SolveRequest): SolveEndpoints {
  const { order } = request.constraints
  let start = request.endpoints.start
  let end = request.endpoints.end

  for (let i = 0; i < order.length; i++) {
    if (order[i] === ORDER_FIRST) {
      if (start !== null && start !== i) {
        throw new Error(`Two different stops are pinned to the start (${start} and ${i}).`)
      }
      start = i
    } else if (order[i] === ORDER_LAST) {
      if (end !== null && end !== i) {
        throw new Error(`Two different stops are pinned to the end (${end} and ${i}).`)
      }
      end = i
    }
  }

  if (start !== null && start === end) {
    throw new Error('The same stop is pinned to both the start and the end of the route.')
  }
  return { start, end }
}

/** The matrix an objective is measured in. */
export function costMatrixFor(matrix: SolveMatrix, objective: Objective): Int32Array {
  if (objective === 'distance') {
    if (!matrix.distances) {
      throw new Error('A distance objective needs a distance matrix.')
    }
    return matrix.distances
  }
  return matrix.durations
}

/** Sum of the arcs along a visiting order, in the given matrix. */
export function arcSum(cells: Int32Array, n: number, order: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < order.length - 1; i++) {
    sum += cells[order[i] * n + order[i + 1]]
  }
  return sum
}

/**
 * The referee.
 *
 * Engines are free to disagree about how they search. They are not free to
 * disagree about what a solution is WORTH, so no engine's self-reported cost is
 * ever compared against another's — both are re-scored here, and by the
 * identical formula in `bench/lib/objective.mjs`.
 *
 *     Σ arcs along the order  +  skipPenalty × unvisited optional nodes
 *
 * Mandatory nodes cannot be skipped, so they never contribute a penalty; if one
 * is missing the answer is invalid rather than expensive, which `validateOrder`
 * is what catches.
 */
export function objectiveValue(request: SolveRequest, order: ArrayLike<number>): number {
  const { matrix, constraints, skipPenalty } = request
  const cells = costMatrixFor(matrix, request.objective)
  const n = matrix.n

  const inRoute = new Uint8Array(n)
  for (let i = 0; i < order.length; i++) inRoute[order[i]] = 1

  let skipped = 0
  for (let i = 0; i < n; i++) {
    if (constraints.optional[i] === 1 && inRoute[i] === 0) skipped++
  }

  return arcSum(cells, n, order) + skipPenalty * skipped
}

/**
 * Structural validation, run before a result is allowed to be scored.
 *
 * A fast wrong answer is not a win. Returns the problems it found, empty when
 * the order is well-formed.
 */
export function validateOrder(request: SolveRequest, order: ArrayLike<number>): string[] {
  const problems: string[] = []
  const n = request.matrix.n
  const { optional } = request.constraints
  const { start, end } = resolveEndpoints(request)

  if (order.length === 0) {
    problems.push('empty route')
    return problems
  }

  const seen = new Uint8Array(n)
  for (let i = 0; i < order.length; i++) {
    const node = order[i]
    if (!Number.isInteger(node) || node < 0 || node >= n) {
      problems.push(`node index out of range: ${node}`)
      continue
    }
    if (seen[node] === 1) problems.push(`node visited twice: ${node}`)
    seen[node] = 1
  }

  for (let i = 0; i < n; i++) {
    if (optional[i] === 0 && seen[i] === 0) problems.push(`mandatory node ${i} was skipped`)
  }

  if (start !== null && order[0] !== start) {
    problems.push(`pinned start ${start} is not first (got ${order[0]})`)
  }
  if (end !== null && order[order.length - 1] !== end) {
    problems.push(`pinned end ${end} is not last (got ${order[order.length - 1]})`)
  }

  const cap = capacityFor(request)
  let optionalVisited = 0
  for (let i = 0; i < order.length; i++) {
    if (optional[order[i]] === 1) optionalVisited++
  }
  if (optionalVisited > cap) {
    problems.push(`K cap exceeded: visited ${optionalVisited} optional nodes, cap is ${cap}`)
  }

  return problems
}

/**
 * How many optional nodes may be visited.
 *
 * `selectK` null/undefined means all of them, which is M9's default. A K larger
 * than the number of optional nodes is clamped rather than rejected, because
 * "visit up to 50" of 12 stops is a coherent thing to ask.
 */
export function capacityFor(request: SolveRequest): number {
  const { optional } = request.constraints
  let optionalCount = 0
  for (let i = 0; i < optional.length; i++) optionalCount += optional[i]
  const k = request.selectK
  if (k === null || k === undefined) return optionalCount
  return Math.min(Math.max(Math.floor(k), 0), optionalCount)
}

/**
 * Arrival times along an order, from the DURATION matrix plus service time.
 *
 * Seconds from route start, so it needs no wall clock and no time zone. The
 * caller converts to a clock time if it wants one.
 */
export function arrivalsFor(request: SolveRequest, order: ArrayLike<number>): Int32Array {
  const { durations, n } = request.matrix
  const { serviceTimeSec } = request.constraints
  const arrivals = new Int32Array(order.length)
  let clock = 0
  for (let i = 0; i < order.length; i++) {
    if (i > 0) clock += durations[order[i - 1] * n + order[i]]
    arrivals[i] = clock
    clock += serviceTimeSec[order[i]]
  }
  return arrivals
}

/**
 * Package a finished order as a `SolveResult`.
 *
 * Every engine ends here, so `costSec`, `distanceM` and `arrivalSec` are
 * computed one way rather than once per engine.
 */
export function toResult(request: SolveRequest, order: Int32Array): SolveResult {
  const { matrix } = request
  const visited = new Uint8Array(matrix.n)
  for (let i = 0; i < order.length; i++) visited[order[i]] = 1

  return {
    order,
    visited,
    costSec: arcSum(matrix.durations, matrix.n, order),
    distanceM: matrix.distances ? arcSum(matrix.distances, matrix.n, order) : 0,
    feasible: true,
    timeWarpSec: 0,
    arrivalSec: arrivalsFor(request, order),
  }
}

/** Reject with the same shape the platform uses, so callers can `if (e.name === 'AbortError')`. */
export function abortError(): DOMException {
  return new DOMException('The solve was cancelled.', 'AbortError')
}

/** Small deterministic PRNG (mulberry32), so seeded runs reproduce exactly. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
