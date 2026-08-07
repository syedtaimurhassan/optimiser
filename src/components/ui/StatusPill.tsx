import type { StopStatus } from '../../types'

/**
 * The status of a stop, in words.
 *
 * Colour is doing real work here, so it obeys the rule exactly: green only for
 * delivered, red only for failed, and a neutral grey for pending — pending is
 * not a warning, and colouring it amber would put a third alarm colour in a
 * driver's peripheral vision for the majority of stops on the route.
 */
const STATUS: Record<StopStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-surface-variant text-on-surface-variant' },
  delivered: { label: 'Delivered', classes: 'bg-success-container text-on-success-container' },
  failed: { label: 'Failed', classes: 'bg-danger-container text-on-danger-container' },
}

export function StatusPill({ status, className = '' }: { status: StopStatus; className?: string }) {
  const { label, classes } = STATUS[status]
  return (
    <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-label font-semibold ${classes} ${className}`}>
      {label}
    </span>
  )
}
