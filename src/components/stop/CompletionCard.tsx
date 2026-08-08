import { CheckIcon, CloseIcon, UndoIcon } from '../ui/icons'

/**
 * What replaces the action row once a stop is finished with.
 *
 * The best state design in Spoke, and worth describing precisely because the
 * mechanic is the point: the three-up row does not grey out, and Delivered
 * does not become a checked toggle. The row is REPLACED by a block that states
 * what happened and when, and offers exactly one thing — Undo.
 *
 * That is why the card can afford to be large and quiet. It is not competing
 * for attention with anything; the only decision left at this stop is whether
 * the last one was a mistake.
 */
export interface CompletionCardProps {
  status: 'delivered' | 'failed'
  /** "Marked as delivered". */
  label: string
  /** "16:13", or null when the history predates timestamps. */
  at: string | null
  /** The captured failure reason, when there is one. */
  reason?: string | null
  /** Offered on a failure with no reason yet. Absent on a delivery. */
  onAddReason?: () => void
  onUndo: () => void
}

export function CompletionCard({
  status,
  label,
  at,
  reason,
  onAddReason,
  onUndo,
}: CompletionCardProps) {
  const delivered = status === 'delivered'

  return (
    <div
      data-testid="completion-card"
      data-status={status}
      className="rounded-row bg-surface-variant p-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-pill ${
            delivered ? 'bg-success' : 'bg-danger'
          } text-white`}
        >
          {delivered ? <CheckIcon className="h-6 w-6" /> : <CloseIcon className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-row font-semibold text-on-surface">{label}</p>
          {at && (
            <p className="text-body tabular-nums text-on-surface-variant" data-testid="completion-time">
              {at}
            </p>
          )}
        </div>

        {/*
          A text button with the arrow, not an icon button. Undo is the only
          action here, it is reached with a thumb at a kerb, and a bare glyph
          would make the driver work out what it undoes.
        */}
        <button
          type="button"
          onClick={onUndo}
          data-testid="undo-status"
          className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-pill px-3 text-label font-semibold text-primary active:bg-surface"
        >
          Undo
          <UndoIcon className="h-4 w-4" />
        </button>
      </div>

      {/*
        The reason, or the offer of one. Skipping the reason sheet is a
        legitimate outcome, so a failure with nothing recorded must still have
        a way back to recording it — otherwise the one dismissible step in the
        flow is also the only chance to take it.
      */}
      {reason ? (
        <button
          type="button"
          onClick={onAddReason}
          disabled={!onAddReason}
          data-testid="failure-reason-line"
          className="mt-3 w-full border-t border-outline/60 pt-3 text-left text-body text-on-surface-variant disabled:opacity-100"
        >
          {reason}
        </button>
      ) : (
        onAddReason && (
          <button
            type="button"
            onClick={onAddReason}
            data-testid="add-failure-reason"
            className="mt-3 min-h-touch w-full border-t border-outline/60 pt-3 text-left text-label font-semibold text-primary"
          >
            Add a reason
          </button>
        )
      )}
    </div>
  )
}
