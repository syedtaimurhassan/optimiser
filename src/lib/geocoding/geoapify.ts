/**
 * Geoapify adapter — the primary provider.
 *
 * Why Geoapify, in one line: it is the only free tier we found that permits
 * PERMANENTLY storing the geocoded result, which is what this app does every
 * time a stop is saved. Google (30-day cache), Mapbox (temporary use), HERE,
 * TomTom and Stadia's free plan all forbid it.
 *
 * The other reason is `address_line1` / `address_line2`: Geoapify already
 * splits an address into exactly the two lines a route row renders, so we store
 * the provider's own answer instead of parsing `formatted` ourselves. See the
 * comment on `Address` in types.ts for why that split must not be re-derived.
 *
 * ── The key ───────────────────────────────────────────────────────────────
 *
 * It ships in the bundle and is NOT referrer-restricted (the dashboard offered
 * no way to). Treat the quota as public and exhaustible by strangers — which is
 * precisely why `service.ts` fails over to Photon rather than surfacing an
 * error. The blast radius is bounded: the free tier has no billing overage, so
 * the worst case is degradation, never a bill.
 */

import type { Address } from '../../types.ts'
import {
  GeocodingError,
  composeAddressLines,
  type GeocodingProvider,
  type Suggestion,
} from './types.ts'

const BASE = 'https://api.geoapify.com/v1'

export const GEOAPIFY_ID = 'geoapify'

/** One entry of a `format=json` response. Only the fields we actually read. */
interface GeoapifyResult {
  address_line1?: string
  address_line2?: string
  formatted?: string
  name?: string
  street?: string
  housenumber?: string
  suburb?: string
  city?: string
  municipality?: string
  postcode?: string
  country?: string
  country_code?: string
  lat?: number
  lon?: number
  place_id?: string
  rank?: { confidence?: number }
}

export function createGeoapifyProvider(apiKey: string): GeocodingProvider {
  if (!apiKey) {
    // Fail loudly at construction rather than with a 401 on the first keystroke.
    throw new Error('createGeoapifyProvider: apiKey is required')
  }

  async function call(path: string, params: URLSearchParams, signal?: AbortSignal) {
    params.set('apiKey', apiKey)
    params.set('format', 'json')

    let res: Response
    try {
      res = await fetch(`${BASE}/${path}?${params}`, { signal })
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') {
        throw new GeocodingError('aborted', GEOAPIFY_ID, 'request aborted')
      }
      throw new GeocodingError('network', GEOAPIFY_ID, (e as Error)?.message ?? 'network error')
    }

    if (!res.ok) throw errorForStatus(res.status)

    try {
      const body = (await res.json()) as { results?: GeoapifyResult[] }
      return body.results ?? []
    } catch {
      throw new GeocodingError('badResponse', GEOAPIFY_ID, 'response was not JSON')
    }
  }

  return {
    id: GEOAPIFY_ID,
    label: 'Geoapify',
    // Both credits are obligations, not courtesies: OSM's licence requires the
    // first, Geoapify's free tier requires the second.
    attribution: '© OpenStreetMap contributors · Powered by Geoapify',

    async autocomplete(query, opts = {}) {
      const q = query.trim()
      if (!q) return []

      const params = new URLSearchParams({ text: q })
      if (opts.limit) params.set('limit', String(opts.limit))
      if (opts.lang) params.set('lang', opts.lang)
      if (opts.near) params.set('bias', `proximity:${opts.near.lng},${opts.near.lat}`)
      if (opts.countryCodes?.length) {
        params.set('filter', `countrycode:${opts.countryCodes.join(',').toLowerCase()}`)
      }

      const results = await call('geocode/autocomplete', params, opts.signal)
      return results.flatMap((r) => {
        const s = toSuggestion(r, 'geocoder')
        return s ? [s] : []
      })
    },

    async reverse(at, opts = {}) {
      const params = new URLSearchParams({ lat: String(at.lat), lon: String(at.lng), limit: '1' })
      if (opts.lang) params.set('lang', opts.lang)
      const results = await call('geocode/reverse', params, opts.signal)
      return results[0] ? toAddress(results[0], 'reverse') : null
    },
  }
}

/** Map a provider row onto our `Address`. Exported for the cache's tests. */
export function toAddress(r: GeoapifyResult, source: Address['source']): Address {
  // Prefer the provider's own split; compose only when it withheld one.
  const composed = composeAddressLines({
    street: r.street,
    housenumber: r.housenumber,
    area: r.suburb || r.city || r.municipality,
    postcode: r.postcode,
    country: r.country,
    name: r.name,
  })

  return {
    title: r.address_line1 || composed.title,
    subtitle: r.address_line2 || composed.subtitle,
    formatted: r.formatted,
    street: [r.street, r.housenumber].filter(Boolean).join(' ') || undefined,
    // `suburb` before `city`: Geoapify frequently reports the MUNICIPALITY as
    // `city` in Denmark ("Gladsaxe Municipality"), which is not what a driver
    // calls the place. The suburb ("Bagsværd", "Vangede") is.
    area: r.suburb || r.city || r.municipality,
    postcode: r.postcode,
    country: r.country,
    providerPlaceId: r.place_id,
    source,
  }
}

function toSuggestion(r: GeoapifyResult, source: Address['source']): Suggestion | null {
  if (typeof r.lat !== 'number' || typeof r.lon !== 'number') return null
  return {
    placeId: r.place_id,
    address: toAddress(r, source),
    lat: r.lat,
    lng: r.lon,
    confidence: r.rank?.confidence,
    providerId: GEOAPIFY_ID,
  }
}

function errorForStatus(status: number): GeocodingError {
  // Geoapify exposes no rate-limit headers at all — verified against the live
  // API — so the status code is the only signal there is.
  if (status === 429) {
    return new GeocodingError('rateLimited', GEOAPIFY_ID, 'quota or rate limit reached', status)
  }
  if (status === 401 || status === 403) {
    return new GeocodingError('unauthorized', GEOAPIFY_ID, 'API key rejected', status)
  }
  return new GeocodingError('network', GEOAPIFY_ID, `HTTP ${status}`, status)
}
