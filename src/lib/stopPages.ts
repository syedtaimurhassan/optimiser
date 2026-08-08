import type { AddressedStop, LatLng, Route } from '../types.ts'
import { visitOrder } from './routeOrder.ts'
import { formatLatLng } from './coordinates.ts'

/**
 * The stop carousel's pages, as data.
 *
 * ── Why the end location is a page and not a screen ───────────────────────
 *
 * The brief calls end-location detail "a distinct sheet, different grammar",
 * and the grammar genuinely is different — no counter, no group dot, no ID,
 * and the wide button is "Route completed" rather than "Navigate". But it is
 * still the thing that comes after the last stop, and a driver reaches it by
 * swiping on from stop 44. Making it a separate surface would mean the swipe
 * that has worked 43 times in a row suddenly does something else at the end of
 * the route.
 *
 * So it is the last page of the same carousel, rendered by a different card.
 * One paging surface, two grammars.
 *
 * ── Order ─────────────────────────────────────────────────────────────────
 *
 * `visitOrder` — solved order when the route has been solved, entry order
 * otherwise. The same function the list and the map use, so the carousel
 * cannot disagree with the row a driver tapped to open it.
 */

/**
 * The end page's id, as it appears in `/route/:routeId/stop/end`.
 *
 * Cannot collide with a stop: ids come from `crypto.randomUUID`, which is 36
 * characters. Resolution tries stops FIRST regardless, so a hand-seeded
 * fixture with a stop literally called "end" still wins.
 */
export const END_PAGE_ID = 'end'

export interface StopPageStop {
  kind: 'stop'
  id: string
  stop: AddressedStop
  /** 1-based position in the route — the "38" of "38/44". */
  position: number
  /** How many stops the route has — the "44". */
  total: number
}

export interface StopPageEnd {
  kind: 'end'
  id: typeof END_PAGE_ID
  point: LatLng
}

export type StopPage = StopPageStop | StopPageEnd

/**
 * Every page, in the order a swipe walks them.
 *
 * A route with no end anchor has no end page: "End location, 17:07" for a
 * place the driver never told us about would be an invention. An `open` route
 * likewise — the optimiser picked where to finish, and it is not an address.
 */
export function buildStopPages(route: Pick<Route, 'stops' | 'optimized' | 'end'>): StopPage[] {
  const ordered = visitOrder(route)
  const pages: StopPage[] = ordered.map((stop, index) => ({
    kind: 'stop',
    id: stop.id,
    stop,
    position: index + 1,
    total: ordered.length,
  }))
  if (route.end) pages.push({ kind: 'end', id: END_PAGE_ID, point: route.end })
  return pages
}

/** Where `id` sits in the page list, or -1 when it names nothing. */
export function pageIndexById(pages: readonly StopPage[], id: string | null): number {
  if (!id) return -1
  return pages.findIndex((page) => page.id === id)
}

/**
 * The peek pill's label — what is behind you, in words.
 *
 * The pill exists to answer "what did I just come from" without a tap, so a
 * stop gets its immutable label and its address; the end page gets the phrase
 * that names it. A coordinate-only stop falls back to its coordinates rather
 * than rendering a bare ID chip with nothing beside it.
 */
export function pageLabel(page: StopPage): string {
  if (page.kind === 'end') return 'End location'
  const title =
    page.stop.address?.title?.trim() ||
    formatLatLng({ lat: page.stop.lat, lng: page.stop.lng })
  return `${page.stop.stopId} ${title}`.trim()
}

/** The coordinate a page's camera should centre on. */
export function pagePoint(page: StopPage): LatLng {
  return page.kind === 'end' ? page.point : { lat: page.stop.lat, lng: page.stop.lng }
}
