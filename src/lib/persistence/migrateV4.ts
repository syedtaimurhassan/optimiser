import type { AddressedStop, Route, Favorite, OptimizedRoute, LatLng } from '../../types'
import { stopIdForPosition, type StopIdMode } from '../stopIds.ts'

/**
 * schemaVersion 3 → 4: the single implicit session becomes a multi-route model
 * with addressed stops and immutable stop IDs.
 *
 * Pure and side-effect free so it can be unit-tested without a database. The
 * caller does the I/O; this only decides what the new shape should be.
 *
 * Rules, all deliberate:
 *  - `stopId` is synthesised from `num` through the block allocator, so a stop
 *    that was #37 becomes "D7" — the label a driver would have written.
 *  - `originalPosition` = `num`, preserving where the stop sat in the original
 *    round even though nothing recorded that explicitly before.
 *  - `delivered: true` → `status: 'delivered'`, with a synthetic history entry
 *    so Undo works on migrated stops. Its timestamp is the migration time and
 *    is marked as such — we genuinely do not know when it was delivered, and
 *    inventing a plausible past time would be worse than an honest one.
 *  - `address` stays undefined. Coordinate-only stops remain legal; geocoding
 *    is M6's job.
 */

/** The v2/v3 stop shape. */
export interface LegacyStopV3 {
  id?: string
  num?: number
  lat: number
  lng: number
  delivered?: boolean
}

/** The v2/v3 persisted session. */
export interface LegacySessionV3 {
  startLocation?: LatLng | null
  endLocation?: LatLng | null
  waypoints?: LegacyStopV3[]
  targetK?: number | null
  objective?: string
  optimizedRoute?: unknown
  favorites?: Array<Record<string, unknown>>
  routeMode?: string
  searchQuality?: string
}

export interface MigratedV4 {
  routes: Record<string, Route>
  activeRouteId: string | null
  favorites: Favorite[]
  stopIdMode: StopIdMode
}

/** The search tiers the old `searchQuality` names mapped to, in seconds. */
const TIER_SECONDS: Record<string, number> = { fast: 1, deep: 3, maximum: 5 }

const isLatLng = (v: unknown): v is LatLng =>
  !!v && typeof v === 'object' &&
  typeof (v as LatLng).lat === 'number' &&
  typeof (v as LatLng).lng === 'number'

/**
 * Convert one legacy stop.
 *
 * `fallbackPosition` covers rows with no `num` at all — possible in payloads
 * that predate stable numbering. Position is 1-based.
 */
export function migrateStop(
  legacy: LegacyStopV3,
  fallbackPosition: number,
  mode: StopIdMode,
  nowMs: number,
  makeId: () => string,
): AddressedStop {
  const originalPosition =
    Number.isInteger(legacy.num) && (legacy.num as number) >= 1
      ? (legacy.num as number)
      : fallbackPosition

  const delivered = legacy.delivered === true

  return {
    id: legacy.id ?? makeId(),
    stopId: stopIdForPosition(originalPosition, mode),
    originalPosition,
    lat: legacy.lat,
    lng: legacy.lng,
    kind: 'delivery',
    order: 'auto',
    status: delivered ? 'delivered' : 'pending',
    // A synthetic entry, so Undo has something to step back through. The
    // timestamp is the migration moment because the real one was never stored.
    statusHistory: delivered ? [{ status: 'delivered' as const, atMs: nowMs }] : [],
  }
}

/**
 * Convert a legacy session into the v4 model.
 *
 * Never throws: a malformed field is dropped rather than allowed to abort the
 * migration, because losing one stop is survivable and failing to boot is not.
 */
export function migrateSessionToV4(
  legacy: LegacySessionV3,
  options: {
    routeId: string
    dateISO: string
    nowMs: number
    makeId: () => string
    name?: string
    stopIdMode?: StopIdMode
  },
): MigratedV4 {
  const { routeId, dateISO, nowMs, makeId } = options
  const mode: StopIdMode = options.stopIdMode ?? 'letterBlock'

  const rawStops = Array.isArray(legacy.waypoints) ? legacy.waypoints : []
  const stops: AddressedStop[] = rawStops
    .filter((w) => w && typeof w.lat === 'number' && typeof w.lng === 'number')
    .map((w, i) => migrateStop(w, i + 1, mode, nowMs, makeId))

  const endpointMode = legacy.routeMode === 'open' ? 'open' : 'fixed'
  const start = endpointMode === 'open' ? null : isLatLng(legacy.startLocation) ? legacy.startLocation : null
  const end = endpointMode === 'open' ? null : isLatLng(legacy.endLocation) ? legacy.endLocation : null

  const route: Route = {
    id: routeId,
    name: options.name ?? 'Imported session',
    dateISO,
    status: 'active',
    start,
    end,
    endpointMode,
    stops,
    groups: [],
    breaks: [],
    optimizeBy: legacy.objective === 'distance' ? 'distance' : 'duration',
    searchTierSec: TIER_SECONDS[String(legacy.searchQuality)] ?? 3,
    targetK:
      typeof legacy.targetK === 'number' && Number.isFinite(legacy.targetK)
        ? legacy.targetK
        : null,
    optimized: migrateOptimizedRoute(legacy.optimizedRoute, stops),
    createdAt: nowMs,
    updatedAt: nowMs,
  }

  const favorites: Favorite[] = (Array.isArray(legacy.favorites) ? legacy.favorites : [])
    .filter((f) => f && typeof f.id === 'string')
    .map((f) => ({
      id: String(f.id),
      name: typeof f.name === 'string' ? f.name : 'Saved route',
      startLocation: isLatLng(f.startLocation) ? f.startLocation : null,
      endLocation: isLatLng(f.endLocation) ? f.endLocation : null,
      waypoints: Array.isArray(f.waypoints) ? (f.waypoints as LatLng[]).filter(isLatLng) : [],
    }))

  return { routes: { [routeId]: route }, activeRouteId: routeId, favorites, stopIdMode: mode }
}

/**
 * Carry an existing optimised route forward, backfilling the two new fields.
 *
 * `orderedStopIds` is reconstructed by coordinate lookup — the only join the old
 * model supported. That is exactly the ambiguity M2 exists to remove, so where
 * two stops share a coordinate this resolves to the first and records `null`
 * for anything it cannot place. The result is a display convenience; the next
 * optimisation replaces it with authoritative data.
 */
function migrateOptimizedRoute(raw: unknown, stops: AddressedStop[]): OptimizedRoute | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const old = raw as Partial<OptimizedRoute>
  if (!Array.isArray(old.orderedWaypoints) || !old.geometry) return undefined

  const byCoord = new Map<string, string>()
  for (const st of stops) {
    const key = `${st.lat},${st.lng}`
    if (!byCoord.has(key)) byCoord.set(key, st.id)
  }

  const orderedStopIds = old.orderedWaypoints.map((p) => byCoord.get(`${p.lat},${p.lng}`) ?? null)

  return {
    orderedWaypoints: old.orderedWaypoints,
    orderedStopIds,
    // Unknown for a route optimised before arrival times were recorded.
    arrivalSec: [],
    geometry: old.geometry,
    distanceMeters: old.distanceMeters ?? 0,
    durationSeconds: old.durationSeconds ?? 0,
    candidatesVisited: old.candidatesVisited ?? 0,
    candidatesTotal: old.candidatesTotal ?? stops.length,
    estimated: old.estimated,
  }
}
