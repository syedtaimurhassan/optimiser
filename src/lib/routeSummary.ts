import type { AddressedStop, OptimizedRoute } from '../types.ts'
import { liveEta } from './arrivals.ts'

/**
 * What is LEFT of the route — the three facts the summary strip states, and
 * the one the finish pill states.
 *
 * ── Two paths, and which one you get ──────────────────────────────────────
 *
 * EXACT, when the route was solved with per-leg times: the finish is the last
 * arrival in the plan, anchored to where the driver actually is, and the
 * distance is the sum of the legs still to drive. `lib/arrivals.ts` owns that
 * arithmetic.
 *
 * APPROXIMATE, for a route solved before M7 — `arrivalSec` is empty on those
 * and always will be, because nothing re-solves a route to backfill it. The
 * old estimate is kept for exactly that case: it scales the solved TOTAL by
 * the share of stops still pending, which is a straight line through a curve
 * and reads optimistically on a round whose long legs come last.
 *
 * Both live here rather than in a component because the same number appears in
 * two places at once — the pill over the map and the strip on the sheet — and
 * two different finish times on one screen is worse than one imperfect one.
 */

export interface RemainingRoute {
  /** "17:07", or null when the route has never been solved. */
  finishClock: string | null
  /** Stops still pending. Failures are finished with, so they do not count. */
  stopsLeft: number
  /** Metres still to drive, or null on an unsolved route. */
  metresLeft: number | null
  /** True when the underlying distance is a straight-line estimate. */
  estimated: boolean
}

export interface RemainingRouteInput {
  stops: readonly AddressedStop[]
  optimized: OptimizedRoute | undefined
  /** Now, in epoch ms. Passed in rather than read, so this stays pure. */
  nowMs: number
}

export function remainingRoute({ stops, optimized, nowMs }: RemainingRouteInput): RemainingRoute {
  const stopsLeft = stops.filter((s) => s.status === 'pending').length

  const solved =
    optimized &&
    Number.isFinite(optimized.durationSeconds) &&
    Number.isFinite(optimized.distanceMeters)

  if (!solved || !optimized) {
    return { finishClock: null, stopsLeft, metresLeft: null, estimated: false }
  }

  // The exact path. Available whenever the route was solved with per-leg
  // times, which is every route solved from M7 on.
  const live = liveEta({ optimized, stops, nowMs })
  if (live.finishMs !== null) {
    return {
      finishClock: clockAt(live.finishMs),
      stopsLeft,
      metresLeft: live.metresLeft ?? optimized.distanceMeters * shareLeft(stops, stopsLeft),
      estimated: Boolean(optimized.estimated),
    }
  }

  // A route solved before M7 has no arrivals and never will. The old estimate,
  // kept for exactly that case.
  const share = shareLeft(stops, stopsLeft)
  return {
    finishClock: clockAt(nowMs + optimized.durationSeconds * share * 1000),
    stopsLeft,
    metresLeft: optimized.distanceMeters * share,
    estimated: Boolean(optimized.estimated),
  }
}

/**
 * How much of the round is left, as a fraction.
 *
 * An empty route is "all of it left", not "none of it": a solved route with no
 * stops at all still has its endpoints to drive between.
 */
function shareLeft(stops: readonly AddressedStop[], stopsLeft: number): number {
  return stops.length > 0 ? stopsLeft / stops.length : 1
}

/**
 * Is the plan being read on a day it was not made for?
 *
 * ── Why this needs saying out loud ────────────────────────────────────────
 *
 * ETAs are anchored to NOW, not to the route's planned start — see
 * lib/arrivals.ts for why that is the only anchor a driver keeps believing.
 * The consequence is that a route solved on Tuesday morning and poked at
 * 19:23 on Tuesday evening reports a finish of 19:56, which is arithmetically
 * correct and looks like a bug.
 *
 * It is not a bug and it must not be silently corrected — a driver who set off
 * late needs times that moved with them. But the app has to say what it is
 * doing, in one line, or the driver concludes the clock is broken and stops
 * reading it. This is the test for when to say it.
 *
 * The threshold is a whole hour: a round genuinely running forty minutes late
 * is the normal case and needs no explanation.
 */
export const STALE_PLAN_SEC = 3600

export function planIsStale(route: { dateISO: string; updatedAt: number }, nowMs: number): boolean {
  const solvedToday = toLocalISODate(new Date(route.updatedAt)) === toLocalISODate(new Date(nowMs))
  if (!solvedToday) return true
  return nowMs - route.updatedAt > STALE_PLAN_SEC * 1000
}

/** Local calendar day, not UTC — the same rule `todayISO` follows. */
function toLocalISODate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

/** Epoch ms → "17:07" on the device's own clock, 24h, zero-padded. */
export function clockAt(epochMs: number): string {
  const at = new Date(epochMs)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/**
 * Metres → "11 km".
 *
 * Kilometres, not miles: OSRM returns metres and every address in this app is
 * metric. Below 10 km it keeps one decimal, because "0 km left" on a round
 * with a real leg remaining reads as a bug; above it, a decimal is noise.
 */
export function formatKm(metres: number | null): string | null {
  if (metres === null || !Number.isFinite(metres)) return null
  const km = metres / 1000
  return `${km < 10 ? Math.round(km * 10) / 10 : Math.round(km)} km`
}

/**
 * The strip's three facts, bullet-separated, as one accessible string.
 *
 * The component renders the segments itself so they can be styled apart; this
 * is what a screen reader is given, and what the smoke test asserts on.
 */
export function formatRemainingSummary(remaining: RemainingRoute): string {
  const parts: string[] = []
  if (remaining.finishClock) parts.push(`Finish ${remaining.finishClock}`)
  parts.push(`${remaining.stopsLeft} stop${remaining.stopsLeft === 1 ? '' : 's'}`)
  const distance = formatKm(remaining.metresLeft)
  if (distance) parts.push(distance)
  return parts.join(' · ')
}
