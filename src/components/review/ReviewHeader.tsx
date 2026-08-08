import { describeChangeCount } from '../../lib/staging'
import { ChevronLeftIcon, MoreIcon, SearchIcon } from '../ui/icons'

/**
 * The review screen's own header.
 *
 * ── Where we fix Spoke ────────────────────────────────────────────────────
 *
 * Spoke's reads "2 stops", which is ambiguous in the one place it cannot
 * afford to be: it could mean two stops changed, or that the route has two
 * stops in it. A driver reading it at a kerb has to open the screen to find
 * out which. Ours names the unit it is counting — "2 changes".
 *
 * ── Why the count is the back button ──────────────────────────────────────
 *
 * Spoke's header has no way out except the system back gesture, which on iOS
 * is an edge swipe that competes with the sheet's own drag. Making the count
 * itself the way back costs no extra control and puts the exit where the eye
 * already is.
 */
export interface ReviewHeaderProps {
  count: number
  onBack: () => void
  onOverflow: () => void
}

export function ReviewHeader({ count, onBack, onOverflow }: ReviewHeaderProps) {
  return (
    <div data-testid="review-header" className="flex h-14 shrink-0 items-center gap-1 px-2">
      <button
        type="button"
        onClick={onBack}
        data-testid="review-back"
        className="flex min-h-touch items-center gap-1 rounded-pill pl-1 pr-3 text-left active:bg-surface-variant"
      >
        <ChevronLeftIcon className="h-6 w-6 shrink-0 text-on-surface-variant" />
        <span className="text-title font-semibold text-on-surface">
          {describeChangeCount(count)}
        </span>
      </button>

      <div className="flex-1" />

      {/*
        Announced and unavailable, not hidden. Searching a diff of two rows is
        not a thing anyone needs, and it stops being true somewhere north of
        twenty — so the control belongs on the screen, visibly not yet wired,
        rather than appearing one day out of nowhere.
      */}
      <button
        type="button"
        disabled
        aria-label="Search these changes (coming soon)"
        data-testid="review-search"
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant disabled:opacity-40"
      >
        <SearchIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onOverflow}
        aria-label="Route options"
        data-testid="review-overflow"
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
      >
        <MoreIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
