/**
 * OSRM demo server — the primary matrix provider.
 *
 * Free, keyless, CORS-open, and by far the fastest of the three services that
 * survived M12's review: a 100×100 table comes back in ~0.3 s where Valhalla's
 * 50×50 takes ~12 s. The price is a policy we cannot fully honour and a URL
 * ceiling we have to design around.
 *
 * ── The limits, measured ──────────────────────────────────────────────────
 *
 * `10,000 cells` — 33×300 = 9,900 returns `Ok`; 34×300 = 10,200 returns
 * `{"code":"TooBig","message":"Too many table coordinates"}`. The message names
 * coordinates and means cells; 101 coordinates fail only because 101² > 10,000.
 *
 * `8,192 bytes of URL` — 450 coordinates at 5 dp (8,179 chars) succeeds, 454
 * (8,251) returns nginx's 414. This, not the cell budget, is what capped the
 * app at 300 stops, and it is why `table()` below sends only the coordinates
 * the band actually references rather than the whole list every time.
 *
 * ── The policy, honestly ──────────────────────────────────────────────────
 *
 * Non-commercial, best-effort, may be withdrawn without notice, ≤1 request per
 * second, ODbL attribution required. It also asks for a User-Agent identifying
 * the application — which a browser will not let us set, `User-Agent` being a
 * forbidden header name for `fetch`. We send `Referer` automatically and
 * nothing else; that is the whole of what a client-side app can offer.
 */

import type { LatLng } from '../../types.ts'
import {
  RoutingError,
  UNREACHABLE_COST,
  fits,
  type MatrixBand,
  type MatrixProvider,
} from './types.ts'

export const OSRM_ID = 'osrm'

const TABLE_BASE = 'https://router.project-osrm.org/table/v1/driving'
const ROUTE_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Coordinate precision in the URL.
 *
 * Five decimals is ~1.1 m at the equator — an order of magnitude finer than the
 * road node OSRM will snap to anyway — and saves two characters per coordinate
 * against six. At the 8 KB ceiling those two characters are worth about 45
 * extra stops per request, which is the difference between one request and two.
 */
const COORD_DP = 5

interface OsrmTableResponse {
  code: string
  message?: string
  durations?: (number | null)[][]
  distances?: (number | null)[][]
}

interface OsrmLeg {
  distance: number
  duration: number
}

interface OsrmRouteResponse {
  code: string
  message?: string
  routes?: {
    geometry: import('geojson').LineString
    distance: number
    duration: number
    legs?: OsrmLeg[]
  }[]
}

const coord = (p: LatLng) => `${p.lng.toFixed(COORD_DP)},${p.lat.toFixed(COORD_DP)}`

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  let response: Response
  try {
    response = await fetch(url, { signal: controller.signal })
  } catch (e) {
    if (signal?.aborted) throw new RoutingError('aborted', OSRM_ID, 'Cancelled.')
    if ((e as Error).name === 'AbortError') {
      throw new RoutingError(
        'network',
        OSRM_ID,
        `The OSRM server did not respond within ${timeoutMs / 1000}s. ` +
          'The free demo server may be busy — please try again.',
      )
    }
    throw new RoutingError('network', OSRM_ID, `Could not reach OSRM: ${(e as Error).message}`)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  if (!response.ok) {
    // 414 is ours to fix, not the server's to forgive: we built too long a URL.
    const kind =
      response.status === 429 ? 'rateLimited' : response.status === 414 ? 'tooBig' : 'network'
    throw new RoutingError(
      kind,
      OSRM_ID,
      `OSRM request failed: ${response.status} ${response.statusText}`,
      response.status,
    )
  }
  return (await response.json()) as T
}

/**
 * Build the URL for a band, sending ONLY the coordinates it references.
 *
 * A band of 40 sources against 40 destinations out of 600 stops is 80
 * coordinates, not 600, and the difference is 1,500 characters against 12,000
 * — the difference between a request and a 414. Renumbering is the price, and
 * it stays inside this function.
 */
