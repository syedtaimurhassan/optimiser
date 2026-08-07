import { ChevronLeftIcon } from '../ui/icons'

/**
 * The previous item in the stop carousel, peeking in from the left edge.
 *
 * Two jobs at once, which is why it is a pill and not a chevron: it TELLS you
 * what is behind you ("‹ 44 Hulkærvej 38") and it is a 44dp tap target that
 * takes you there. A bare arrow would do the second without the first, and a
 * driver would have to tap it to find out what it meant.
 *
 * The carousel itself is M7. This renders and works against whatever previous
 * item it is handed, so M7 wires it to the real thing rather than building it.
 */
export interface PeekPillProps {
  /** What sits before the current item — a stop label or "End location". */
  label: string | null
  onClick: () => void
}

export function PeekPill({ label, onClick }: PeekPillProps) {
  if (!label) return null

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="peek-pill"
      // Mid-height on the left edge, and deliberately hanging off it: the
      // clipped left end is what reads as "there is more over here".
      className="pointer-events-auto absolute left-0 top-1/2 z-20 flex min-h-touch -translate-y-1/2 items-center gap-1 rounded-r-pill border border-l-0 border-outline bg-surface py-2 pl-2 pr-4 shadow-md"
    >
      <ChevronLeftIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
      <span className="max-w-[9rem] truncate text-label font-medium text-on-surface">{label}</span>
    </button>
  )
}
