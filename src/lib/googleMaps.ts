import type { LatLng } from '../types'

const MAPS_BASE = 'https://www.google.com/maps'

/**
 * Max intermediate waypoints Google Maps accepts in a single directions URL.
 * (Origin and destination are separate and don't count toward this.)
 * Conservative, documented value — routes above this are split into batches.
 */
export const MAX_WAYPOINTS_PER_URL = 9

/** Google Maps expects "lat,lng" (note: the reverse of OSRM's "lng,lat"). */
function coord(p: LatLng): string {
  return `${p.lat},${p.lng}`
}

/** A "search" link that drops a pin on a single coordinate. */
export function googleMapsSearchUrl(point: LatLng): string {
  const params = new URLSearchParams({ api: '1', query: coord(point) })
  return `${MAPS_BASE}/search/?${params.toString()}`
}

export interface DirectionsBatch {
  url: string
  /** 0-based index (in the ordered sequence) of this batch's origin. */
  fromIndex: number
  /** 0-based index of this batch's destination. */
  toIndex: number
}

/**
 * Build one or more Google Maps Directions URLs from an ordered stop sequence
 * (start first, end last).
 *
 * If the intermediate waypoints exceed Google's per-URL limit, the route is
 * split into chained batches: each batch's destination is the next batch's
 * origin, so following them in order traverses the whole route without gaps.
 */
export function googleMapsDirectionsBatches(ordered: LatLng[]): DirectionsBatch[] {
  if (ordered.length < 2) return []

  // Points consumed per batch. We advance by (MAX + 1) so consecutive batches
  // share exactly one boundary point (prev destination === next origin).
  const step = MAX_WAYPOINTS_PER_URL + 1
  const batches: DirectionsBatch[] = []

  for (let i = 0; i < ordered.length - 1; i += step) {
    const segment = ordered.slice(i, i + step + 1) // origin + up to MAX wp + destination
    const origin = segment[0]
    const destination = segment[segment.length - 1]
    const waypoints = segment.slice(1, -1)

    const params = new URLSearchParams({
      api: '1',
      origin: coord(origin),
      destination: coord(destination),
      travelmode: 'driving',
    })
    if (waypoints.length > 0) {
      params.set('waypoints', waypoints.map(coord).join('|'))
    }

    batches.push({
      url: `${MAPS_BASE}/dir/?${params.toString()}`,
      fromIndex: i,
      toIndex: i + segment.length - 1,
    })
  }

  return batches
}
