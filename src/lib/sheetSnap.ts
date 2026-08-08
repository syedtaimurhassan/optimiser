/**
 * The bottom sheet's detents, and where a gesture lands.
 *
 * ── Why this is a pure module and not part of the component ───────────────
 *
 * "Where does a flick end up?" is the single most felt piece of behaviour in
 * this app, and inside a pointer handler it is only testable by dragging a
 * real thumb across a real phone and forming an opinion. Here it is four
 * functions with inputs and outputs, so momentum, the short-viewport case, and
 * "a fling never moves backwards" are assertions instead of vibes.
 *
 * The component owns pixels and animation; this owns the decision.
 */

/**
 * The four snap points, ordered SMALLEST SHEET FIRST — which is largest
 * offset first, since offset is how far the sheet is pushed down.
 *
 *   collapsed  the summary strip only
 *   medium     a stop detail card, or a glance at the top of the list
 *   expanded   header + the full scrollable list
 *   full       search focused, keyboard up
 */
export const SNAPS = ['collapsed', 'medium', 'expanded', 'full'] as const

export type SheetSnap = (typeof SNAPS)[number]

export type SnapOffsets = Record<SheetSnap, number>

export interface SnapGeometryInput {
  /** Usable viewport height in px. */
  viewportHeight: number
  /** Measured height of the grab handle + header + summary strip. */
  collapsedHeight: number
  /** Status bar / notch, kept clear at the largest detents. */
  topInset?: number
}

/** The sheet's VISIBLE height at each detent. */
export function snapHeights(input: SnapGeometryInput): SnapOffsets {
  const { viewportHeight, collapsedHeight, topInset = 24 } = input

  const full = Math.max(viewportHeight - topInset, 0)
  const expanded = Math.round(viewportHeight * 0.88)
  const medium = Math.round(viewportHeight * 0.45)

  // Clamped into a monotonic ladder rather than trusted. On a short landscape
  // viewport the percentages can fall BELOW the measured collapsed height, and
  // a detent smaller than the collapsed one would let the sheet snap to a
  // position that hides its own header — the one part that must always be
  // reachable. Ties are allowed: two detents at the same height simply means
  // that drag has nowhere further to go, which is honest.
  const heights = {
    collapsed: Math.min(collapsedHeight, full),
    medium: 0,
    expanded: 0,
    full,
  }
  heights.medium = clamp(medium, heights.collapsed, full)
  heights.expanded = clamp(expanded, heights.medium, full)

  return heights
}

/** `translateY` at each detent: how far down from fully open the sheet sits. */
export function snapOffsets(input: SnapGeometryInput): SnapOffsets {
  const heights = snapHeights(input)
  const { viewportHeight } = input
  return {
    collapsed: viewportHeight - heights.collapsed,
    medium: viewportHeight - heights.medium,
    expanded: viewportHeight - heights.expanded,
    full: viewportHeight - heights.full,
  }
}

/** Past this speed the gesture is a fling, and direction beats position. px/ms. */
export const FLING_VELOCITY = 0.5

export interface SnapDecision {
  /** Current offset, mid-drag. */
  offset: number
  /** px/ms. POSITIVE is downward — the sheet closing. */
  velocity: number
  offsets: SnapOffsets
}

/**
 * Where the sheet settles when the finger lifts.
 *
 * A slow drag goes to whichever detent is nearest, which is what "I placed it
 * there" should mean. A fling goes to the next detent PAST where the finger
 * let go, in the direction of travel — not "one detent from where the gesture
 * started", which would send a long drag followed by a flick backwards past
 * the user's own thumb.
 */
export function snapFor({ offset, velocity, offsets }: SnapDecision): SheetSnap {
  if (Math.abs(velocity) < FLING_VELOCITY) return nearestSnap(offset, offsets)

  const downward = velocity > 0

  // SNAPS runs smallest sheet → largest, i.e. largest offset → smallest.
  const ordered = downward ? [...SNAPS].reverse() : [...SNAPS]

  // The first detent strictly beyond the release point. A tolerance keeps a
  // fling that begins exactly at rest from finding "beyond" to be the detent
  // it is already sitting on.
  const beyond = ordered.find((snap) =>
    downward ? offsets[snap] > offset + 1 : offsets[snap] < offset - 1,
  )

  return beyond ?? (downward ? 'collapsed' : 'full')
}

/** The detent whose offset is closest. Ties resolve to the larger sheet. */
export function nearestSnap(offset: number, offsets: SnapOffsets): SheetSnap {
  let best: SheetSnap = 'collapsed'
  let bestDistance = Number.POSITIVE_INFINITY
  for (const snap of SNAPS) {
    const distance = Math.abs(offsets[snap] - offset)
    if (distance < bestDistance) {
      best = snap
      bestDistance = distance
    }
  }
  return best
}

/** Keep a drag inside the ladder. The sheet does not tear off the top. */
export function clampOffset(offset: number, offsets: SnapOffsets): number {
  return clamp(offset, offsets.full, offsets.collapsed)
}

/** The detent one step towards the open end — what tapping the handle does. */
export function nextSnapUp(snap: SheetSnap): SheetSnap {
  return SNAPS[Math.min(SNAPS.indexOf(snap) + 1, SNAPS.length - 1)]
}

export function prevSnapDown(snap: SheetSnap): SheetSnap {
  return SNAPS[Math.max(SNAPS.indexOf(snap) - 1, 0)]
}

/**
 * Whether the list inside the sheet may scroll at this detent.
 *
 * Below `expanded` it may not, and that is the first half of the nested-scroll
 * fix: with no competing scroller there is nothing to arbitrate, and every
 * drag on a half-open sheet is unambiguously the sheet's.
 */
export function listScrolls(snap: SheetSnap): boolean {
  return snap === 'expanded' || snap === 'full'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
