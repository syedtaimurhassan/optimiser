import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute } from '../types'

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle (straight-line) distance between two coordinates, in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s))
}

function pathDistance(points: LatLng[]): number {
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += haversine(points[i], points[i + 1])
  }
  return total
}

/**
 * Greedy nearest-neighbor tour: start fixed first, visit the closest unvisited
 * waypoint each step, end fixed last. Gives a decent initial ordering.
 */
function nearestNeighbor(start: LatLng, mids: LatLng[], end: LatLng): LatLng[] {
  const remaining = [...mids]
  const tour: LatLng[] = [start]
  let current = start

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(current, remaining[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    current = remaining.splice(bestIdx, 1)[0]
    tour.push(current)
  }

  tour.push(end)
  return tour
}

/**
 * 2-opt local search. Repeatedly reverses tour segments when doing so shortens
 * the total path, leaving the first (start) and last (end) stops fixed.
 * O(n²) per sweep — trivially fast for ~100 stops.
 */
function twoOpt(tour: LatLng[]): LatLng[] {
  const n = tour.length
  if (n < 4) return tour

  const best = tour.slice()
  let improved = true

  while (improved) {
    improved = false
    // i..j is the segment we consider reversing; endpoints (0 and n-1) stay put.
    for (let i = 1; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        const a = best[i - 1]
        const b = best[i]
        const c = best[j]
        const d = best[j + 1]
        // Change in length if we reverse [i..j]: new edges (a,c)+(b,d) vs old (a,b)+(c,d).
        const delta =
          haversine(a, c) + haversine(b, d) - (haversine(a, b) + haversine(c, d))
        if (delta < -1e-6) {
          let lo = i
          let hi = j
          while (lo < hi) {
            const tmp = best[lo]
            best[lo] = best[hi]
            best[hi] = tmp
            lo++
            hi--
          }
          improved = true
        }
      }
    }
  }

  return best
}

/**
 * Compute an optimized visiting order entirely in the browser — no network,
 * no server. `start` stays first and `end` stays last; the waypoints in between
 * are reordered to minimize total straight-line travel.
 *
 * Distance/duration are straight-line ESTIMATES (see `estimated: true`); the
 * real road route is produced by the Google Maps hand-off links.
 */
export function optimizeRoute(
  start: LatLng,
  waypoints: LatLng[],
  end: LatLng,
): OptimizedRoute {
  const ordered = twoOpt(nearestNeighbor(start, waypoints, end))
  const distanceMeters = pathDistance(ordered)

  const geometry: LineString = {
    type: 'LineString',
    coordinates: ordered.map((p) => [p.lng, p.lat]),
  }

  // Rough driving estimate: straight-line * 1.3 detour factor at ~25 km/h urban.
  const estRoadMeters = distanceMeters * 1.3
  const durationSeconds = estRoadMeters / ((25 * 1000) / 3600)

  return {
    orderedWaypoints: ordered,
    geometry,
    distanceMeters,
    durationSeconds,
    estimated: true,
  }
}
