/**
 * Photon adapter — the fallback.
 *
 * Chosen for one property above all: it needs NO key. When the primary fails
 * because its shared, unrestricted quota was drained by a stranger, the last
 * thing the recovery path should depend on is another credential. There is
 * nothing here to leak, misconfigure, or have rejected.
 *
 * Verified live rather than from documentation: it answers with
 * `access-control-allow-origin: *`, so it works from a static origin with no
 * proxy, and it is good on Danish addresses (it returns "Bagsværd" as the
 * district where Geoapify returns "Gladsaxe Municipality" as the city).
 *
 * Why it is NOT the primary: komoot's public instance is documented at roughly
 * 1 request/second with no SLA, "extensive usage will be throttled or
 * completely banned", and there is no commercial offering. That is a fine
 * safety net and an irresponsible foundation.
 */

import type { Address } from '../../types.ts'
import {
  GeocodingError,
  composeAddressLines,
  type GeocodingProvider,
  type Suggestion,
} from './types.ts'

const BASE = 'https://photon.komoot.io'

export const PHOTON_ID = 'photon'

/**
 * Minimum gap between requests, in ms.
 *
 * komoot documents the public instance at roughly 1 request/second and warns
 * that extensive usage will be "throttled or completely banned". This is not a
 * theoretical limit — firing an autocomplete and a reverse back to back with no
 * delay reliably earns a 503 from the second one. Verified, not assumed.
 *
 * 1100 rather than 1000 buys a little headroom against clock jitter, and being
 * slightly slow is the correct trade for a provider that is already the last
 * resort: there is nobody to fail over to after this one.
 */
export const MIN_REQUEST_INTERVAL_MS = 1100

/**
 * Serialises requests to at most one per `MIN_REQUEST_INTERVAL_MS`.
 *
 * Module-level rather than per-provider on purpose: the limit belongs to
 * komoot's server, not to any object we happen to construct, so two provider
 * instances must still share one budget.
 */
let nextSlot = 0

async function takeSlot(signal?: AbortSignal): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + MIN_REQUEST_INTERVAL_MS
  if (wait === 0) return

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, wait)
    function onAbort() {
      clearTimeout(timer)
      reject(new GeocodingError('aborted', PHOTON_ID, 'aborted while rate-limited'))
    }
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Photon translates results into a handful of languages only; anything else is
 * rejected outright. Unsupported locales fall through to the provider default
 * rather than failing the request — a fallback that 400s is not a fallback.
 */
const SUPPORTED_LANGS = new Set(['en', 'de', 'fr', 'it'])

interface PhotonFeature {
  properties?: {
    name?: string
    housenumber?: string
    street?: string
    district?: string
    city?: string
    county?: string
    state?: string
    postcode?: string
    country?: string
    countrycode?: string
    osm_type?: string
    osm_id?: number
  }
  geometry?: { coordinates?: [number, number] }
}

export function createPhotonProvider(): GeocodingProvider {
  async function call(path: string, params: URLSearchParams, signal?: AbortSignal) {
    await takeSlot(signal)

    let res: Response
    try {
      res = await fetch(`${BASE}/${path}?${params}`, { signal })
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') {
        throw new GeocodingError('aborted', PHOTON_ID, 'request aborted')
      }
      throw new GeocodingError('network', PHOTON_ID, (e as Error)?.message ?? 'network error')
    }

    if (!res.ok) {
      // 503 is how komoot's throttle actually answers — it does not send 429.
      // Classifying it as `network` would make the UI report a connection
      // problem when the real answer is "you asked too fast".
      const throttled = res.status === 429 || res.status === 503
      const kind = throttled ? 'rateLimited' : 'network'
      throw new GeocodingError(kind, PHOTON_ID, `HTTP ${res.status}`, res.status)
    }

    try {
      const body = (await res.json()) as { features?: PhotonFeature[] }
      return body.features ?? []
    } catch {
      throw new GeocodingError('badResponse', PHOTON_ID, 'response was not JSON')
    }
  }

  return {
    id: PHOTON_ID,
    label: 'Photon',
    attribution: '© OpenStreetMap contributors · Search by Photon/komoot',

    async autocomplete(query, opts = {}) {
      const q = query.trim()
      if (!q) return []

      const params = new URLSearchParams({ q })
      if (opts.limit) params.set('limit', String(opts.limit))
      if (opts.lang && SUPPORTED_LANGS.has(opts.lang)) params.set('lang', opts.lang)
      if (opts.near) {
        params.set('lat', String(opts.near.lat))
        params.set('lon', String(opts.near.lng))
      }

      const features = await call('api/', params, opts.signal)
      return features.flatMap((f) => {
        const s = toSuggestion(f, 'geocoder')
        return s ? [s] : []
      })
    },

    async reverse(at, opts = {}) {
      const params = new URLSearchParams({ lat: String(at.lat), lon: String(at.lng) })
      if (opts.lang && SUPPORTED_LANGS.has(opts.lang)) params.set('lang', opts.lang)
      const features = await call('reverse', params, opts.signal)
      const first = features[0]
      return first ? toAddress(first, 'reverse') : null
    },
  }
}

/**
 * Photon gives no pre-split address, so unlike Geoapify every line here is
 * composed. That is the whole reason `composeAddressLines` is shared rather
 * than living inside one adapter.
 */
export function toAddress(f: PhotonFeature, source: Address['source']): Address {
  const p = f.properties ?? {}
  // `name` duplicates `street` for street-type results; suppress it so the
  // title doesn't come out as "Løvfrøvej" with a subtitle starting "Løvfrøvej".
  const name = p.name && p.name !== p.street ? p.name : undefined
  const { title, subtitle } = composeAddressLines({
    street: p.street,
    housenumber: p.housenumber,
    area: p.district || p.city || p.county,
    postcode: p.postcode,
    country: p.country,
    name,
  })

  return {
    title,
    subtitle,
    street: [p.street, p.housenumber].filter(Boolean).join(' ') || undefined,
    area: p.district || p.city || p.county,
    postcode: p.postcode,
    country: p.country,
    // Not a real place id — Photon has none. An OSM reference is the closest
    // stable handle, and it is namespaced so it can never be mistaken for
    // Geoapify's and fed back to the wrong provider.
    providerPlaceId: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : undefined,
    source,
  }
}

function toSuggestion(f: PhotonFeature, source: Address['source']): Suggestion | null {
  const coords = f.geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const [lng, lat] = coords
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  return {
    placeId: toAddress(f, source).providerPlaceId,
    address: toAddress(f, source),
    lat,
    lng,
    providerId: PHOTON_ID,
  }
}

/** Exported for tests — the shape a Photon feature must have to be usable. */
export type { PhotonFeature }
