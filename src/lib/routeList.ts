import type { AddressedStop, Route, RouteBreak, StopGroup } from '../types.ts'
import { formatEta } from './map/features.ts'
import { visitOrder } from './routeOrder.ts'
import { GROUP_COLORS, type GroupColorName } from './map/palette.ts'
import { formatLatLng } from './coordinates.ts'

/**
 * The route list, as data.
 *
 * ── Why the header rows are IN the list ───────────────────────────────────
 *
 * The title, the action chips, the break row and the start row could all be a
 * static block above a scrolling list. They are rows instead, in one array,
 * for three reasons that all bite later:
 *
 *  1. One scroll container. Two would mean deciding which one a drag belongs
 *     to on every gesture, on top of the sheet-vs-list decision already being
 *     made — the nested-scroll problem, twice.
 *  2. One measurement pass. The virtualiser measures rows; a static block
 *     would need its height fed in separately and kept in step.
 *  3. The timeline connector is continuous from the start row to the end row
 *     by construction, because they are neighbours in the same list.
 *
 * ── Restraint is the feature ──────────────────────────────────────────────
 *
 * `tags` is empty unless something is genuinely non-default. A list where
 * every row is decorated says nothing; one that stays quiet until a stop is
 * pinned first or is a pickup makes those two facts impossible to miss.
 */

/** An inline tag on a stop row. Only ever present when non-default. */
export type RowTag = 'first' | 'last' | 'pickup'

export interface StopRowModel {
  kind: 'stop'
  /** The stop's uuid — the React key, and what a tap reports. */
  id: string
  stop: AddressedStop
  /** Position in the route, zero-padded to a fixed width so titles align. */
  seq: string
  /** "09:42", or null until M7 fills `arrivalSec`. */
  eta: string | null
  /** Title line: the street address, with the recipient appended when there is one. */
  title: string
  /** "Bagsværd, 2880". */
  subtitle: string
  /** The group's palette name, for the pastel id chip. */
  color: GroupColorName
  tags: RowTag[]
  note: string | null
}

export type RouteRow =
  | { kind: 'header'; id: 'row-header'; title: string }
  | { kind: 'break'; id: 'row-break'; label: string; planned: boolean }
  | { kind: 'start'; id: 'row-start'; time: string | null; subtitle: string; hasAnchor: boolean }
  | StopRowModel
  | { kind: 'end'; id: 'row-end'; time: string | null; hasAnchor: boolean }
  | { kind: 'footer'; id: 'row-footer'; completed: boolean }

export interface RouteRowsInput {
  route: Route
  /** Now, epoch ms — only used to date an ETA. Passed in so this stays pure. */
  nowMs?: number
}

/**
 * The provenance line under the start row.
 *
 * "Used GPS position when optimising" pre-empts the question a driver asks
 * exactly once and never forgets: why does my route start HERE? Saying where
 * the anchor came from costs one line and removes the whole doubt. The same
 * pattern belongs on anything the app decided on the driver's behalf.
 */
export function startSubtitle(route: Route): string {
  if (route.endpointMode === 'open') return 'Chosen by the optimiser'
  if (!route.start) return 'No start location set'
  return 'Used GPS position when optimising'
}

/** Zero-pad to the width of the largest position: "01" at 44 stops, "001" at 300. */
export function formatSeq(position: number, total: number): string {
  return String(position).padStart(String(Math.max(total, 1)).length, '0')
}

/**
 * The tags a stop earns. Empty for an ordinary delivery the optimiser is free
 * to move, which is almost every stop on almost every route.
 */
export function tagsFor(stop: AddressedStop): RowTag[] {
  const tags: RowTag[] = []
  if (stop.order === 'first') tags.push('first')
  else if (stop.order === 'last') tags.push('last')
  if (stop.kind === 'pickup') tags.push('pickup')
  return tags
}

/**
 * The title line.
 *
 * A recipient is appended to the address rather than given its own line:
 * "Rundgården 34, st. th. Jette Kelbjørn" is one thing to find, and splitting
 * it would push the subtitle down and make every row with a name taller than
 * every row without one.
 */
