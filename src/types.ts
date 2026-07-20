import type { LineString } from 'geojson'

/** A geographic coordinate pair. This is the core data shape used across the app. */
export interface LatLng {
  lat: number
  lng: number
}

/** Result of parsing an uploaded file into waypoints, plus any per-row issues. */
export interface ParseResult {
  waypoints: LatLng[]
  errors: string[]
}

/** The optimized route returned by the OSRM Trip service. */
export interface OptimizedRoute {
  /**
   * The full stop sequence in optimal visiting order: start first, end last,
   * with the intermediate waypoints reordered by OSRM.
   */
  orderedWaypoints: LatLng[]
  /** GeoJSON LineString of the driving route geometry ([lng, lat] pairs). */
  geometry: LineString
  /** Total driving distance in meters. */
  distanceMeters: number
  /** Total driving duration in seconds. */
  durationSeconds: number
}
