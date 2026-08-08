import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from './useScrollLock'

/**
 * Which button carries the visual weight.
 *
 * `destructive` — the confirm button is filled red and the cancel is plain
 *   text. Right when the dialog exists to make you pause before deleting
 *   something you asked to delete.
 *
 * `protective` — inverted: CANCEL is the filled primary, and confirm is a
 *   quiet text button. Right when the dialog was raised by the app rather than
 *   asked for, and the likeliest correct answer is "carry on with what you
 *   were doing".
 *
 * The distinction matters because Spoke gets it backwards on exactly this
 * screen: it makes the filled, thumb-nearest button the one that DISCARDS your
 * work. The heaviest control on screen should never be the one that throws
 * something away by reflex.
 */
export type ConfirmTone = 'destructive' | 'protective'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  body?: string
  /** The action being confirmed, e.g. "Delete" or "Discard". */
  confirmLabel: string
  cancelLabel?: string
  tone?: ConfirmTone
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A blocking confirmation.
 *
 * Two deliberate choices, both unchanged by `tone`:
 *  - Focus lands on Cancel, not Confirm. Someone who dismisses a dialog by
 *    reflex with Enter should keep their route, not lose it.
 *  - No exit animation. The dialog resolves an irreversible question; leaving
 *    it on screen for 200ms after the answer just delays the consequence.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useScrollLock(open)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 2200 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        style={{ background: 'var(--scrim)' }}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm rounded-sheet bg-surface p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-title font-semibold text-on-surface">
          {title}
        </h2>
        {body != null && <p className="mt-2 text-body text-on-surface-variant">{body}</p>}

        {/*
          Order is reversed along with the emphasis, not just the colour. In
          `protective` the filled Keep button sits on the right — nearest the
          thumb on a right-handed grip — so the safe answer is both the
          loudest and the easiest to hit.
        */}
        <div
          data-testid="confirm-actions"
          data-tone={tone}
          className={`mt-5 flex justify-end gap-2 ${
            tone === 'protective' ? 'flex-row-reverse' : ''
          }`}
        >
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            data-testid="confirm-cancel"
            className={`min-h-touch rounded-pill px-5 text-row font-semibold ${
              tone === 'protective'
                ? 'bg-primary text-on-primary active:bg-primary-pressed'
                : 'text-on-surface'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="confirm-confirm"
            className={`min-h-touch rounded-pill px-5 text-row font-semibold ${
              tone === 'protective' ? 'text-on-surface' : 'bg-danger text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
