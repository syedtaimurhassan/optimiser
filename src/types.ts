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
