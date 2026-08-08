/**
 * Where a horizontal swipe lands the stop carousel.
 *
 * The sibling of `sheetSnap.ts`, and here for the same reason: "does this
 * gesture turn the page?" is the most felt decision in the app after the
 * sheet's own detents, and inside a pointer handler it is only testable by
 * dragging a real thumb across a real phone and forming an opinion. Here it is
 * one function with a truth table.
 *
 * ── The two ways a page turns ─────────────────────────────────────────────
 *
 * Distance OR speed, never both required. A deliberate drag past a threshold
 * turns the page because the driver dragged it there; a quick flick turns it
 * because the driver flicked it, even though the card barely moved. Requiring
 * distance alone makes the carousel feel heavy on a phone held one-handed,
 * which is the only way this screen is ever held.
 */

/** Past this speed a gesture is a flick and distance stops mattering. px/ms. */
export const PAGE_FLING_VELOCITY = 0.4

/**
 * How far a slow drag must travel to turn the page, as a fraction of the page.
 *
 * A quarter, not a half. The card is a page in a carousel, not a switch being
 * thrown — by the time a quarter of the outgoing card has left the screen, the
 * driver can already read the incoming one and has committed.
 */
export const PAGE_COMMIT_RATIO = 0.25

/** How long the card takes to slide home. The camera takes longer — see camera.ts. */
export const PAGE_SLIDE_MS = 280

export interface PageDecision {
  /** The page the gesture started on. */
  index: number
  /** Horizontal travel in px. NEGATIVE is leftward — towards the NEXT page. */
  dx: number
  /** px/ms, signed like `dx`. */
  velocity: number
  /** The width of one page, in px. */
  width: number
  /** How many pages there are. */
  count: number
}

/**
 * The page the carousel settles on when the finger lifts.
 *
 * Always at most ONE page away. A carousel that can skip pages on a hard flick
 * would let a driver overshoot the stop they are standing outside — and unlike
 * a photo gallery, every page here is a place someone has to physically go.
 */
export function pageFor({ index, dx, velocity, width, count }: PageDecision): number {
  if (count <= 0) return 0

  const flung = Math.abs(velocity) >= PAGE_FLING_VELOCITY
  const dragged = width > 0 && Math.abs(dx) >= width * PAGE_COMMIT_RATIO

  if (!flung && !dragged) return clamp(index, count)

  // Direction comes from the FLICK when there is one, and from the distance
  // otherwise. They disagree exactly when a drag reverses at the last instant,
  // and the last instant is the one the driver meant.
  const step = (flung ? velocity : dx) < 0 ? 1 : -1
  return clamp(index + step, count)
}

/**
 * Rubber-banding at the ends.
 *
 * A drag past the first or last page still moves, at a third of the distance,
 * because a card nailed to the edge reads as a broken gesture rather than as
 * the end of the list. The resistance says "there is nothing here" without
 * having to say it.
 */
export function resist(dx: number, index: number, count: number): number {
  const atStart = index <= 0 && dx > 0
  const atEnd = index >= count - 1 && dx < 0
  return atStart || atEnd ? dx / 3 : dx
}

function clamp(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1)
}
