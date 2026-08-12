import type { LatLng } from '../../types'

/**
 * Camera maths and the small state machines the map chrome runs on.
 *
 * Kept out of the component so "what does the recenter button do next" is a
 * pure function with a truth table, not a chain of conditionals tangled into a
 * click handler.
 */

/** [[west, south], [east, north]] — MapLibre's `LngLatBoundsLike` tuple form. */
export type BoundsTuple = [[number, number], [number, number]]

/** Animations should feel like the map is following the UI, not racing it. */
export const CAMERA_DURATION_MS = 400

/** Zoom used when focusing a single stop — close enough to read the street. */
export const FOCUS_ZOOM = 16

/** A map position. Where the map opens, and what gets remembered. */
export interface Camera {
  center: LatLng
  zoom: number
}

/**
 * Copenhagen, at a zoom that frames the city and its suburbs.
 *
 * The floor of the opening ladder — see lib/map/lastCamera.ts — and the reason
 * there is no longer a world view anywhere. The map used to open at `zoom: 2`
 * on a centre that was ALREADY these coordinates, so the only thing the zoom
 * accomplished was hiding the right answer behind an ocean.
 *
 * A home region beats a world view even when it is the wrong region: a wrong
 * city is one gesture from right, where zoom 2 is five.
 */
export const HOME: Camera = { center: { lat: 55.6761, lng: 12.5683 }, zoom: 11 }

/**
 * Padding around a fitted bounds, in px.
 *
 * Asymmetric on purpose: the finish pill sits top-right and the bottom sheet
 * covers the lower part of the screen, so a symmetric fit would tuck stops
 * underneath both. M5 owns the sheet and can raise `bottom` when it knows the
 * real detent height.
 */
export const FIT_PADDING = { top: 72, right: 48, bottom: 160, left: 48 }

export function boundsOf(points: LatLng[]): BoundsTuple | null {
  if (points.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    if (p.lng < west) west = p.lng
    if (p.lng > east) east = p.lng
    if (p.lat < south) south = p.lat
    if (p.lat > north) north = p.lat
  }
  if (west === Infinity) return null
  return [
    [west, south],
    [east, north],
  ]
}

/**
 * True when a bounds is a single location rather than an area.
 *
 * `fitBounds` on a zero-area bounds zooms to the maximum, which lands the user
 * on a rooftop with no context. The caller centres instead.
 */
export function isDegenerate(bounds: BoundsTuple, epsilon = 1e-7): boolean {
  return (
    Math.abs(bounds[1][0] - bounds[0][0]) < epsilon &&
    Math.abs(bounds[1][1] - bounds[0][1]) < epsilon
  )
}

export function centerOf(bounds: BoundsTuple): LatLng {
  return {
    lng: (bounds[0][0] + bounds[1][0]) / 2,
    lat: (bounds[0][1] + bounds[1][1]) / 2,
  }
}

// ──────────────────────────────────────────────────── the recenter cycle

/**
 * What repeated taps on recenter walk through.
 *
 * The point is that one button answers three questions without three buttons:
 * "where is this stop", "where is everything", "what does the drive look
 * like". Tapping again always shows you more, and wraps.
 */
export type RecenterPhase = 'stop' | 'stops' | 'route'

const CYCLE: RecenterPhase[] = ['stop', 'stops', 'route']

export interface RecenterAvailability {
  /** A stop is selected, so "focus it" is a meaningful destination. */
  stop: boolean
  /** The route has at least one stop. */
  stops: boolean
  /** The route has been solved, so there is a driven line to frame. */
  route: boolean
}

/**
 * The next phase after `current`, skipping any that make no sense right now.
 *
 * Returns null when nothing at all is available — an empty route with no
 * selection — and the caller leaves the camera alone rather than flying to
 * a bounds computed from zero points.
 */
export function nextRecenterPhase(
  current: RecenterPhase | null,
  available: RecenterAvailability,
): RecenterPhase | null {
  const usable = CYCLE.filter((phase) => available[phase])
  if (usable.length === 0) return null
  if (current === null) return usable[0]
  const index = usable.indexOf(current)
  // A phase that has since become unavailable (the stop was deselected)
  // restarts the cycle rather than getting stuck.
  if (index === -1) return usable[0]
  return usable[(index + 1) % usable.length]
}

// ─────────────────────────────────────────────── the contextual FAB slot

/**
 * The second FAB changes with what is on screen, because the question you
 * have differs: with nothing planned you want to know where YOU are; looking
 * at a whole route you want it framed; with a stop selected you want to get
 * back to it after panning away.
 *
 * The first FAB is always the basemap toggle and is not modelled here — its
 * whole value is that it never moves.
 */
export type ContextualFab = 'my-location' | 'fit-route' | 'focus-stop'

export function contextualFab(state: {
  selectedStopId: string | null
  stopCount: number
}): ContextualFab {
  if (state.selectedStopId) return 'focus-stop'
  if (state.stopCount > 0) return 'fit-route'
  return 'my-location'
}
