/**
 * The geocoding seam.
 *
 * Everything below this file talks to a `GeocodingProvider`, never to Geoapify
 * or Photon by name. That indirection is not speculative generality — it is
 * load-bearing twice over:
 *
 *   1. The free tier is a shared, exhaustible resource. When the primary is
 *      drained or unreachable the app has to keep answering, which means a
 *      second provider with a different failure mode.
 *   2. Provider terms change. Storage rights and quotas are the reason we are
 *      on Geoapify rather than Google or Mapbox at all, and if that calculus
 *      moves the swap should be one module, not one screen.
 *
 * Pure module: no React, no store, no I/O beyond `fetch`.
 */

import type { Address, LatLng } from '../../types.ts'

/** One row in the "Add a new stop" section of the search screen. */
export interface Suggestion {
  /**
   * Provider's own id. Only meaningful to the provider that issued it, so it
   * travels with `providerId` and is never compared across providers.
   */
  placeId?: string
  address: Address
  lat: number
  lng: number
  /** 0..1, when the provider reports one. Drives the importer's error report. */
  confidence?: number
  /** Which adapter produced this. Shown in the degraded state, not normally. */
  providerId: string
}

export interface AutocompleteOptions {
  limit?: number
  /**
   * Bias results towards here — in practice the map centre.
   *
   * This matters more than it sounds. "Station Road" matches thousands of
   * streets in the UK alone; without a bias the list is useless noise, and the
   * driver is always looking for somewhere near where they already are.
   */
  near?: LatLng
  /** ISO-3166-1 alpha-2, lowercase. Narrows the search and improves precision. */
  countryCodes?: string[]
  /** ISO 639-1. */
  lang?: string
  signal?: AbortSignal
}

export interface ReverseOptions {
  lang?: string
  signal?: AbortSignal
}

/**
 * Why a geocoding call failed, in the only terms the UI actually branches on.
 *
 * `rateLimited` and `unauthorized` are separated because they mean different
 * things to the user: the first is "come back later, or keep going on the
 * fallback", the second is "this build is misconfigured and no amount of
 * waiting fixes it".
 */
export type GeocodingErrorKind =
  | 'rateLimited'
  | 'unauthorized'
  | 'network'
  | 'badResponse'
  | 'aborted'

export class GeocodingError extends Error {
  readonly kind: GeocodingErrorKind
  readonly providerId: string
  readonly status?: number

  constructor(kind: GeocodingErrorKind, providerId: string, message: string, status?: number) {
    super(message)
    this.name = 'GeocodingError'
    this.kind = kind
    this.providerId = providerId
    this.status = status
  }
}

/** True for the errors where trying the other provider is worth doing. */
export function isFailoverWorthy(e: unknown): boolean {
  if (!(e instanceof GeocodingError)) return false
  return e.kind === 'rateLimited' || e.kind === 'unauthorized' || e.kind === 'network'
}

export interface GeocodingProvider {
  readonly id: string
  readonly label: string
  /**
   * Attribution string. Not decoration: Geoapify's free tier requires their
   * credit, and every provider here is OSM-derived, which the ODbL requires us
   * to say. Rendered by the search screen, not by this module.
   */
  readonly attribution: string

  autocomplete(query: string, opts?: AutocompleteOptions): Promise<Suggestion[]>
  reverse(at: LatLng, opts?: ReverseOptions): Promise<Address | null>
  /**
   * Re-resolve a place id to a full address plus coordinates.
   *
   * Optional because it is a Google-shaped idea. Providers whose autocomplete
   * already returns coordinates — both of ours do — have nothing to add here,
   * and the caller falls back to the suggestion it already holds.
   */
  details?(placeId: string, opts?: ReverseOptions): Promise<(Address & LatLng) | null>
}

/**
 * Build the two-line form a route row renders from whatever components a
 * provider managed to supply.
 *
 * Only used by adapters that DON'T hand us a pre-split address. It exists
 * because the alternative — parsing `formatted` — is the exact problem
 * geocoders are for, and it gets Denmark wrong first and everywhere else after.
 */
export function composeAddressLines(parts: {
  street?: string
  housenumber?: string
  area?: string
  postcode?: string
  country?: string
  name?: string
}): { title: string; subtitle: string } {
  const street = [parts.street, parts.housenumber].filter(Boolean).join(' ').trim()
  const title = parts.name || street || parts.area || parts.postcode || parts.country || ''
  const rest: string[] = [
    // A named POI still wants its street on the second line.
    parts.name && street ? street : '',
    [parts.postcode, parts.area].filter(Boolean).join(' ').trim(),
    parts.country ?? '',
  ].filter((s) => s !== '' && s !== title)
  return { title, subtitle: dedupe(rest).join(', ') }
}

function dedupe(xs: string[]): string[] {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x) ? false : (seen.add(x), true)))
}
