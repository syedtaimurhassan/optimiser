import type { GroupColorName } from '../../lib/map/palette'

/** Spelled out, not interpolated — Tailwind only sees literal class names. */
const DOT: Record<GroupColorName, string> = {
  blue: 'bg-group-blue',
  purple: 'bg-group-purple',
  teal: 'bg-group-teal',
  green: 'bg-group-green',
  pink: 'bg-group-pink',
  amber: 'bg-group-amber',
}

/**
 * The stop's group, as a dot.
 *
 * It appears beside the position counter on the stop card, and it is the
 * GROUP's colour, never the status'. That distinction is why a failed stop in
 * a green group shows a green dot next to a red pill — the same rule the ID
 * chip and the map marker follow. Getting it wrong would put a second, quieter
 * status signal on screen that disagreed with the loud one.
 */
export function GroupDot({
  color = 'blue',
  className = '',
}: {
  color?: GroupColorName
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      data-testid="group-dot"
      data-color={color}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-pill ${DOT[color]} ${className}`}
    />
  )
}
