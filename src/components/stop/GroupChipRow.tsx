import type { StopGroup } from '../../types'
import { GROUP_PRESETS, SWATCH_COLORS, presetHex } from '../../lib/groups'
import { GROUP_COLORS, type GroupColorName } from '../../lib/map/palette'

/**
 * The group picker: a horizontally scrollable row of chips.
 *
 * Named presets first, colour-only swatches after. The order is the point —
 * "Afternoon Pickup" is a thing a driver means, and #d6296e is a thing a
 * driver reaches for when none of the named ones fit. Putting the swatches
 * first would make the row look like a colour picker, which is the shallower
 * reading of what a group is.
 *
 * Scrolls rather than wraps. A wrapping row changes height as groups are added
 * and pushes the rest of the form down; a scrolling one stays one row forever
 * and its overflow is self-evident from the clipped chip at the edge.
 */

const DOT: Record<GroupColorName, string> = {
  blue: 'bg-group-blue',
  purple: 'bg-group-purple',
  teal: 'bg-group-teal',
  green: 'bg-group-green',
  pink: 'bg-group-pink',
  amber: 'bg-group-amber',
}

const RING: Record<GroupColorName, string> = {
  blue: 'ring-group-blue',
  purple: 'ring-group-purple',
  teal: 'ring-group-teal',
  green: 'ring-group-green',
  pink: 'ring-group-pink',
  amber: 'ring-group-amber',
}

export interface GroupChipRowProps {
  /** The route's existing groups. */
  groups: StopGroup[]
  /** The stop's group, or undefined for the default. */
  value: string | undefined
  /** Choose a group by name and colour — the parent creates it if it is new. */
  onChoose: (choice: { name: string; colorHex: string } | null) => void
}

export function GroupChipRow({ groups, value, onChoose }: GroupChipRowProps) {
  const current = groups.find((g) => g.id === value)

  /**
   * Every chip the row shows: the default, the named presets, this route's own
   * groups, then the bare swatches — deduplicated by name+colour so a preset
   * the route has already created appears once, as itself.
   */
  const named = [
    ...GROUP_PRESETS.map((p) => ({ name: p.name, colorHex: presetHex(p) })),
    ...groups.map((g) => ({ name: g.name, colorHex: g.colorHex })),
  ].filter(
    (chip, i, all) => all.findIndex((c) => c.name === chip.name && c.colorHex === chip.colorHex) === i,
  )

  const selectedChip = current ? { name: current.name, colorHex: current.colorHex } : null

  return (
    <div
      role="radiogroup"
      aria-label="Group"
      data-testid="group-chips"
      // `-mx-4 px-4` so the row bleeds to the screen edges and the clipped chip
      // reads as "there is more", while the first chip still lines up with the
      // rest of the form.
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: 'none' }}
    >
      <Chip
        label="Default"
        color="blue"
        selected={selectedChip === null}
        onSelect={() => onChoose(null)}
        testId="group-default"
      />

      {named.map((chip) => (
        <Chip
          key={`${chip.name}-${chip.colorHex}`}
          label={chip.name}
          color={colorNameOf(chip.colorHex)}
          selected={
            selectedChip !== null &&
            selectedChip.name === chip.name &&
            selectedChip.colorHex === chip.colorHex
          }
          onSelect={() => onChoose(chip)}
        />
      ))}

      {SWATCH_COLORS.map((color) => (
        <Chip
          key={color}
          color={color}
          // A swatch has no words, so it takes the colour's name as its
          // accessible label AND as the group's name when chosen. An unnamed
          // group would render as an empty chip on every future visit.
          label={null}
          selected={selectedChip !== null && selectedChip.colorHex === GROUP_COLORS[color]}
          onSelect={() => onChoose({ name: capitalise(color), colorHex: GROUP_COLORS[color] })}
        />
      ))}
    </div>
  )
}

function Chip({
  label,
  color,
  selected,
  onSelect,
  testId,
}: {
  label: string | null
  color: GroupColorName
  selected: boolean
  onSelect: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label ?? `${capitalise(color)} group`}
      data-testid={testId}
      data-group-color={color}
      data-selected={selected}
      onClick={onSelect}
      className={`flex min-h-touch shrink-0 items-center gap-2 rounded-pill border border-outline bg-surface text-label font-medium text-on-surface ${
        label ? 'px-3' : 'w-touch justify-center px-0'
      } ${selected ? `ring-2 ${RING[color]}` : ''}`}
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-pill ${DOT[color]}`} />
      {label}
    </button>
  )
}

/** A group's hex back to a palette name, falling back to the default group. */
function colorNameOf(hex: string): GroupColorName {
  const normalised = hex.trim().toLowerCase()
  const match = (Object.entries(GROUP_COLORS) as [GroupColorName, string][]).find(
    ([, value]) => value === normalised,
  )
  return match?.[0] ?? 'blue'
}

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)
