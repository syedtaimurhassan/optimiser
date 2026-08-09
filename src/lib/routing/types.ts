/**
 * The routing seam.
 *
 * Everything above this file asks for "the driving time between these points"
 * and never names OSRM. The indirection is the same bet `lib/geocoding/`
 * already made, and it is load-bearing for a reason M12 measured rather than
 * assumed: **every provider's limits are different in a way the CALLER has to
 * plan around.**
 *
 * A matrix is not one request. It is a covering of the pairs we need by
 * rectangles the provider will accept, and the shape of that covering depends
 * entirely on numbers the provider declares:
 *
 *   OSRM demo   10,000 cells/request, 8,192-byte URL, ~1 req/s, GET
 *   Valhalla     2,500 cells/request, no URL ceiling,  ~1 req/s, POST
 *
 * Hide those behind a uniform `fetchMatrix(points)` and the caller cannot tell
 * whether it is about to make 3 requests or 40. So `limits` is part of the
 * interface, and `lib/routing/cover.ts` plans against it.
 *
 * Pure module: no React, no store, no I/O beyond `fetch`.
 */

import type { LineString } from 'geojson'
import type { LatLng, Objective } from '../../types.ts'

export type { Objective }

/**
 * Cost used for pairs a provider reports as unroutable.
 *
 * The solver needs a finite integer for every cell; a large value makes it
 * avoid the arc without the Infinity/NaN a raw null would produce.
 */
export const UNREACHABLE_COST = 9_999_999

/**
 * What a provider will accept in one request.
 *
 * Every one of these was measured against the live service, not read from
 * documentation — see the M12 entry in PROGRESS.md for the probe results. The
 * documented numbers were wrong or absent in three cases out of four.
 */
export interface ProviderLimits {
  /**
   * Maximum `sources.length × destinations.length` in one request.
   *
   * The unit is CELLS, not coordinates. OSRM's error says "Too many table
   * coordinates" and means neither: it rejects at 10,201 cells whether that is
   * 101×101 or 34×300.
   */
  maxCells: number
  /** Maximum coordinates one request may name at all. */
  maxPoints: number
  /**
   * Maximum characters in the request URL, for providers that take GET.
   *
   * Undefined means the provider takes POST and there is no ceiling. This is
   * the limit that actually capped the app at 300 stops: the coordinate list
   * goes in the path, so a dense request grows the URL linearly and nginx
   * returns 414 long before the cell budget is spent.
   */
  maxUrlChars?: number
  /** Client-side pacing between consecutive requests to this provider. */
  minRequestGapMs: number
}

/**
 * One rectangle of the matrix: some rows against some columns.
 *
 * `sources` and `destinations` are indices into `points`, so a band can be
 * asymmetric and sparse without the adapter needing to know why. An adapter is
 * expected to send only the coordinates the band actually references — that is
 * what keeps a URL short when 40 stops out of 600 are wanted.
 */
export interface MatrixBand {
  points: readonly LatLng[]
  sources: readonly number[]
  destinations: readonly number[]
  objective: Objective
  signal?: AbortSignal
}

/** Real road geometry + totals for a fixed, already-ordered sequence of points. */
export interface RouteGeometry {
  geometry: LineString
  distanceMeters: number
  durationSeconds: number
  /**
   * Per-leg driving seconds and metres — one entry per consecutive pair of the
   * points we asked about.
   *
   * These are the difference between a real arrival time and a share of a
   * total, and from M12 they are also the cheapest refinement we have: the
   * route call returns the true duration of every arc the solver chose, for no
   * request we were not already making. Empty when the response's leg count
   * disagrees with what we asked for, because a mismatched array silently
   * shifts every arrival by one stop.
   */
  legSeconds: number[]
  legMeters: number[]
}

export interface MatrixProvider {
  readonly id: string
  readonly label: string
  /** ODbL requires it, and every provider here is OSM-derived. Rendered by the UI. */
  readonly attribution: string
  readonly limits: ProviderLimits

  /**
   * `sources.length` rows of `destinations.length` cells, in the order asked
   * for — NOT in `points` order. `null` means unroutable.
   */
  table(band: MatrixBand): Promise<(number | null)[][]>

  /**
   * Road geometry for a fixed sequence, in the given order.
   *
   * Optional: a matrix provider is not obliged to draw. When it cannot, the
   * service falls through to one that can, and failing that the caller draws
   * straight lines and says so.
   */
  route?(points: readonly LatLng[], signal?: AbortSignal): Promise<RouteGeometry>
}

/**
 * Why a routing call failed, in the only terms the caller branches on.
 *
 * `tooBig` is deliberately NOT failover-worthy. It means we asked for more than
 * the provider allows, and every fallback we have allows LESS — retrying
 * elsewhere would turn a caller bug into a slow caller bug. The fix is for
 * `cover.ts` to plan smaller rectangles, and an error that says so is worth
 * more than one that silently degrades.
 */
export type RoutingErrorKind =
  | 'rateLimited'
  | 'unauthorized'
  | 'network'
  | 'badResponse'
  | 'aborted'
  | 'tooBig'

export class RoutingError extends Error {
  readonly kind: RoutingErrorKind
  readonly providerId: string
  readonly status?: number

  constructor(kind: RoutingErrorKind, providerId: string, message: string, status?: number) {
    super(message)
    this.name = 'RoutingError'
    this.kind = kind
    this.providerId = providerId
    this.status = status
  }
}

/** True for the errors where trying the other provider is worth doing. */
export function isFailoverWorthy(e: unknown): boolean {
  if (!(e instanceof RoutingError)) return false
  return e.kind === 'rateLimited' || e.kind === 'network' || e.kind === 'badResponse'
}

/**
 * Would this band fit in one request to this provider?
 *
 * Exported because the covering algorithm asks it thousands of times while
 * deciding how to split, and because an adapter asking it about its own
 * request is how `tooBig` gets raised before the network rather than after.
 */
export function fits(
  limits: ProviderLimits,
  sources: number,
  destinations: number,
  urlChars = 0,
): boolean {
  if (sources * destinations > limits.maxCells) return false
  if (Math.max(sources, destinations) > limits.maxPoints) return false
  if (limits.maxUrlChars !== undefined && urlChars > limits.maxUrlChars) return false
  return true
}
