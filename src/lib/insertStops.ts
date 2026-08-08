import type { CostFn } from './costMatrix.ts'

/**
 * "Update route" — put the new stops in without moving anything else.
 *
 * ── The whole point, stated once ──────────────────────────────────────────
 *
 * The driver has sorted the parcels in the van to match the sequence on their
 * screen. So the existing sequence is FROZEN and the new stops are dropped
 * into the cheapest gap in it. Every stop that was 22nd is still 22nd; every
 * label already written on a box still means what it meant.
 *
 * This is not a worse optimiser. It is a different question. "Reoptimise" asks
 * what the best route is; this asks what the best route is GIVEN that the van
 * is already packed, and the second question is the one a driver at a kerb is
 * actually asking.
 *
 * ── The arithmetic ───────────────────────────────────────────────────────
 *
 *     insertion cost at gap i = d(prev, new) + d(new, next) − d(prev, next)
 *
 * What the detour actually costs, not what the two new legs cost. O(n) per
 * inserted stop over the cached matrix, no solver call, and no matrix fetch
 * beyond the one row and one column the new point needs.
 *
 * ── Feasibility ──────────────────────────────────────────────────────────
 *
 * A gap is feasible when every stop downstream still makes its time window.
 * Arriving early is not a violation — the driver waits — so the forward pass
 * pushes the clock to the opening time rather than failing. Arriving late is,
 * because no amount of waiting fixes it.
 *
 * When NO gap is feasible the stop is still placed, at the cheapest one, and
 * the result says so. Refusing to place it would leave the driver holding a
 * parcel with nowhere for it to go, which is worse than a route that admits
 * one window is going to be missed.
 *
 * Pure module: no React, no store, no I/O. Everything it needs about a stop
 * arrives through the three callbacks.
 */

export interface StopTiming {
  /** How long the driver spends here. Zero for an endpoint that is not a stop. */
  serviceSec: number
  /** Seconds from local midnight. */
  twOpenSec?: number
  twCloseSec?: number
}

export interface InsertContext {
  /**
   * The frozen sequence, as matrix keys — endpoints included, in order.
   * See lib/costMatrix.ts for what a key is.
   */
  sequence: readonly string[]
  cost: CostFn
  /** Driving seconds between two keys. The same as `cost` on a duration route. */
  durationSec: CostFn
  timing: (key: string) => StopTiming
  /** True when `sequence[0]` is a pinned start and nothing may precede it. */
  pinnedFirst: boolean
  /** True when the last entry is a pinned end and nothing may follow it. */
  pinnedLast: boolean
  /** Departure from the first point, seconds from local midnight. */
  departSec: number
}

/** What a gap costs, or null when the matrix cannot price it. */
export function insertionCost(
  cost: CostFn,
  prev: string | undefined,
  next: string | undefined,
  key: string,
): number | null {
  if (prev === undefined && next === undefined) return 0
  // At an open end there is only one new leg and no old one to subtract: the
  // detour IS the leg. Subtracting a d(prev,next) that does not exist would
  // make an open end look free and win every time.
  if (prev === undefined) return cost(key, next!) ?? null
  if (next === undefined) return cost(prev, key) ?? null

  const into = cost(prev, key)
  const outOf = cost(key, next)
  const displaced = cost(prev, next)
  if (into === null || outOf === null || displaced === null) return null
  return into + outOf - displaced
}

export interface Arrivals {
  /** Arrival per sequence entry, seconds from local midnight. */
  arrivalSec: number[]
  /** Every time window along the sequence is still satisfied. */
  feasible: boolean
}

/**
 * One forward pass: drive, wait if early, serve, drive on.
 *
 * The same shape as `lib/arrivals.cumulativeArrivals`, and deliberately NOT a
 * call to it — that one produces seconds from route start and knows nothing
 * about waiting or windows, which are exactly what feasibility turns on.
 */
