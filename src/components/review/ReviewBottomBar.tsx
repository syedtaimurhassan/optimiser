/**
 * Discard, and Apply.
 *
 * ── The widths are deliberately unequal, and that is the design ───────────
 *
 * Narrow outlined "Discard" on the left, wide filled "Apply changes (N)" on
 * the right. Fitts's law used to express intent: the action the driver almost
 * always wants is the bigger target, and the one that throws work away is the
 * smaller one — reachable, unmistakable, and harder to hit by accident with a
 * thumb on a phone held in one hand at a kerb.
 *
 * Two equal buttons would say the two outcomes are equally likely. They are
 * not, and pretending otherwise costs a driver their staged work about as
 * often as they mis-tap.
 *
 * The count is IN the label. "Apply changes" alone makes the driver scroll
 * back up to the header to find out what they are agreeing to.
 */
export interface ReviewBottomBarProps {
  count: number
  /** Blocked while the preview is still being worked out. */
  busy?: boolean
  onDiscard: () => void
  onApply: () => void
}

export function ReviewBottomBar({ count, busy, onDiscard, onApply }: ReviewBottomBarProps) {
  return (
    <div
      data-testid="review-bar"
      className="flex shrink-0 items-center gap-3 border-t border-outline bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <button
        type="button"
        onClick={onDiscard}
        data-testid="review-discard"
        className="flex min-h-touch shrink-0 items-center justify-center rounded-pill border border-outline px-5 text-row font-semibold text-on-surface active:bg-surface-variant"
      >
        Discard
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={busy || count === 0}
        data-testid="review-apply"
        className="flex min-h-touch flex-1 items-center justify-center rounded-pill bg-primary px-5 text-row font-semibold text-on-primary disabled:opacity-40 active:bg-primary-pressed"
      >
        {busy ? 'Working…' : `Apply changes (${count})`}
      </button>
    </div>
  )
}
