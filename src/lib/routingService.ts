import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute } from '../types'

const OSRM_TRIP_BASE = 'https://router.project-osrm.org/trip/v1/driving'

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
