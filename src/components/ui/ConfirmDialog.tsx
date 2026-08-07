import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from './useScrollLock'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  body?: string
  /** The destructive label, e.g. "Delete". Rendered in red. */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A blocking confirmation for a destructive action.
 *
 * Two deliberate choices:
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

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-touch rounded-pill px-5 text-row font-semibold text-on-surface"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-touch rounded-pill bg-danger px-5 text-row font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
