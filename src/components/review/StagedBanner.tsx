import { describeChangeCount } from '../../lib/staging'
import { ChevronRightIcon } from '../ui/icons'

/**
 * "2 changes · Review" — the one thing that says the route is holding
 * something back.
 *
 * ── Why it lives in the sheet's header BLOCK ──────────────────────────────
 *
 * `SheetHeader` is a fixed-height morph between two layers, and that height is
 * load-bearing: it is what makes every snap offset a constant rather than
 * something to re-measure mid-drag. So this cannot go inside it.
 *
 * It goes immediately below, still inside the block the collapsed detent is
 * measured from — which means the peek grows by exactly this row's height and
 * the banner is visible with the sheet all the way down. That is the point. A
 * driver who staged a stop and then dropped the sheet to look at the map must
 * not lose the only affordance that leads to applying it.
 *
 * ── Why it is not a toast ─────────────────────────────────────────────────
 *
 * Staged changes have no timeout. They survive a reload, a route switch and a
 * cold start, because they are on the route rather than on the screen. A
 * transient notification for a durable state is how a driver ends up with two
 * stops staged from yesterday.
 */
export interface StagedBannerProps {
  count: number
  /** A preview is in flight — the matrix extension is the slow part. */
  computing?: boolean
  /** The preview says a time window will be missed. */
  infeasible?: boolean
  onReview: () => void
}

export function StagedBanner({ count, computing, infeasible, onReview }: StagedBannerProps) {
  if (count === 0) return null

  return (
    <button
      type="button"
      onClick={onReview}
      data-testid="staged-banner"
      data-count={count}
      aria-label={`${describeChangeCount(count)} to review`}
      className="flex min-h-touch w-full items-center gap-3 border-t border-outline bg-primary-container px-4 py-2 text-left active:opacity-80"
    >
      <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-pill bg-primary px-1.5 text-label font-bold tabular-nums text-on-primary">
        {count}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-row font-semibold text-on-surface">
          {describeChangeCount(count)} not applied
        </span>
        <span className="block truncate text-meta text-on-surface-variant">
          {computing
            ? 'Working out what it costs…'
            : infeasible
              ? 'One arrival time will be missed'
              : 'Review before the route changes'}
        </span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
    </button>
  )
}
