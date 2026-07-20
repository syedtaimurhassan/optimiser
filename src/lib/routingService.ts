import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute } from '../types'

const OSRM_TRIP_BASE = 'https://router.project-osrm.org/trip/v1/driving'
const OSRM_TABLE_BASE = 'https://router.project-osrm.org/table/v1/driving'

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

/**
 * Fetch an integer travel-time (duration) matrix for the full stop set from the
 * OSRM Table service. The points are ordered `[start, ...waypoints, end]`, so
 * the returned matrix indices line up with that array (index 0 = start, last =
 * end). This is the cost grid the OR-Tools Selective-TSP solver consumes.
 *
 * Every duration is `Math.round()`ed to an integer — OR-Tools requires integer
 * costs — and unroutable pairs (null) become `UNREACHABLE_COST`.
 *
 * Note: the public OSRM demo server caps a table request at ~100 coordinates,
 * so `waypoints.length + 2` must stay under that limit.
 */
export async function fetchDurationMatrix(
  start: LatLng,
  waypoints: LatLng[],
  end: LatLng,
): Promise<number[][]> {
  const allPoints = [start, ...waypoints, end]

  if (allPoints.length < 2) {
    throw new Error('At least a start and an end location are required.')
  }

  // OSRM expects "Longitude,Latitude" pairs joined by ";".
  const coords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_TABLE_BASE}/${coords}?annotations=duration`

  let response: Response
  try {
    response = await fetch(url)
  } catch (e) {
    throw new Error(`Could not reach the OSRM service: ${(e as Error).message}`)
  }

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

  // OR-Tools strictly requires INTEGER costs: round every cell, and replace
  // unroutable (null) cells with a large finite penalty.
  return data.durations.map((row) =>
    row.map((seconds) =>
      seconds == null ? UNREACHABLE_COST : Math.round(seconds),
    ),
  )
}
