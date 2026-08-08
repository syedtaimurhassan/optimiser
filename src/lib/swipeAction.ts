import type { StopStatus } from '../types.ts'

/**
 * Swiping a route row to mark it.
 *
 * ── Which way is which ────────────────────────────────────────────────────
 *
 * Right — towards the driver's thumb on a right-handed grip, revealing green
 * from the left — is DELIVERED. Left is FAILED. That is the direction
 * convention every mail app has trained thumbs on for a decade, and inventing
 * a better one would cost more than it could possibly win.
 *
 * ── Why swiping again undoes ──────────────────────────────────────────────
 *
 * The gesture toggles rather than sets. A driver who marks the wrong row —
 * which is the failure mode a swipe introduces, since it needs no aim — fixes
 * it by repeating the gesture they just made, in the same direction, on the
 * same row. Making undo the OPPOSITE swipe would mean the correction for a
 * mis-delivered row is "swipe left", which also happens to be the gesture for
 * marking it failed.
 */

/** How far a row must travel before the swipe commits. */
export const SWIPE_COMMIT_PX = 96

/** Past this speed a flick commits without the full distance. px/ms. */
export const SWIPE_FLING_VELOCITY = 0.5

/**
 * …but never on distance alone below this.
 *
 * A fast, tiny movement is a tap with a shaky hand, and a tap must never
 * change a delivery status.
 */
export const SWIPE_FLING_MIN_PX = 32

export type SwipeSide = 'delivered' | 'failed'

export interface SwipeState {
  /** Which status this direction is heading for, or null if it hasn't moved. */
  side: SwipeSide | null
  /** True when releasing now would commit. Drives the row's colour. */
  armed: boolean
  /** True when committing would UNDO rather than set — the row is already there. */
  undo: boolean
}

/** What the row should look like right now, mid-drag. */
export function swipeState(dx: number, status: StopStatus): SwipeState {
  const side: SwipeSide | null = dx > 0 ? 'delivered' : dx < 0 ? 'failed' : null
  return {
    side,
    armed: Math.abs(dx) >= SWIPE_COMMIT_PX,
    undo: side !== null && status === side,
  }
}

export type SwipeOutcome =
  | { kind: 'none' }
  | { kind: 'set'; status: SwipeSide }
  | { kind: 'undo' }

export interface SwipeDecision {
  dx: number
  velocity: number
  /** The row's status right now. */
  status: StopStatus
}

/** What releasing the finger does. */
export function swipeOutcome({ dx, velocity, status }: SwipeDecision): SwipeOutcome {
  const distance = Math.abs(dx)
  const flung = Math.abs(velocity) >= SWIPE_FLING_VELOCITY && distance >= SWIPE_FLING_MIN_PX
  if (!flung && distance < SWIPE_COMMIT_PX) return { kind: 'none' }

  const side: SwipeSide = dx > 0 ? 'delivered' : 'failed'
  return status === side ? { kind: 'undo' } : { kind: 'set', status: side }
}
