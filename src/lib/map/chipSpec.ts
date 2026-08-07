import type { AddressedStop, StopGroup } from '../../types'
// Value imports carry an explicit .ts extension: Vite is relaxed about it,
// node --test's ESM resolver is not, and these modules are unit-tested.
import { DEFAULT_GROUP_COLOR, MAP_COLORS, normalizeHex } from './palette.ts'

/**
 * What a stop's marker looks like, as data.
 *
 * ── The rule this module exists to enforce ────────────────────────────────
 *
 * The chip's FILL is the stop's GROUP colour. The chip's BADGE is the stop's
 * STATUS. These are two independent inputs to one output and they never touch:
 * a failed stop in a green group is a GREEN chip carrying a RED ✗, not a red
 * chip. Get this backwards and the map stops answering "which run is this?"
 * the moment anything goes wrong — which is exactly when the driver is looking.
 *
 * Keeping it here, pure and separate from the canvas, is what makes that rule
 * a unit test instead of a screenshot someone has to remember to look at.
 *
 * ── The one exception, and why it is not one ──────────────────────────────
 *
 * A staged REMOVE draws a red chip. That is not a status — it is an unsaved
 * edit previewing a destruction, which is what red means under the semantic
 * colour rule. It is modelled on a separate axis (`staged`) from `status` so
 * it cannot be confused for one.
 */

export type ChipGlyph = 'none' | 'plus' | 'trash'
export type ChipBadge = 'none' | 'failed' | 'delivered'

/** An edit staged since the last optimisation, previewed on the map. */
export type StagedKind = 'none' | 'add' | 'remove'

export interface ChipSpec {
  /** Chip background. Group colour when filled, light neutral when not. */
  fill: string
  /** The number's colour, always legible against `fill`. */
  textColor: string
  borderColor: string
  /** The immutable stop label ("D7"), truncated if absurd. */
  label: string
  glyph: ChipGlyph
  /** Status, and ONLY status. */
  badge: ChipBadge
  /** The pin tail below the chip — selection and staged-add only. */
  tail: boolean
  /** Delivered stops recede. Opacity only; never a hue change. */
  dimmed: boolean
  /**
   * MapLibre `symbol-sort-key`. LOWER is placed first and therefore WINS
   * collisions — the opposite of what the name suggests.
   */
  sortKey: number
  /**
   * Cache key for the rendered image. Covers every field that changes a
   * pixel and nothing else, so two identical-looking chips share one texture
   * and a status tick redraws exactly one.
   */
  key: string
}

export interface ChipInput {
  stop: AddressedStop
  groups: StopGroup[]
  selectedStopId: string | null
  /** The next stop to drive to. Wins collisions just behind the selection. */
  nextStopId: string | null
  staged?: StagedKind
}

/**
 * Collision priority. Lower wins.
 *
 * The order is a claim about what a driver needs to see when the map is too
 * crowded to show everything: the stop they tapped, then the one they are
 * driving to, then anything they just edited, then anything that failed, then
 * the work remaining, and last the work already done.
 */
const SORT = {
  selected: 0,
  next: 1,
  staged: 2,
  failed: 3,
  pending: 4,
  delivered: 5,
} as const

/** Beyond this a label stops being glanceable and starts being a paragraph. */
const MAX_LABEL = 6

export function truncateLabel(label: string): string {
  return label.length <= MAX_LABEL ? label : `${label.slice(0, MAX_LABEL - 1)}…`
}

/**
 * The stop's group colour, or the default blue.
 *
 * A `colorHex` that is missing, malformed or points at a deleted group all
 * resolve the same way — to the default group — because a marker that fails
 * to draw is strictly worse than one drawn in the wrong shade of blue.
 */
export function groupColorFor(stop: AddressedStop, groups: StopGroup[]): string {
  if (!stop.groupId) return DEFAULT_GROUP_COLOR
  const group = groups.find((g) => g.id === stop.groupId)
  return normalizeHex(group?.colorHex) ?? DEFAULT_GROUP_COLOR
}

/** Status → badge. The whole of the status-to-appearance mapping. */
function badgeFor(status: AddressedStop['status']): ChipBadge {
  if (status === 'failed') return 'failed'
  if (status === 'delivered') return 'delivered'
  return 'none'
}

export function chipSpecFor({
  stop,
  groups,
  selectedStopId,
  nextStopId,
  staged = 'none',
}: ChipInput): ChipSpec {
  const groupColor = groupColorFor(stop, groups)
  const selected = stop.id === selectedStopId
  const isNext = stop.id === nextStopId
  const badge = badgeFor(stop.status)

  // Fill is decided here, by group and selection only. `stop.status` is
  // deliberately not consulted — see the module comment.
  let fill: string
  let textColor: string
  let borderColor: string
  let glyph: ChipGlyph = 'none'

  if (staged === 'remove') {
    fill = MAP_COLORS.danger
    textColor = MAP_COLORS.onPrimary
    borderColor = MAP_COLORS.surface
    glyph = 'trash'
  } else if (staged === 'add') {
    fill = groupColor
    textColor = MAP_COLORS.onPrimary
    borderColor = MAP_COLORS.surface
    glyph = 'plus'
  } else if (selected) {
    fill = groupColor
    textColor = MAP_COLORS.onPrimary
    borderColor = MAP_COLORS.surface
  } else {
    fill = MAP_COLORS.surface
    textColor = MAP_COLORS.onSurface
    borderColor = MAP_COLORS.outline
  }

  const sortKey = selected
    ? SORT.selected
    : isNext
      ? SORT.next
      : staged !== 'none'
        ? SORT.staged
        : stop.status === 'failed'
          ? SORT.failed
          : stop.status === 'delivered'
            ? SORT.delivered
            : SORT.pending

  // Deliberate deviation from the brief, flagged: delivered stops are drawn at
  // reduced opacity as well as carrying the green ✓. A finished round is 200
  // chips at full strength otherwise, and the remaining work stops standing
  // out. It is opacity, not hue, so the group colour still reads.
  const dimmed = stop.status === 'delivered' && !selected && staged === 'none'

  const label = truncateLabel(stop.stopId)
  const tail = selected || staged === 'add'

  return {
    fill,
    textColor,
    borderColor,
    label,
    glyph,
    badge,
    tail,
    dimmed,
    sortKey,
    // stop.id is deliberately absent: identical-looking chips share a texture.
    key: [fill, textColor, label, glyph, badge, tail ? 't' : '', dimmed ? 'd' : ''].join('|'),
  }
}
