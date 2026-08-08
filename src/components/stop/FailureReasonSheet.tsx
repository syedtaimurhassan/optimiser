import { useEffect, useRef, useState } from 'react'
import { FAILURE_REASONS, OTHER_REASON_ID } from '../../lib/failureReasons'
import { FullWidthButton, Sheet } from '../ui'
import { CheckIcon } from '../ui/icons'

/**
 * Why did it fail? — asked AFTER the stop is already marked.
 *
 * See `lib/failureReasons.ts` for why the order is that way round. The
 * consequence for this component is the whole of its design: dismissing it is
 * a legitimate outcome, so there is a Skip and the scrim closes it, and
 * neither of them is styled as a mistake.
 *
 * Not a ConfirmDialog. Nothing here is being confirmed — the failure has
 * already happened, and a dialog that traps focus in the middle of the screen
 * to ask an optional question would be the wrong shape entirely.
 */
export interface FailureReasonSheetProps {
  open: boolean
  /** The stop's title, so the sheet says what it is asking about. */
  stopTitle: string
  initialReason?: string
  initialNote?: string
  onSave: (reason: string | undefined, note: string | undefined) => void
  onClose: () => void
}

export function FailureReasonSheet({
  open,
  stopTitle,
  initialReason,
  initialNote,
  onSave,
  onClose,
}: FailureReasonSheetProps) {
  const [reason, setReason] = useState<string | undefined>(initialReason)
  const [note, setNote] = useState(initialNote ?? '')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  // Re-opening for a different stop must not show the last one's answer.
  useEffect(() => {
    if (open) {
      setReason(initialReason)
      setNote(initialNote ?? '')
    }
  }, [open, initialReason, initialNote])

  // Choosing "Something else" and then having to find the field is one tap too
  // many for the option that already costs the most effort.
  useEffect(() => {
    if (reason === OTHER_REASON_ID) noteRef.current?.focus()
  }, [reason])

  return (
    <Sheet open={open} onClose={onClose} label="Why did this delivery fail?" zIndex={2100}>
      <div className="flex flex-col gap-3 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div>
          <h2 className="text-title font-semibold text-on-surface">Why did it fail?</h2>
          <p className="truncate text-body text-on-surface-variant">{stopTitle}</p>
        </div>

        <div role="radiogroup" aria-label="Failure reason" className="flex flex-col">
          {FAILURE_REASONS.map((option) => {
            const selected = option.id === reason
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`failure-reason-${option.id}`}
                // Tapping the chosen one again clears it. The whole sheet is
                // optional, so being unable to un-answer it would be strange.
                onClick={() => setReason(selected ? undefined : option.id)}
                className={`flex min-h-touch items-center justify-between gap-3 rounded-row px-3 py-3 text-left text-row ${
                  selected ? 'bg-primary-container text-on-primary-container' : 'text-on-surface active:bg-surface-variant'
                }`}
              >
                {option.label}
                {selected && <CheckIcon className="h-5 w-5 shrink-0" />}
              </button>
            )
          })}
        </div>

        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add a note (optional)"
          data-testid="failure-note"
          aria-label="Failure note"
          className="w-full resize-none rounded-row border border-outline bg-surface px-3 py-2.5 text-body text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="failure-skip"
            className="min-h-touch shrink-0 rounded-pill px-4 text-row font-semibold text-on-surface-variant active:bg-surface-variant"
          >
            Skip
          </button>
          <FullWidthButton
            onClick={() => onSave(reason, note.trim() || undefined)}
            className="flex-1"
          >
            Save reason
          </FullWidthButton>
        </div>
      </div>
    </Sheet>
  )
}
