import type { GroupColorName } from '../../lib/map/palette'

/**
 * The palette names, sourced from `lib/map/palette.ts` so the chip, the map
 * marker and the route list cannot disagree about what "green" is.
 */
export type GroupColor = GroupColorName

export type IdChipVariant = 'solid' | 'pastel'

/** Spelled out, not interpolated — Tailwind only sees literal class names. */
const SOLID: Record<GroupColor, string> = {
  blue: 'bg-group-blue text-white',
  purple: 'bg-group-purple text-white',
  teal: 'bg-group-teal text-white',
  green: 'bg-group-green text-white',
  pink: 'bg-group-pink text-white',
  amber: 'bg-group-amber text-white',
}

const PASTEL: Record<GroupColor, string> = {
  blue: 'bg-group-blue-container text-on-group-blue-container',
  purple: 'bg-group-purple-container text-on-group-purple-container',
  teal: 'bg-group-teal-container text-on-group-teal-container',
  green: 'bg-group-green-container text-on-group-green-container',
  pink: 'bg-group-pink-container text-on-group-pink-container',
  amber: 'bg-group-amber-container text-on-group-amber-container',
}

export interface IdChipProps {
  /** The immutable display label — "D7", "37". Never a position. */
  stopId: string
  /** The stop's group, if it has one. Blue is the default group. */
  color?: GroupColor
  /**
   * `pastel` for a list row, `solid` for anything competing with a map.
   *
   * A column of 44 solid chips is a column of 44 shouts and the eye has
   * nowhere to rest; the same chip on a busy basemap has to win or it is not
   * a marker. Same colour, two jobs.
   */
  variant?: IdChipVariant
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
export function IdChip({ stopId, color = 'blue', variant = 'solid', className = '' }: IdChipProps) {
  const tone = variant === 'pastel' ? PASTEL[color] : SOLID[color]
  return (
    <span
      className={`inline-flex min-w-9 items-center justify-center rounded-row px-1.5 py-1 text-label font-bold tabular-nums ${tone} ${className}`}
    >
      {stopId}
    </span>
  )
}
