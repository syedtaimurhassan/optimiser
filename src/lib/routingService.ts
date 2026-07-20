import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute } from '../types'

const OSRM_TRIP_BASE = 'https://router.project-osrm.org/trip/v1/driving'
const OSRM_TABLE_BASE = 'https://router.project-osrm.org/table/v1/driving'
const OSRM_ROUTE_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Cost used for pairs OSRM reports as unroutable (`null`). OR-Tools needs a
 * finite integer for every cell; a large value makes the solver avoid the edge
 * without the Infinity/NaN that a raw null would produce.
 */
export const UNREACHABLE_COST = 9_999_999

/** Minimal shapes for the fields we consume from the OSRM Trip response. */
interface OsrmWaypoint {
  /** This point's position within the optimized trip order. */
  waypoint_index: number
  /** Snapped location as [lng, lat]. */
  location: [number, number]
}

interface OsrmTrip {
  geometry: LineString
  distance: number
  duration: number
}

interface OsrmTripResponse {
  code: string
  message?: string
  trips?: OsrmTrip[]
  waypoints?: OsrmWaypoint[]
}

interface OsrmTableResponse {
  code: string
  message?: string
  /** N×N travel times in seconds; a cell is null when no route exists. */
  durations?: (number | null)[][]
}

interface OsrmRoute {
  geometry: LineString
  distance: number
  duration: number
}

interface OsrmRouteResponse {
  code: string
  message?: string
  routes?: OsrmRoute[]
}

/** Real road geometry + totals for a fixed, already-ordered sequence of points. */
export interface RouteGeometry {
  geometry: LineString
  distanceMeters: number
  durationSeconds: number
}

/**
 * Call the public OSRM Trip API to compute the optimal visiting order for the
 * given stops and the driving geometry between them.
 *
 * `start` is pinned as the source and `end` as the destination
 * (`source=first`, `destination=last`, `roundtrip=false`); only the
 * intermediate `waypoints` are reordered.
 */
