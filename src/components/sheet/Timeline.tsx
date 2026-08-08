/**
 * The vertical line joining consecutive rows.
 *
 * ── Why it is drawn per row and never as one tall element ─────────────────
 *
 * The obvious implementation is a single absolutely-positioned line spanning
 * the list. It cannot work here for two independent reasons:
 *
 *  1. The list is virtualised. Rows outside the window do not exist, so a line
 *     drawn across "the list" would have to know a total height React is not
 *     rendering, and would be wrong the instant a row is measured.
 *  2. Row heights vary — a note or a tag makes a row taller. A line positioned
 *     against estimated geometry would drift away from the rows it is meant to
 *     join.
 *
 * A segment per row, each spanning its own row's full height, is continuous by
 * construction: adjacent rows touch, so their segments touch, whatever height
 * either one turns out to be. The start and end rows draw half segments so the
 * line begins and ends AT them rather than running off into the header or the
 * footer.
 */

/** The gutter: fixed width so every title in the list starts at the same x. */
export const GUTTER_CLASS = 'relative flex w-14 shrink-0 justify-center'

export type SegmentVariant = 'full' | 'top' | 'bottom'

const VARIANTS: Record<SegmentVariant, string> = {
  /** A stop in the middle of the route: top edge to bottom edge. */
  full: 'top-0 bottom-0',
  /** The end row: the line arrives and stops at the middle. */
  top: 'top-0 h-1/2',
  /** The start row: the line begins at the middle and runs down. */
  bottom: 'top-1/2 bottom-0',
}

export function TimelineSegment({ variant }: { variant: SegmentVariant }) {
  return (
    <span
      aria-hidden="true"
      data-testid="timeline-segment"
      data-variant={variant}
      // Centred in the gutter with a 2px line. `-translate-x-1/2` on a
      // half-pixel boundary is what keeps it from rendering as a 3px smear on
      // a 2× screen.
      className={`pointer-events-none absolute left-1/2 w-0.5 -translate-x-1/2 bg-outline ${VARIANTS[variant]}`}
    />
  )
}
