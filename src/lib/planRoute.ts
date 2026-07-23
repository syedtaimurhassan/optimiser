import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute } from '../types'
import {
  fetchCostMatrix,
  fetchRouteGeometry,
  type Objective,
} from './routingService'
import { solveSelectiveTSP } from './solver'
import { haversine } from './optimize'

/** Human-readable status of the current pipeline stage, for UI feedback. */
export type PlanStatus = (message: string) => void

export interface PlanInput {
  /** Fixed start, or null to let the optimizer choose where to begin. */
  startLocation: LatLng | null
  /** Fixed end, or null to let the optimizer choose where to finish. */
  endLocation: LatLng | null
  /** All candidate stops. */
  waypoints: LatLng[]
  /** Max candidate stops to visit, or null for "all". */
  targetK: number | null
  /** Minimize driving time or road distance. */
  objective: Objective
  /** Wall-clock ceiling (ms) for the multi-start solver. */
  timeBudgetMs?: number
  onStatus?: PlanStatus
}

const sameCoord = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng

/**
 * Full pipeline (all in-browser):
 *   1. OSRM Table -> integer cost matrix (time or distance) over the point list
 *   2. OR-Tools   -> pick the best K candidates + order them, with fixed OR free
 *                    start/end
 *   3. OSRM Route -> real road geometry + totals for the chosen sequence
 *
 * Start/end may be null (open route) and may be chosen from the uploaded list —
 * a list-selected endpoint is de-duplicated out of the candidate set so it isn't
 * visited twice.
 */
export async function planSelectiveRoute({
  startLocation,
  endLocation,
  waypoints,
  targetK,
  objective,
  timeBudgetMs,
  onStatus,
}: PlanInput): Promise<OptimizedRoute> {
  // Candidates = uploaded stops, minus any that coincide with a chosen endpoint.
  const candidates = waypoints.filter(
    (w) =>
      !(startLocation && sameCoord(w, startLocation)) &&
      !(endLocation && sameCoord(w, endLocation)),
  )

  // Build the ordered point list: [start?, ...candidates, end?].
  const points: LatLng[] = [
    ...(startLocation ? [startLocation] : []),
    ...candidates,
    ...(endLocation ? [endLocation] : []),
  ]
  if (points.length < 2) {
    throw new Error('Add at least two points (upload a file, or set start/end).')
  }

  const startNode = startLocation ? 0 : null
  const endNode = endLocation ? points.length - 1 : null
  // Clamp K to a sensible range: blank = visit all; otherwise 1..candidates
  // (so K>N caps at N and K<1 becomes 1 — never a degenerate empty route).
  const k =
    targetK == null
      ? candidates.length
      : Math.min(Math.max(Math.floor(targetK), 1), candidates.length)
  // Fixed endpoints occupy slots in the ordered route but aren't candidate stops.
  const fixedCount = (startNode !== null ? 1 : 0) + (endNode !== null ? 1 : 0)

  // 1) Cost grid (tiled + rate-limited for large sets).
  onStatus?.('Fetching cost matrix…')
  const matrix = await fetchCostMatrix(points, objective, (done, total) => {
    onStatus?.(
      total > 1 ? `Fetching cost matrix… ${done}/${total}` : 'Fetching cost matrix…',
    )
  })

  // 2) Optimize (best K + order), in-browser via OR-Tools WASM. This runs a
  //    time-boxed multi-start search, so it intentionally takes a few seconds.
  onStatus?.('Optimizing route (Deep Search)…')
  const visited = await solveSelectiveTSP(matrix, { startNode, endNode, k, timeBudgetMs })
  const orderedWaypoints = visited.map((i) => points[i])

  // Real cost along the chosen route (sum of matrix cells).
  let matrixCost = 0
  for (let i = 0; i < visited.length - 1; i++) {
    matrixCost += matrix[visited[i]][visited[i + 1]]
  }

  // 3) Best-effort real road geometry for the chosen sequence.
  onStatus?.('Building road route…')
  try {
    const road = await fetchRouteGeometry(orderedWaypoints)
    return {
      orderedWaypoints,
      geometry: road.geometry,
      distanceMeters: road.distanceMeters,
      durationSeconds: road.durationSeconds,
      candidatesVisited: orderedWaypoints.length - fixedCount,
      candidatesTotal: candidates.length,
      estimated: false,
    }
  } catch {
    // Fallback: straight-line geometry + haversine distance. Duration is the
    // real matrix sum only when we optimized on duration; otherwise estimate.
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
      distanceMeters: objective === 'distance' ? matrixCost : straightMeters,
      durationSeconds: objective === 'duration' ? matrixCost : straightMeters / 8,
      candidatesVisited: orderedWaypoints.length - fixedCount,
      candidatesTotal: candidates.length,
      estimated: true,
    }
  }
}
