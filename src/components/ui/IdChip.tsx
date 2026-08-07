export type GroupColor = 'blue' | 'purple' | 'teal' | 'green' | 'pink' | 'amber'

/** Spelled out, not interpolated — Tailwind only sees literal class names. */
const GROUP: Record<GroupColor, string> = {
  blue: 'bg-group-blue',
  purple: 'bg-group-purple',
  teal: 'bg-group-teal',
  green: 'bg-group-green',
  pink: 'bg-group-pink',
  amber: 'bg-group-amber',
}

export interface IdChipProps {
  /** The immutable display label — "D7", "37". Never a position. */
  stopId: string
  /** The stop's group, if it has one. Blue is the default group. */
  color?: GroupColor
  className?: string
}

/**
 * The stop's immutable label.
 *
 * This is the string a driver writes on a parcel, so it is rendered in tabular
 * figures at a fixed minimum width: a column of D7 / D8 / D9.1 that shifts
 * horizontally as the digits change is hard to scan down, and scanning down it
 * is the entire job.
 */
export function IdChip({ stopId, color = 'blue', className = '' }: IdChipProps) {
  return (
    <span
      className={`inline-flex min-w-9 items-center justify-center rounded-row px-1.5 py-1 text-label font-bold tabular-nums text-white ${GROUP[color]} ${className}`}
    >
      {stopId}
    </span>
  )
}
