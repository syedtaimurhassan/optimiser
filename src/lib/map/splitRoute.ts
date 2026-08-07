import type { Feature, FeatureCollection, LineString, Position } from 'geojson'
import type { LatLng } from '../../types'

/**
 * Split the driven route into "already done" and "still to drive".
 *
 * Two lines of different weight and colour say which is which with no legend
 * and no reading — the single most useful thing the map can tell a driver at a
 * glance. This module does the geometry; `layers.ts` does the styling.
 *
 * The split point is the last stop the driver has already handled. Its
 * coordinate will not be a vertex of the road geometry (the router returns the
 * road centreline, the stop is a doorway), so we snap to the nearest vertex
 * and share it between both lines — sharing is what stops a one-pixel gap
 * appearing at the join.
 */

export type RouteLeg = 'visited' | 'remaining'

export interface LegProps {
  leg: RouteLeg
  [key: string]: string
}

const EMPTY: FeatureCollection<LineString, LegProps> = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * Squared distance with a longitude correction.
 *
 * Nearest-vertex only needs a monotonic metric, not metres — but raw
 * lat/lng² is wrong at latitude, where a degree of longitude is much shorter
 * than a degree of latitude. Copenhagen is at 55°N, where the error is a
 * factor of ~1.8: enough to snap to the wrong vertex where a road doubles
 * back. cos(lat) costs one call and removes the whole class of bug.
 */
function distanceSq(a: Position, b: LatLng): number {
  const scale = Math.cos((b.lat * Math.PI) / 180)
  const dx = (a[0] - b.lng) * scale
  const dy = a[1] - b.lat
  return dx * dx + dy * dy
}

/** Index of the geometry vertex closest to `point`. -1 for an empty line. */
export function nearestVertexIndex(coordinates: Position[], point: LatLng): number {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < coordinates.length; i++) {
    const d = distanceSq(coordinates[i], point)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/**
 * @param geometry  the solved route's LineString, or null when unsolved
 * @param splitAt   the last handled stop, or null when nothing is done yet
 */
export function splitRouteGeometry(
  geometry: LineString | null | undefined,
  splitAt: LatLng | null,
): FeatureCollection<LineString, LegProps> {
  const coords = geometry?.coordinates
  // A single point is not a line; MapLibre would accept it and draw nothing,
  // but returning it invites downstream code to assume it has two ends.
  if (!coords || coords.length < 2) return EMPTY

  // Nothing handled yet — the entire route is still ahead.
  if (!splitAt) return { type: 'FeatureCollection', features: [leg('remaining', coords)] }

  const index = nearestVertexIndex(coords, splitAt)

  // The split landed on an end: one leg is degenerate, so emit only the other
  // rather than a two-point stub that renders as a dot.
  if (index <= 0) return { type: 'FeatureCollection', features: [leg('remaining', coords)] }
  if (index >= coords.length - 1) {
    return { type: 'FeatureCollection', features: [leg('visited', coords)] }
  }

  return {
    type: 'FeatureCollection',
    features: [
      // The shared vertex at `index` appears in both, closing the join.
      leg('visited', coords.slice(0, index + 1)),
      leg('remaining', coords.slice(index)),
    ],
  }
}

function leg(kind: RouteLeg, coordinates: Position[]): Feature<LineString, LegProps> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: { leg: kind },
  }
}
