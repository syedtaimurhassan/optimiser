import type { StopStatus } from '../../types'
import { CheckIcon, CloseIcon } from './icons'

/**
 * The status of a stop, as a glyph.
 *
 * The compact form for places with no room for words — a list row's leading
 * slot, or a map marker. Shape carries the meaning as well as colour: a tick
 * for delivered, a cross for failed, an empty ring for pending. Colour alone
 * would fail anyone with a red/green deficiency, which is roughly one man in
 * twelve.
 */
const STATUS: Record<StopStatus, { classes: string; label: string }> = {
  pending: { classes: 'border-2 border-outline text-transparent', label: 'Pending' },
  delivered: { classes: 'bg-success text-white', label: 'Delivered' },
  failed: { classes: 'bg-danger text-white', label: 'Failed' },
}

export function StatusBadge({ status, className = '' }: { status: StopStatus; className?: string }) {
  const { classes, label } = STATUS[status]
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-pill ${classes} ${className}`}
    >
      {status === 'delivered' && <CheckIcon className="h-4 w-4" />}
      {status === 'failed' && <CloseIcon className="h-3.5 w-3.5" />}
    </span>
  )
}
