import type { LineString } from 'geojson'
import type { LatLng } from '../types'

const OSRM_TABLE_BASE = 'https://router.project-osrm.org/table/v1/driving'
const OSRM_ROUTE_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Cost used for pairs OSRM reports as unroutable (`null`). OR-Tools needs a
 * finite integer for every cell; a large value makes the solver avoid the edge
 * without the Infinity/NaN that a raw null would produce.
 */
export const UNREACHABLE_COST = 9_999_999

interface OsrmTableResponse {
  code: string
  message?: string
  /** N×N travel times in seconds; a cell is null when no route exists. */
  durations?: (number | null)[][]
  /** N×N road distances in meters (when annotations=distance). */
  distances?: (number | null)[][]
}

/** What the optimizer minimizes: driving time or road distance. */
export type Objective = 'duration' | 'distance'

interface OsrmLeg {
  distance: number
  duration: number
}

interface OsrmRoute {
  geometry: LineString
  distance: number
  duration: number
  /** One per consecutive pair of the coordinates we asked about. */
  legs?: OsrmLeg[]
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
  /**
   * Per-leg driving seconds and metres — one entry per consecutive pair of the
   * points we asked about.
   *
   * OSRM returns these on every route response and this adapter used to drop
   * them. They are the difference between a real arrival time and a share of a
   * total. Empty when the response's leg count disagrees with what we asked
   * for, because a mismatched array silently shifts every arrival by one stop.
   */
  legSeconds: number[]
  legMeters: number[]
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
 * Fetch an integer cost matrix (driving time OR road distance, per `objective`)
 * over an ordered point list from the OSRM Table service. This is the cost grid
 * the OR-Tools solver consumes; matrix indices line up with `points`.
 *
 * The public server caps a request at 10,000 cells (sources × destinations),
 * NOT at a coordinate count — so for large sets we send ALL coordinates every
 * time and fetch the matrix in horizontal row-bands (`sources` = a chunk,
 * `destinations` = all). Requests ≈ ceil(N² / 10,000), each spaced ≥1s apart to
 * respect the demo server's 1 req/sec policy. e.g. ~107 points → 2 requests.
 *
 * Every value is `Math.round()`ed to an integer (OR-Tools requires integer
 * costs); unroutable pairs (null) become `UNREACHABLE_COST`.
 */
export async function fetchCostMatrix(
  points: LatLng[],
  objective: Objective,
  onProgress?: MatrixProgress,
): Promise<number[][]> {
  const n = points.length

  if (n < 2) {
    throw new Error('Need at least two points to build a route.')
  }
  if (n > MAX_TABLE_POINTS) {
    throw new Error(
      `Too many points (${n}). This client supports up to ${MAX_TABLE_POINTS}.`,
    )
  }

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const rowsPerRequest = Math.max(1, Math.floor(OSRM_TABLE_MAX_CELLS / n))
  const totalRequests = Math.ceil(n / rowsPerRequest)

  const matrix: (number | null)[][] = []
  for (let req = 0; req < totalRequests; req++) {
    const from = req * rowsPerRequest
    const to = Math.min(n, from + rowsPerRequest)

    const sources = Array.from({ length: to - from }, (_, i) => from + i).join(';')
    const url =
      `${OSRM_TABLE_BASE}/${coords}?annotations=${objective}` +
      (totalRequests > 1 ? `&sources=${sources}` : '')

    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new Error(
        `OSRM table request failed: ${response.status} ${response.statusText}`,
      )
    }
    const data = (await response.json()) as OsrmTableResponse
    const rows = objective === 'distance' ? data.distances : data.durations
    if (data.code !== 'Ok' || !rows) {
      throw new Error(
        `OSRM could not build a ${objective} matrix (${data.message ?? data.code}).`,
      )
    }

    for (const row of rows) matrix.push(row)

    onProgress?.(req + 1, totalRequests)
    if (req < totalRequests - 1) await sleep(OSRM_MIN_REQUEST_GAP_MS)
  }

  // OR-Tools strictly requires INTEGER costs: round every cell, replacing
  // unroutable (null) cells with a large finite penalty.
  return matrix.map((row) =>
    row.map((value) => (value == null ? UNREACHABLE_COST : Math.round(value))),
  )
}

/**
 * A BAND of the cost matrix: some rows against some columns.
 *
 * `fetchCostMatrix` above always wants the whole grid, so it bands purely to
 * stay under the cell cap. This wants a band for its own sake — M8 inserts a
 * stop into an already-solved route and needs exactly one new row and one new
 * column, not a fresh N×N. On a 44-stop round that is 88 cells instead of
 * 1,936, and on a 300-stop round it is the difference between two requests and
 * nine.
 *
 * `sources` and `destinations` are indices into `points`; both default to all
 * of them. OSRM documents them as accepting a subset of the input locations,
 * which is what makes the asymmetric request legal.
 *
 * Returns `sources.length` rows of `destinations.length` cells, in the order
 * the caller asked for them — NOT in `points` order.
 */
export async function fetchCostBand(
  points: LatLng[],
  objective: Objective,
  band: { sources?: number[]; destinations?: number[] } = {},
): Promise<number[][]> {
  const n = points.length
  if (n < 2) throw new Error('Need at least two points to build a route.')
  if (n > MAX_TABLE_POINTS) {
    throw new Error(`Too many points (${n}). This client supports up to ${MAX_TABLE_POINTS}.`)
  }

  const all = Array.from({ length: n }, (_, i) => i)
  const sources = band.sources ?? all
  const destinations = band.destinations ?? all
  if (sources.length === 0 || destinations.length === 0) return []

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  // Tile over SOURCES only. Either direction of band ends up here — a column
  // band is just `destinations` of length one with every source — so one
  // tiling rule covers both and there is no second cap to keep in step.
  const rowsPerRequest = Math.max(1, Math.floor(OSRM_TABLE_MAX_CELLS / destinations.length))
  const totalRequests = Math.ceil(sources.length / rowsPerRequest)

  const out: number[][] = []
  for (let req = 0; req < totalRequests; req++) {
    const chunk = sources.slice(req * rowsPerRequest, (req + 1) * rowsPerRequest)
    const url =
      `${OSRM_TABLE_BASE}/${coords}?annotations=${objective}` +
      `&sources=${chunk.join(';')}&destinations=${destinations.join(';')}`

    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new Error(`OSRM table request failed: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as OsrmTableResponse
    const rows = objective === 'distance' ? data.distances : data.durations
    if (data.code !== 'Ok' || !rows) {
      throw new Error(`OSRM could not build a ${objective} matrix (${data.message ?? data.code}).`)
    }

    for (const row of rows) {
      out.push(row.map((value) => (value == null ? UNREACHABLE_COST : Math.round(value))))
    }

    if (req < totalRequests - 1) await sleep(OSRM_MIN_REQUEST_GAP_MS)
  }

  return out
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
  const legs = Array.isArray(route.legs) ? route.legs : []
  const expected = points.length - 1
  const usable = legs.length === expected

  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    legSeconds: usable ? legs.map((leg) => leg.duration) : [],
    legMeters: usable ? legs.map((leg) => leg.distance) : [],
  }
}
