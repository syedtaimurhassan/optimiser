import { FullWidthButton } from '../ui'
import { CheckIcon, CloseIcon, NavigateIcon } from '../ui/icons'

/**
 * The last page: where the round ends.
 *
 * Deliberately a different grammar from a stop card, and the differences are
 * all subtractions. No counter — the end location is not the 45th of 44. No
 * group dot — it is not in a group. No ID chip — nothing was ever written on a
 * parcel for it. What is left is a place and a time, on one grey line.
 *
 * ── Why Navigate shrinks to a glyph ───────────────────────────────────────
 *
 * On a stop, Navigate is the verb: the driver is going somewhere. Here the
 * important verb is finishing, so "Route completed" takes the width and the
 * words, and Navigate keeps its 44dp target but loses its label. The two
 * controls are the same height and the same row — the hierarchy is stated in
 * width alone, which is exactly how much emphasis the difference deserves.
 */
export interface EndLocationCardProps {
  /** The place, in words: an address when we know one, coordinates otherwise. */
  title: string
  /** Predicted arrival, as a clock — "17:07", or null with no arrivals yet. */
  arrival: string | null
  completed: boolean
  onClose: () => void
  onNavigate: () => void
  onComplete: () => void
}

export function EndLocationCard({
  title,
  arrival,
  completed,
  onClose,
  onNavigate,
  onComplete,
}: EndLocationCardProps) {
  return (
    <div className="px-4 pb-6 pt-1" data-testid="end-detail">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 text-display font-bold leading-tight text-on-surface">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close end location"
          data-testid="close-stop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-variant text-on-surface-variant active:bg-outline"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Label and time in ONE grey line, not a label above a value. It is a
          single fact — when you are done — and splitting it would give the
          word "End location" a prominence it has not earned. */}
      <p className="mt-2 text-body text-on-surface-variant" data-testid="end-subtitle">
        End location{arrival && <span className="tabular-nums">, {arrival}</span>}
      </p>

      <div className="mt-4 flex items-stretch gap-2">
        <button
          type="button"
          onClick={onNavigate}
          aria-label="Navigate to the end location"
          data-testid="action-navigate"
          className="flex min-h-touch w-touch shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary active:bg-primary-pressed"
        >
          <NavigateIcon className="h-6 w-6" />
        </button>
        <FullWidthButton
          variant="outlined"
          onClick={onComplete}
          disabled={completed}
          className="flex-1"
        >
          <CheckIcon className="h-5 w-5" />
          Route completed
        </FullWidthButton>
      </div>
    </div>
  )
}
