import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute } from '../types'
import { fetchDurationMatrix, fetchRouteGeometry } from './routingService'
import { solveSelectiveTSP } from './solver'
import { haversine } from './optimize'

/** Public OSRM demo server caps a table/route request at ~100 coordinates. */
export const MAX_OSRM_POINTS = 100

/**
 * Full Selective-TSP pipeline, all triggered from the browser:
 *   1. OSRM Table  -> integer driving-time cost matrix over [start,...,end]
 *   2. OR-Tools    -> choose the best K stops and their visiting order (WASM)
 *   3. OSRM Route  -> real road geometry + distance for the chosen sequence
 *
 * Step 3 is best-effort: if it fails we still return the optimized selection
 * with straight-line geometry and the matrix-derived driving time.
 */
export async function planSelectiveRoute(
  start: LatLng,
  waypoints: LatLng[],
  end: LatLng,
  k: number,
): Promise<OptimizedRoute> {
  const allPoints = [start, ...waypoints, end]

  if (allPoints.length > MAX_OSRM_POINTS) {
    throw new Error(
      `The public OSRM server allows at most ${MAX_OSRM_POINTS} points per ` +
        `request; you have ${allPoints.length} (start + ${waypoints.length} ` +
        `stops + end). Reduce the number of candidate stops.`,
    )
  }

  // 1) Real driving-time cost grid.
  const matrix = await fetchDurationMatrix(start, waypoints, end)

  // 2) Pick the best K stops and order them, in-browser via OR-Tools WASM.
  const visited = await solveSelectiveTSP(matrix, k)
  const orderedWaypoints = visited.map((i) => allPoints[i])

  // Real driving seconds along the chosen route (sum of matrix cells).
  let matrixDuration = 0
  for (let i = 0; i < visited.length - 1; i++) {
    matrixDuration += matrix[visited[i]][visited[i + 1]]
  }

  // 3) Best-effort real road geometry for the chosen sequence.
  try {
    const road = await fetchRouteGeometry(orderedWaypoints)
    return {
      orderedWaypoints,
      geometry: road.geometry,
      distanceMeters: road.distanceMeters,
      durationSeconds: road.durationSeconds,
      estimated: false,
    }
  } catch {
    // Fallback: straight-line geometry + haversine distance (duration stays
    // the real OSRM matrix sum).
    let straightMeters = 0
    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      straightMeters += haversine(orderedWaypoints[i], orderedWaypoints[i + 1])
    }
    const geometry: LineString = {
      type: 'LineString',
      coordinates: orderedWaypoints.map((p) => [p.lng, p.lat]),
    }
    return {
      orderedWaypoints,
      geometry,
      distanceMeters: straightMeters,
      durationSeconds: matrixDuration,
      estimated: true,
    }
  }
}
