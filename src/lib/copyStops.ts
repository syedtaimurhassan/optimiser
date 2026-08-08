/**
 * Carrying stops from one route to another.
 *
 * Two features share this machinery, which is why it is a module and not a
 * handler: "Copy stops from a past route" on the empty state, and "Pick past
 * stops to carry over" when a route is created. They differ only in where the
 * selection UI lives.
 *
 * ── What is copied, and what is emphatically not ──────────────────────────
 *
 * A copied stop keeps its PLACE — coordinates and address — and nothing else.
 * Status, status history, ETA and the immutable stop ID are all properties of
 * the route the stop was on, not of the address, and carrying any of them
 * across would be a correctness bug rather than a convenience:
 *
 *   - status/history: yesterday's delivery is not delivered today. Copying a
 *     `delivered` stop into a new route would hide it behind a strikethrough
 *     before the driver has left the depot.
 *   - stopId/originalPosition: labels are allocated by the destination route,
 *     so that its own numbering stays dense and unique. Reusing the source's
 *     would collide on the first copy into a non-empty route.
 *
 * Notes, access codes, recipient and parcel counts DO come across. Those
 * describe the door, not the day — "code 4471, back entrance" is exactly as
 * true tomorrow, and re-typing it is the reason anyone copies a route at all.
 *
 * Pure module: no React, no store, no I/O.
 */

import type { AddressedStop, Route, StopStatus } from '../types.ts'

/** Which stops of the source route are offered. */
export type CopyFilter = 'all' | 'unfinished'

/**
 * Everything needed to create a stop on the destination route.
 *
 * Structurally the store's `NewStopInput` plus the carried-over detail fields;
 * kept as its own type so this module does not have to import the store, which
 * would invert the layering.
 */
export interface CopiedStop {
  lat: number
  lng: number
  address?: AddressedStop['address']
  recipient?: string
  notes?: string
  accessCodes?: string
  packageFinder?: string
  parcelCount?: number
  kind: AddressedStop['kind']
  /** The source stop's uuid, so a selection UI can key checkboxes on it. */
  sourceId: string
}

/**
 * Statuses that mean "this did not get done".
 *
 * `failed` is the explicit one. `pending` counts too: a route marked completed
 * with stops still pending means the driver ran out of day, and those are
 * precisely the ones tomorrow's route wants.
 */
const UNFINISHED: StopStatus[] = ['pending', 'failed']

export function isUnfinished(stop: AddressedStop): boolean {
  return UNFINISHED.includes(stop.status)
}

/** The stops of `route` eligible under `filter`, in route order. */
export function copyableStops(route: Route, filter: CopyFilter = 'all'): AddressedStop[] {
  return filter === 'unfinished' ? route.stops.filter(isUnfinished) : [...route.stops]
}

/** Strip a stop down to what may cross a route boundary. */
export function toCopiedStop(stop: AddressedStop): CopiedStop {
  return {
    lat: stop.lat,
    lng: stop.lng,
    address: stop.address,
    recipient: stop.recipient,
    notes: stop.notes,
    accessCodes: stop.accessCodes,
    packageFinder: stop.packageFinder,
    parcelCount: stop.parcelCount,
    kind: stop.kind,
    sourceId: stop.id,
  }
}

/**
 * Build the copy payload.
 *
 * `selectedIds` is optional: omitted means "everything the filter allows",
 * which is what the empty state's one-tap "Copy stops from a past route" does.
 * Supplying it is the checkbox flow.
 */
export function buildCopyPayload(
  route: Route,
  options: { filter?: CopyFilter; selectedIds?: Iterable<string> } = {},
): CopiedStop[] {
  const eligible = copyableStops(route, options.filter ?? 'all')
  if (!options.selectedIds) return eligible.map(toCopiedStop)

  const wanted = new Set(options.selectedIds)
  return eligible.filter((s) => wanted.has(s.id)).map(toCopiedStop)
}

/**
 * Routes worth offering as a copy source, best first.
 *
 * Ordered by date descending because the useful answer is almost always
 * "yesterday's round" or "the one I did last Tuesday", and never "the first
 * route I ever made". Routes with no stops are excluded — offering an empty
 * route as a source for stops is a dead end the user has to discover by
 * tapping it.
 */
export function copySourceRoutes(routes: Route[], excludeRouteId?: string): Route[] {
  return routes
    .filter((r) => r.id !== excludeRouteId && r.stops.length > 0)
    .sort((a, b) => (a.dateISO === b.dateISO ? b.updatedAt - a.updatedAt : b.dateISO.localeCompare(a.dateISO)))
}

/** "12 stops · 3 unfinished" — the subtitle on a source row. */
export function describeSource(route: Route): string {
  const total = route.stops.length
  const unfinished = route.stops.filter(isUnfinished).length
  const stops = `${total} ${total === 1 ? 'stop' : 'stops'}`
  // Only mention unfinished stops when that is actually a distinction — on a
  // draft route every stop is pending and saying so is noise.
  if (route.status !== 'completed' || unfinished === 0) return stops
  return `${stops} · ${unfinished} unfinished`
}