export function arrivalsAlong(ctx: InsertContext, sequence: readonly string[]): Arrivals {
  const arrivalSec: number[] = []
  let feasible = true
  let clock = ctx.departSec

  for (let i = 0; i < sequence.length; i++) {
    if (i > 0) clock += ctx.durationSec(sequence[i - 1], sequence[i]) ?? 0
    const timing = ctx.timing(sequence[i])
    // Early is not late. The driver waits for the door to open, and every
    // arrival downstream is pushed out by the wait.
    if (timing.twOpenSec !== undefined && clock < timing.twOpenSec) clock = timing.twOpenSec
    if (timing.twCloseSec !== undefined && clock > timing.twCloseSec) feasible = false
    arrivalSec.push(clock)
    clock += timing.serviceSec
  }

  return { arrivalSec, feasible }
}

export interface Insertion {
  /** Where in the sequence the stop goes — a splice index. */
  index: number
  cost: number
  /** False when no gap kept every window; the stop is placed anyway. */
  feasible: boolean
}

/** The gaps a stop may go into, honouring pinned endpoints. */
function gapRange(ctx: InsertContext): [number, number] {
  const lo = ctx.pinnedFirst ? 1 : 0
  const hi = ctx.pinnedLast ? ctx.sequence.length - 1 : ctx.sequence.length
  return [lo, Math.max(lo, hi)]
}

/**
 * The cheapest feasible gap for one stop.
 *
 * Ties go to the EARLIER gap. Not arbitrary: two gaps of equal detour cost
 * mean the same driving either way, and the earlier one gets the parcel out of
 * the van sooner — which matters if anything later goes wrong.
 */
export function cheapestInsertion(ctx: InsertContext, key: string): Insertion {
  const [lo, hi] = gapRange(ctx)

  let best: Insertion | null = null
  let bestInfeasible: Insertion | null = null

  for (let index = lo; index <= hi; index++) {
    const price = insertionCost(ctx.cost, ctx.sequence[index - 1], ctx.sequence[index], key)
    if (price === null) continue

    const candidate = [...ctx.sequence.slice(0, index), key, ...ctx.sequence.slice(index)]
    const { feasible } = arrivalsAlong(ctx, candidate)
    const insertion: Insertion = { index, cost: price, feasible }

    if (feasible) {
      if (!best || price < best.cost) best = insertion
    } else if (!bestInfeasible || price < bestInfeasible.cost) {
      bestInfeasible = insertion
    }
  }

  // Placed anyway, and honest about it. A parcel with nowhere to go is worse
  // than a route that admits one window will be missed.
  return best ?? bestInfeasible ?? { index: gapRange(ctx)[0], cost: 0, feasible: false }
}

export interface InsertAllResult {
  sequence: string[]
  /** Where each key ended up, by key. */
  placedAt: Record<string, number>
  feasible: boolean
}

/**
 * Insert every new stop, cheapest first.
 *
 * Sequential and greedy: each stop is priced against the sequence AS IT NOW
 * STANDS, including the ones inserted before it. Pricing them all against the
 * original sequence would let two new stops both claim the same gap and both
 * be charged as though the other were not there.
 */
export function insertAll(ctx: InsertContext, keys: readonly string[]): InsertAllResult {
  let sequence = [...ctx.sequence]
  const placedAt: Record<string, number> = {}
  let feasible = true

  for (const key of keys) {
    const insertion = cheapestInsertion({ ...ctx, sequence }, key)
    sequence = [...sequence.slice(0, insertion.index), key, ...sequence.slice(insertion.index)]
    placedAt[key] = insertion.index
    if (!insertion.feasible) feasible = false
  }

  return { sequence, placedAt, feasible }
}

/**
 * Apply a pinned move: take the stop out, put it back at `toIndex`.
 *
 * `toIndex` is a position among the STOPS, not among the sequence entries, so
 * a pinned start does not have to be counted by whoever asked for the move.
 */
export function applyMove(
  sequence: readonly string[],
  key: string,
  toIndex: number,
  pinnedFirst: boolean,
  pinnedLast: boolean,
): string[] {
  if (!sequence.includes(key)) return [...sequence]
  const without = sequence.filter((k) => k !== key)
  const lo = pinnedFirst ? 1 : 0
  const hi = without.length - (pinnedLast ? 1 : 0)
  const at = Math.min(Math.max(toIndex + lo, lo), Math.max(hi, lo))
  return [...without.slice(0, at), key, ...without.slice(at)]
}