export function titleFor(stop: AddressedStop): string {
  const address = stop.address?.title?.trim() || formatLatLng({ lat: stop.lat, lng: stop.lng })
  const recipient = stop.recipient?.trim()
  return recipient ? `${address} ${recipient}` : address
}

/** The group's palette NAME, not its hex — the chip is a Tailwind class. */
export function colorNameFor(stop: AddressedStop, groups: StopGroup[]): GroupColorName {
  if (!stop.groupId) return 'blue'
  const hex = groups.find((g) => g.id === stop.groupId)?.colorHex?.trim().toLowerCase()
  if (!hex) return 'blue'
  const match = (Object.entries(GROUP_COLORS) as [GroupColorName, string][]).find(
    ([, value]) => value === hex,
  )
  // A group colour outside the palette falls back to the default group rather
  // than rendering an unstyled chip — the same rule the map's chipSpec applies.
  return match?.[0] ?? 'blue'
}

/**
 * The break row's label.
 *
 * It sits ABOVE the start location because a break is a property of the ROUTE,
 * not of a stop — it is a constraint the optimiser has to fit into the day,
 * and putting it among the stops would imply it happens at one of them.
 */
export function breakLabel(breaks: RouteBreak[]): { label: string; planned: boolean } {
  if (breaks.length === 0) return { label: 'No break · Tap to plan a break', planned: false }
  const total = Math.round(breaks.reduce((sum, b) => sum + b.durationSec, 0) / 60)
  return {
    label: `${breaks.length === 1 ? 'Break' : `${breaks.length} breaks`} · ${total} min`,
    planned: true,
  }
}

/**
 * Seconds from route start → a wall clock, given when the route started.
 *
 * `arrivalSec` is empty until M7, so in practice every ETA is null right now
 * and the gutter shows the sequence number alone. The rendering is built for
 * the real thing so M7 fills data rather than rewrites rows.
 */
function etaClock(arrivalSec: number | undefined, stop: AddressedStop): string | null {
  return formatEta(arrivalSec ?? stop.etaSec)
}

export function buildRouteRows({ route }: RouteRowsInput): RouteRow[] {
  const ordered = visitOrder(route)
  const arrivals = arrivalsById(route)

  const brk = breakLabel(route.breaks)

  const rows: RouteRow[] = [
    { kind: 'header', id: 'row-header', title: route.name },
    { kind: 'break', id: 'row-break', label: brk.label, planned: brk.planned },
    {
      kind: 'start',
      id: 'row-start',
      time: null,
      subtitle: startSubtitle(route),
      hasAnchor: Boolean(route.start),
    },
  ]

  for (const [index, stop] of ordered.entries()) {
    rows.push({
      kind: 'stop',
      id: stop.id,
      stop,
      seq: formatSeq(index + 1, ordered.length),
      eta: etaClock(arrivals.get(stop.id), stop),
      title: titleFor(stop),
      subtitle: stop.address?.subtitle?.trim() ?? '',
      color: colorNameFor(stop, route.groups),
      tags: tagsFor(stop),
      note: stop.notes?.trim() || null,
    })
  }

  rows.push({ kind: 'end', id: 'row-end', time: null, hasAnchor: Boolean(route.end) })
  rows.push({ kind: 'footer', id: 'row-footer', completed: route.status === 'completed' })

  return rows
}

/**
 * Arrival seconds keyed by stop id.
 *
 * `arrivalSec` is positional against `orderedStopIds`, INCLUDING its nulls, so
 * it cannot be zipped against the filtered stop list — doing that would shift
 * every arrival by the number of endpoints and quietly hand each stop its
 * neighbour's time. Empty today; correct when M7 fills it.
 */
function arrivalsById(route: Route): Map<string, number> {
  const out = new Map<string, number>()
  const optimized = route.optimized
  if (!optimized || optimized.arrivalSec.length === 0) return out
  optimized.orderedStopIds.forEach((id, index) => {
    const at = optimized.arrivalSec[index]
    if (id !== null && at !== undefined) out.set(id, at)
  })
  return out
}

/** Where the jump FAB goes: the first row for a stop that is still pending. */
export function nextStopRowIndex(rows: RouteRow[]): number | null {
  const index = rows.findIndex((row) => row.kind === 'stop' && row.stop.status === 'pending')
  return index === -1 ? null : index
}
