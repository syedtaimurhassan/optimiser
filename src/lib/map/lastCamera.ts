import { getMeta, setMeta } from '../persistence/db.ts'
import { HOME, type Camera } from './camera.ts'
import type { LatLng } from '../../types'

/**
 * Where the map opens.
 *
 * ── The defect this replaces ──────────────────────────────────────────────
 *
 * The controller opened at `zoom: 2` — the whole world, ocean and all — on a
 * centre that was already Copenhagen. A route WITH stops was framed a moment
 * later by MapComponent, so the world view only ever showed on an empty
 * route: a first run, and every newly created route. Which is precisely when
 * a driver has the least idea what they are looking at.
 *
 * ── The ladder, and why it is this one ────────────────────────────────────
 *
 * Google's own launch-viewport work (US 2014/0218392) describes choosing
 * between the previous map and the current location using elapsed time and
 * distance travelled, rather than picking one and always doing it. Every
 * serious map app lands somewhere on that idea. This is the small version:
 *
 *   1. The route has stops   → frame them. Owned by MapComponent, not here.
 *   2. A recent saved camera → where the driver left it.
 *   3. Otherwise             → HOME, at a zoom that shows a city.
 *   4. Asynchronously        → the real position, IF already permitted.
 *
 * Nothing in the ladder blocks. Steps 2 and 3 are synchronous and always
 * produce an answer, so the map is never waiting on a disk read or a GPS fix
 * to draw its first frame. Step 4 is an upgrade that may never arrive.
 *
 * Framework-free: no React, no store, no MapLibre. The policy is a pure
 * function of a saved value and a clock, which is what makes it testable.
 */

/** What goes to disk. Flat and primitive, so a bad row is easy to reject. */
export interface SavedCamera {
  lat: number
  lng: number
  zoom: number
  savedAt: number
}

/**
 * How long a remembered camera stays worth restoring.
 *
 * uiStore says transient UI is never persisted, and names "a stale map camera"
 * as the reason. That objection is right and this is the answer to it rather
 * than a dismissal of it: a month-old view of the round you drive daily is
 * still useful, a year-old view from a holiday is not.
 */
export const CAMERA_TTL_MS = 30 * 24 * 60 * 60 * 1000

const META_KEY = 'map:lastCamera'

/** Below this the view is continental; above it MapLibre has no more detail. */
const MIN_ZOOM = 4
const MAX_ZOOM = 20

/**
 * Whether a saved camera can be trusted.
 *
 * Validated rather than assumed because this comes off disk, where a partial
 * write, a hand-edited row or an older schema can all produce something that
 * is shaped right and numerically absurd. `NaN` passes a `typeof` check and
 * then silently moves the map nowhere, which is the worst of both.
 */
export function isUsable(
  saved: SavedCamera | null | undefined,
  now = Date.now(),
  ttlMs = CAMERA_TTL_MS,
): saved is SavedCamera {
  if (!saved) return false
  const { lat, lng, zoom, savedAt } = saved
  if (![lat, lng, zoom, savedAt].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return false
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  if (zoom < MIN_ZOOM || zoom > MAX_ZOOM) return false
  // A clock that has gone backwards (a device with the wrong date, then
  // corrected) must not permanently disqualify the saved view.
  if (savedAt > now) return true
  return now - savedAt <= ttlMs
}

/** Steps 2 and 3 of the ladder, as one pure function. */
export function pickInitialCamera(
  saved: SavedCamera | null | undefined,
  now = Date.now(),
  ttlMs = CAMERA_TTL_MS,
): Camera {
  if (!isUsable(saved, now, ttlMs)) return HOME
  return { center: { lat: saved.lat, lng: saved.lng }, zoom: saved.zoom }
}

// ─────────────────────────────────────────────────────────────── persistence

/**
 * The preloaded answer.
 *
 * Read once during boot, held here, and consumed SYNCHRONOUSLY when the map is
 * constructed. That ordering is the whole reason this cache exists: MapLibre
 * takes its centre and zoom in the constructor, so an async read would draw
 * one frame at HOME and then jump. The app already blocks first paint on
 * hydration, so the read is free — see `hydrateRoutesStore`.
 */
let cached: Camera | null = null

/** Boot hook. Never rejects: a camera is an optimisation, not a dependency. */
export async function preloadCamera(now = Date.now()): Promise<void> {
  try {
    cached = pickInitialCamera(await getMeta<SavedCamera>(META_KEY), now)
  } catch {
    cached = HOME
  }
}

/** Where the map should open, right now, with no awaiting. */
export function initialCamera(): Camera {
  return cached ?? HOME
}

/**
 * Remember where the driver left the map.
 *
 * Debounced, and written to the `meta` store rather than into the Zustand
 * persist blob. Both matter: `moveend` fires at the end of every pan and
 * pinch, and routesStore's blob holds every route, favourite and address
 * default — re-serialising all of it to record a map pan would make dragging
 * the map cost more than solving the route.
 */
const SAVE_DEBOUNCE_MS = 800
let timer: ReturnType<typeof setTimeout> | undefined

export function rememberCamera(center: LatLng, zoom: number): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const row: SavedCamera = { lat: center.lat, lng: center.lng, zoom, savedAt: Date.now() }
    // Guard the write with the same rule that guards the read, so a camera
    // that could never be restored is never stored either.
    if (!isUsable(row)) return
    cached = { center: { lat: row.lat, lng: row.lng }, zoom: row.zoom }
    void setMeta(META_KEY, row).catch(() => {
      // Quota, private browsing, a closed database. The map still works; it
      // just opens somewhere more general next time.
    })
  }, SAVE_DEBOUNCE_MS)
}

/** Tests only — the module-level cache and timer outlive a single case. */
export function resetCameraCache(): void {
  clearTimeout(timer)
  timer = undefined
  cached = null
}
