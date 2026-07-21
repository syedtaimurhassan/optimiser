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

/** A saved, named scenario the user can reload later (kept in local storage). */
export interface Favorite {
  id: string
  name: string
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LatLng[]
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
  /** How many candidate stops the route visits (excludes fixed start/end). */
  candidatesVisited: number
  /** How many candidate stops were available to choose from. */
  candidatesTotal: number
  /** True when distance/duration are straight-line estimates (no road router). */
  estimated?: boolean
}
