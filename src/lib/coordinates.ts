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

/** Why a row's coordinates were rejected — used to categorize import errors. */
export type CoordReason = 'invalid' | 'range'

export type CoordResult =
  | { ok: true; point: LatLng }
  | { ok: false; reason: CoordReason }

/**
 * Validate raw lat/lng inputs, distinguishing *non-numeric/missing* (`invalid`)
 * from *out-of-Earth-bounds* (`range`) so the UI can report them separately.
 */
export function toLatLngResult(lat: unknown, lng: unknown): CoordResult {
  const nlat = coerce(lat)
  const nlng = coerce(lng)
  if (nlat === null || nlng === null) return { ok: false, reason: 'invalid' }
  if (nlat < -90 || nlat > 90 || nlng < -180 || nlng > 180) {
    return { ok: false, reason: 'range' }
  }
  return { ok: true, point: { lat: nlat, lng: nlng } }
}

/**
 * Build a validated LatLng from raw lat/lng inputs, enforcing Earth bounds.
 * Returns null if either value is missing, non-numeric, or out of range.
 */
export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  const r = toLatLngResult(lat, lng)
  return r.ok ? r.point : null
}

/** Human-friendly coordinate string, e.g. "55.67610, 12.56830". */
export function formatLatLng(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
}