function bandUrl(band: MatrixBand): { url: string; rows: number; cols: number } {
  const used = [...new Set([...band.sources, ...band.destinations])].sort((a, b) => a - b)
  const at = new Map(used.map((original, compact) => [original, compact]))
  const coords = used.map((i) => coord(band.points[i])).join(';')

  const dense = band.sources.length === used.length && band.destinations.length === used.length
  const params = [`annotations=${band.objective}`]
  if (!dense) {
    params.push(`sources=${band.sources.map((i) => at.get(i)).join(';')}`)
    params.push(`destinations=${band.destinations.map((i) => at.get(i)).join(';')}`)
  }
  return {
    url: `${TABLE_BASE}/${coords}?${params.join('&')}`,
    rows: band.sources.length,
    cols: band.destinations.length,
  }
}

export function createOsrmProvider(): MatrixProvider {
  const limits = {
    maxCells: 10_000,
    maxPoints: 450,
    maxUrlChars: 8_192,
    minRequestGapMs: 1_100,
  }

  return {
    id: OSRM_ID,
    label: 'OSRM (demo server)',
    attribution: '© OpenStreetMap contributors · routing by OSRM',
    limits,

    async table(band) {
      if (band.sources.length === 0 || band.destinations.length === 0) return []

      const { url, rows, cols } = bandUrl(band)
      if (!fits(limits, rows, cols, url.length)) {
        throw new RoutingError(
          'tooBig',
          OSRM_ID,
          `Band of ${rows}×${cols} (${url.length} URL chars) exceeds the OSRM limits.`,
        )
      }

      const data = await getJson<OsrmTableResponse>(url, band.signal)
      const table = band.objective === 'distance' ? data.distances : data.durations
      if (data.code !== 'Ok' || !table) {
        throw new RoutingError(
          data.code === 'TooBig' ? 'tooBig' : 'badResponse',
          OSRM_ID,
          `OSRM could not build a ${band.objective} matrix (${data.message ?? data.code}).`,
        )
      }
      if (table.length !== rows || (table[0]?.length ?? 0) !== cols) {
        // A grid of the wrong shape is worse than no grid: every cell after the
        // first missing one refers to the wrong pair of stops.
        throw new RoutingError(
          'badResponse',
          OSRM_ID,
          `OSRM returned ${table.length}×${table[0]?.length ?? 0}, asked for ${rows}×${cols}.`,
        )
      }
      return table
    },

    async route(points, signal) {
      if (points.length < 2) {
        throw new RoutingError('badResponse', OSRM_ID, 'A route needs at least two points.')
      }
      const coords = points.map(coord).join(';')
      const url = `${ROUTE_BASE}/${coords}?overview=full&geometries=geojson`
      if (url.length > limits.maxUrlChars) {
        throw new RoutingError(
          'tooBig',
          OSRM_ID,
          `Route of ${points.length} points needs ${url.length} URL chars.`,
        )
      }

      const data = await getJson<OsrmRouteResponse>(url, signal)
      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new RoutingError(
          'badResponse',
          OSRM_ID,
          `OSRM could not build a route (${data.message ?? data.code}).`,
        )
      }

      const route = data.routes[0]
      const legs = Array.isArray(route.legs) ? route.legs : []
      const usable = legs.length === points.length - 1
      return {
        geometry: route.geometry,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        legSeconds: usable ? legs.map((leg) => leg.duration) : [],
        legMeters: usable ? legs.map((leg) => leg.distance) : [],
      }
    },
  }
}

/** Integer cells with unroutable pairs replaced. The one place nulls die. */
export function toIntegerCells(rows: (number | null)[][]): number[][] {
  return rows.map((row) =>
    row.map((value) => (value == null ? UNREACHABLE_COST : Math.round(value))),
  )
}
