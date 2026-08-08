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
 * Join a solved point order back to the stops it came from.
 *
 * The planner is coordinate-only by design, so the caller has to do this — and
 * doing it twice, slightly differently, in two places is how the two ends of
 * an itinerary quietly disagree. Hence one function.
 *
 * ── Two stops at one door ────────────────────────────────────────────────
 *
 * Coordinates cannot identify a stop: two deliveries to one building share one
 * exactly. A plain `Map<"lat,lng", id>` therefore maps both ordered points to
 * the FIRST stop and drops the second from the itinerary entirely. Consuming
 * each match as it is used is what keeps the join one-to-one.
 */
export function joinOrderedStopIds<T extends LatLng & { id: string }>(
  orderedWaypoints: readonly LatLng[],
  candidates: readonly T[],
): (string | null)[] {
  const queued = new Map<string, string[]>()
  for (const stop of candidates) {
    const key = `${stop.lat},${stop.lng}`
    const list = queued.get(key)
    if (list) list.push(stop.id)
    else queued.set(key, [stop.id])
  }
  return orderedWaypoints.map((point) => queued.get(`${point.lat},${point.lng}`)?.shift() ?? null)
}

/**
 * What the pipeline can produce on its own.
 *
 * `orderedStopIds` and `arrivalSec` are the two fields it cannot fill: it is
 * handed bare coordinates and never sees stop identity, and an arrival time
 * needs the service time at each stop. The caller joins the result back to
 * stops and supplies both.
 *
 * `legSeconds` and `legMeters` ARE produced here — M7 stopped throwing away
 * what OSRM already returns, because per-leg times are what make an arrival
 * real rather than a share of a total.
 *
 * `matrix` and `matrixWaypointIndex` are M8's addition, and they keep this
 * module's coordinate-only contract intact: the index list says which of the
 * CALLER'S OWN `waypoints` each matrix row came from, positionally, with null
 * for an endpoint that is not one of them. The caller can therefore label the
 * matrix with its own stop ids without this module ever learning what a stop
 * is. Handing back the point coordinates instead would invite a join on
 * `lat,lng`, which is the identity bug M2 spent a milestone removing.
 */
export type PlannedRoute = Omit<OptimizedRoute, 'orderedStopIds' | 'arrivalSec'> & {
  legSeconds: number[]
  legMeters: number[]
  /** The N×N cost grid the solve ran on, worth caching rather than refetching. */
  matrix: number[][]
  /** Per matrix index: which `waypoints` entry it is, or null for an endpoint. */
  matrixWaypointIndex: (number | null)[]
}

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
}: PlanInput): Promise<PlannedRoute> {
  // Candidates = uploaded stops, minus any that coincide with a chosen
  // endpoint. Their positions in the caller's array are carried alongside, so
  // the caller can name the matrix's rows without this module seeing an id.
  const candidateIndices = waypoints
    .map((w, i) => (
      (startLocation && sameCoord(w, startLocation)) ||
      (endLocation && sameCoord(w, endLocation))
        ? -1
        : i
    ))
    .filter((i) => i >= 0)
  const candidates = candidateIndices.map((i) => waypoints[i])

  // Build the ordered point list: [start?, ...candidates, end?].
  const points: LatLng[] = [
    ...(startLocation ? [startLocation] : []),
    ...candidates,
    ...(endLocation ? [endLocation] : []),
  ]
  const matrixWaypointIndex: (number | null)[] = [
    ...(startLocation ? [null] : []),
    ...candidateIndices,
    ...(endLocation ? [null] : []),
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

  // Real cost along the chosen route (sum of matrix cells), and the per-leg
  // costs it is made of — which are the fallback for arrival times when the
  // road router is unreachable.
  let matrixCost = 0
  const matrixLegs: number[] = []
  for (let i = 0; i < visited.length - 1; i++) {
    const cell = matrix[visited[i]][visited[i + 1]]
    matrixLegs.push(cell)
    matrixCost += cell
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
      legSeconds: road.legSeconds,
      legMeters: road.legMeters,
      matrix,
      matrixWaypointIndex,
      candidatesVisited: orderedWaypoints.length - fixedCount,
      candidatesTotal: candidates.length,
      estimated: false,
    }
  } catch {
    // Fallback: straight-line geometry + haversine distance. Duration is the
    // real matrix sum only when we optimized on duration; otherwise estimate.
    const straightLegs: number[] = []
    let straightMeters = 0
    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      const metres = haversine(orderedWaypoints[i], orderedWaypoints[i + 1])
      straightLegs.push(metres)
      straightMeters += metres
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
      // The matrix legs ARE seconds when we optimised on duration — that is
      // what the matrix holds. Optimising on distance leaves no time source at
      // all, so the arrival times fall back to a crude 8 m/s rather than
      // pretending metres are seconds.
      legSeconds: objective === 'duration' ? matrixLegs : straightLegs.map((m) => m / 8),
      legMeters: objective === 'distance' ? matrixLegs : straightLegs,
      // Still worth caching: the matrix came from OSRM Table and is real. Only
      // the GEOMETRY leg of the pipeline failed.
      matrix,
      matrixWaypointIndex,
      candidatesVisited: orderedWaypoints.length - fixedCount,
      candidatesTotal: candidates.length,
      estimated: true,
    }
  }
}
