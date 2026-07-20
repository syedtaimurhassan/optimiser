import type { LatLng } from '../types'

/**
 * Coerce an unknown value (string from CSV, number from JSON, null, etc.)
 * into a finite number, or null if it can't be a valid coordinate component.
 *
 * Note: we deliberately do NOT use `Number(v)` alone, because `Number('')`
 * and `Number(null)` both return 0 — which would silently pass as valid.
 */
function coerce(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const n = parseFloat(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Build a validated LatLng from raw lat/lng inputs, enforcing Earth bounds.
 * Returns null if either value is missing, non-numeric, or out of range.
 */
export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  const nlat = coerce(lat)
  const nlng = coerce(lng)
  if (nlat === null || nlng === null) return null
  if (nlat < -90 || nlat > 90) return null
  if (nlng < -180 || nlng > 180) return null
  return { lat: nlat, lng: nlng }
}

/** Human-friendly coordinate string, e.g. "55.67610, 12.56830". */
export function formatLatLng(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
}
