import type { AddressedStop, Route } from '../types.ts'

/**
 * The order a route's stops actually happen in.
 *
 * ── Why this is its own module ────────────────────────────────────────────
 *
 * "Solved order when there is one, entry order otherwise" is a rule, not a
 * detail, and M5 gives it a second caller: the map already needs it to decide
 * which stop is next and where the grey polyline ends, and the route list now
 * needs it to number the rows. Two copies of a fallback rule drift silently —
 * the list would number stops 1..44 in entry order while the map called a
 * different one "next", and nothing would look broken enough to notice.
 */

/** What both functions need. Deliberately narrower than a whole `Route`. */
export type OrderableRoute = Pick<Route, 'stops' | 'optimized'>

/**
 * The stops in SOLVED order, or empty when the route has never been solved.
 *
 * Two things are dropped along the way, and both matter:
 *
 *  - `null` entries, which are endpoints that are not themselves stops;
 *  - ids with no surviving stop, because a stop deleted since the last
 *    optimisation is still named in `orderedStopIds`. Without this it would
 *    reappear in the itinerary as an undefined row, or resurrect as the stop
 *    the driver is told to visit next.
 */
export function solvedOrder(route: OrderableRoute): AddressedStop[] {
  if (!route.optimized) return []
  const byId = new Map(route.stops.map((s) => [s.id, s]))
  const out: AddressedStop[] = []
  for (const id of route.optimized.orderedStopIds) {
    if (id === null) continue
    const stop = byId.get(id)
    if (stop) out.push(stop)
  }
  return out
}

/**
 * The order the day happens in: solved when there is a solve, entry order
 * otherwise.
 *
 * An unsolved route is not orderless — it is in the order the stops were
 * added, which is the order the file listed them, and that is the only honest
 * sequence to show before an optimisation has run.
 */
export function visitOrder(route: OrderableRoute): AddressedStop[] {
  const solved = solvedOrder(route)
  return solved.length > 0 ? solved : route.stops
}