export async function calculateOptimalRoute(
  start: LatLng,
  waypoints: LatLng[],
  end: LatLng,
): Promise<OptimizedRoute> {
  // Order sent to OSRM: start, then the waypoints, then end.
  const allPoints = [start, ...waypoints, end]

  if (allPoints.length < 2) {
    throw new Error('At least a start and an end location are required.')
  }

  // IMPORTANT: OSRM expects "Longitude,Latitude" pairs joined by ";".
  const coords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';')

  const url =
    `${OSRM_TRIP_BASE}/${coords}` +
    `?source=first&destination=last&roundtrip=false&geometries=geojson`

  let response: Response
  try {
    response = await fetch(url)
  } catch (e) {
    throw new Error(`Could not reach the OSRM service: ${(e as Error).message}`)
  }

  if (!response.ok) {
    throw new Error(`OSRM request failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OsrmTripResponse

  if (data.code !== 'Ok' || !data.trips?.length || !data.waypoints) {
    throw new Error(
      `OSRM could not compute a route (${data.message ?? data.code}).`,
    )
  }

  const trip = data.trips[0]

  // `data.waypoints` is parallel to the INPUT order; `waypoint_index` gives each
  // point's slot in the OPTIMIZED order. Sorting by it reconstructs the sequence.
  const orderedWaypoints = data.waypoints
    .map((wp, inputIndex) => ({ waypointIndex: wp.waypoint_index, inputIndex }))
    .sort((a, b) => a.waypointIndex - b.waypointIndex)
    .map(({ inputIndex }) => allPoints[inputIndex])

  return {
    orderedWaypoints,
    geometry: trip.geometry,
    distanceMeters: trip.distance,
    durationSeconds: trip.duration,
  }
}

/** The public OSRM Table service rejects a request for more than this many
 *  cells (sources × destinations). NOT a coordinate-count limit — verified. */
const OSRM_TABLE_MAX_CELLS = 10_000
/** Respect the demo server's "1 request/second" policy between tiled calls. */
const OSRM_MIN_REQUEST_GAP_MS = 1_100
/** Guard against absurd URLs / request counts (URL length, not a hard OSRM cap). */
const MAX_TABLE_POINTS = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** fetch() that rejects with a clear message if the server stalls past `timeoutMs`. */
async function fetchWithTimeout(url: string, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(
        `The OSRM server did not respond within ${timeoutMs / 1000}s. ` +
          `The free demo server may be busy — please try again.`,
      )
    }
    throw new Error(`Could not reach the OSRM service: ${(e as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Progress callback for a tiled matrix fetch: (completedRequests, totalRequests). */
export type MatrixProgress = (done: number, total: number) => void

/**
 * Fetch an integer travel-time (duration) matrix for the full stop set from the
 * OSRM Table service. Points are ordered `[start, ...waypoints, end]`, so the
 * matrix indices line up with that array (index 0 = start, last = end). This is
 * the cost grid the OR-Tools Selective-TSP solver consumes.
 *
 * The public server caps a request at 10,000 cells (sources × destinations),
 * NOT at a coordinate count — so for large stop sets we send ALL coordinates
 * every time and fetch the matrix in horizontal row-bands (`sources` = a chunk,
 * `destinations` = all). Requests ≈ ceil(N² / 10,000), each spaced ≥1s apart to
 * stay within the demo server's 1 req/sec policy. e.g. ~107 stops → 2 requests.
 *
 * Every duration is `Math.round()`ed to an integer (OR-Tools requires integer
 * costs); unroutable pairs (null) become `UNREACHABLE_COST`.
 */
export async function fetchDurationMatrix(
  start: LatLng,
  waypoints: LatLng[],
  end: LatLng,
  onProgress?: MatrixProgress,
): Promise<number[][]> {
  const allPoints = [start, ...waypoints, end]
  const n = allPoints.length

  if (n < 2) {
    throw new Error('At least a start and an end location are required.')
  }
  if (n > MAX_TABLE_POINTS) {
    throw new Error(
      `Too many points (${n}). This client supports up to ${MAX_TABLE_POINTS} ` +
        `(start + ${MAX_TABLE_POINTS - 2} stops + end).`,
    )
  }

  const coords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';')

  // Max source rows per request so that rows × n stays within the cell budget.
  const rowsPerRequest = Math.max(1, Math.floor(OSRM_TABLE_MAX_CELLS / n))
  const totalRequests = Math.ceil(n / rowsPerRequest)

  const matrix: (number | null)[][] = []
  for (let req = 0; req < totalRequests; req++) {
    const from = req * rowsPerRequest
    const to = Math.min(n, from + rowsPerRequest)

    // sources = this row-band; destinations default to all coordinates.
    const sources = Array.from({ length: to - from }, (_, i) => from + i).join(';')
    const url =
      `${OSRM_TABLE_BASE}/${coords}?annotations=duration` +
      (totalRequests > 1 ? `&sources=${sources}` : '')

    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new Error(
        `OSRM table request failed: ${response.status} ${response.statusText}`,
      )
    }
    const data = (await response.json()) as OsrmTableResponse
    if (data.code !== 'Ok' || !data.durations) {
      throw new Error(
        `OSRM could not build a duration matrix (${data.message ?? data.code}).`,
      )
    }

    // Rows come back in the order of the sources we asked for -> append directly.
    for (const row of data.durations) matrix.push(row)

    onProgress?.(req + 1, totalRequests)
    if (req < totalRequests - 1) await sleep(OSRM_MIN_REQUEST_GAP_MS)
  }

  // OR-Tools strictly requires INTEGER costs: round every cell, replacing
  // unroutable (null) cells with a large finite penalty.
  return matrix.map((row) =>
    row.map((seconds) =>
      seconds == null ? UNREACHABLE_COST : Math.round(seconds),
    ),
  )
}

/**
 * Fetch the driving route (road geometry + distance + duration) that follows a
 * fixed, already-ordered list of points in the given order. Used to draw the
 * chosen route on real roads after OR-Tools has decided the visiting order — so
 * the sequence is preserved, not re-optimized.
 */
export async function fetchRouteGeometry(
  points: LatLng[],
): Promise<RouteGeometry> {
  if (points.length < 2) {
    throw new Error('A route needs at least two points.')
  }

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_ROUTE_BASE}/${coords}?overview=full&geometries=geojson`

  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(
      `OSRM route request failed: ${response.status} ${response.statusText}`,
    )
  }

  const data = (await response.json()) as OsrmRouteResponse
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(
      `OSRM could not build a route (${data.message ?? data.code}).`,
    )
  }

  const route = data.routes[0]
  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  }
}
