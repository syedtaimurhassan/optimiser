import type { AddressedStop, OptimizedRoute } from '../types.ts'

/**
 * What is LEFT of the route — the three facts the summary strip states, and
 * the one the finish pill states.
 *
 * ── Read this before quoting the finish time ──────────────────────────────
 *
 * The pipeline does not yet produce per-stop arrival times: `arrivalSec` is
 * still empty and filling it is M7's job. Until then the remaining drive is
 * approximated by scaling the solved TOTAL by the share of stops still
 * pending. That is a straight line through a curve — it ignores where in the
 * route the driver actually is, so it reads optimistically on a round whose
 * long legs come last.
 *
 * It is shown anyway because a rough finish time beats no finish time, and it
 * lives here rather than in the component because M5 puts the same number in
 * two places at once (the pill over the map, the strip on the sheet). Two
 * copies of an approximation drift, and two different finish times on one
 * screen is worse than one imperfect one.
 *
 * M7 should REPLACE this with real arrivals, not refine it.
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

  if (!solved) {
    return { finishClock: null, stopsLeft, metresLeft: null, estimated: false }
  }

  // An empty route is "all of it left", not "none of it": a solved route with
  // no stops at all still has its endpoints to drive between.
  const share = stops.length > 0 ? stopsLeft / stops.length : 1

  return {
    finishClock: clockAt(nowMs + optimized.durationSeconds * share * 1000),
    stopsLeft,
    metresLeft: optimized.distanceMeters * share,
    estimated: Boolean(optimized.estimated),
  }
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
