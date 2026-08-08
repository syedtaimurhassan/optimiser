import type { AddressedStop, OptimizedRoute, Route } from '../types.ts'
import { liveEta } from './arrivals.ts'
import type { GroupColorName } from './map/palette.ts'
import { breakLabel, colorNameFor, formatSeq, startSubtitle, titleFor } from './routeList.ts'
import { clockAt } from './routeSummary.ts'
import { visitOrder } from './routeOrder.ts'
import { addedStops, removedStopIds, stagedRoute, stagedStops } from './staging.ts'

/**
 * The review screen, as data.
 *
 * ── The diff is shown in the domain's own language ────────────────────────
 *
 * Not "3 modifications to entity Route". Three sections a driver already
 * thinks in: what you are adding, what you are dropping, and what that does to
 * the rest of the day. The third one is the reason the screen exists — a diff
 * that only listed the changes would leave the driver to do the arithmetic,
 * and the arithmetic is the whole question.
 *
 * ── The two clocks, and why they are different clocks ─────────────────────
 *
 * An EXISTING row's ETA comes from the provisional plan: that is what the
 * change would do to it. A REMOVED row's ETA comes from the committed plan,
 * because the row is showing what you are about to lose, and it keeps its
 * sequence number for the same reason. Read them from one plan and a removed
 * stop shows the arrival time of whatever now occupies its slot.
 *
 * Pure module: no React, no store. `nowMs` is passed in, like everywhere else
 * that touches a clock.
 */

export interface ReviewStopRow {
  stop: AddressedStop
  /** Position in the route, zero-padded to a fixed width. Empty for an add. */
  seq: string
  /** "19:56", or null when there is no prediction. */
  eta: string | null
  title: string
  subtitle: string
  color: GroupColorName
}

export type ReviewRow =
  | { kind: 'section'; id: string; title: string; count: number }
  | ({ kind: 'added'; id: string; changeId: string } & ReviewStopRow)
  | ({ kind: 'removed'; id: string; changeId: string } & ReviewStopRow)
  | { kind: 'break'; id: 'row-break'; label: string; planned: boolean }
  | { kind: 'start'; id: 'row-start'; subtitle: string; hasAnchor: boolean }
  | ({ kind: 'existing'; id: string; edited: boolean; added: boolean } & ReviewStopRow)
  | { kind: 'end'; id: 'row-end'; hasAnchor: boolean }

export interface ReviewRowsInput {
  route: Route
  /** Now, epoch ms. Passed in rather than read, so this stays pure. */
  nowMs: number
}

export function buildReviewRows({ route, nowMs }: ReviewRowsInput): ReviewRow[] {
  const pending = route.pending
  if (!pending || pending.changes.length === 0) return []

  const staged = stagedRoute(route)
  const provisional = pending.provisional
  const removed = removedStopIds(pending)
  const edited = new Set(pending.changes.filter((c) => c.kind === 'edit').map((c) => c.stopId))
  const changeIdFor = new Map(pending.changes.map((c) => [c.stopId, c.id]))

  const provisionalEta = etaMap(provisional, stagedStops(route), nowMs)
  const committedEta = etaMap(route.optimized, route.stops, nowMs)

  const ordered = visitOrder(staged)
  const seqOf = new Map(ordered.map((s, i) => [s.id, formatSeq(i + 1, ordered.length)]))
  const committedOrder = visitOrder(route)
  const committedSeq = new Map(
    committedOrder.map((s, i) => [s.id, formatSeq(i + 1, committedOrder.length)]),
  )

  const describe = (stop: AddressedStop, seq: string, eta: string | null): ReviewStopRow => ({
    stop,
    seq,
    eta,
    title: titleFor(stop),
    subtitle: stop.address?.subtitle?.trim() ?? '',
    color: colorNameFor(stop, route.groups),
  })

  const rows: ReviewRow[] = []

  // ── Added ──
  const added = addedStops(pending)
  if (added.length > 0) {
    rows.push({ kind: 'section', id: 'sec-added', title: 'Added stops', count: added.length })
    for (const stop of added) {
      rows.push({
        kind: 'added',
        id: stop.id,
        changeId: changeIdFor.get(stop.id) ?? stop.id,
        // No sequence number here. It appears once, in the existing route,
        // where the number means something — see the note below.
        ...describe(stop, '', provisionalEta.get(stop.id) ?? null),
      })
    }
  }

  // ── Removed ──
  const removedList = route.stops.filter((s) => removed.has(s.id))
  if (removedList.length > 0) {
    rows.push({
      kind: 'section',
      id: 'sec-removed',
      title: 'Removed stops',
      count: removedList.length,
    })
    for (const stop of removedList) {
      rows.push({
        kind: 'removed',
        id: stop.id,
        changeId: changeIdFor.get(stop.id) ?? stop.id,
        // Its OWN number and its OWN time — what you are about to lose, not
        // what will take its place.
        ...describe(stop, committedSeq.get(stop.id) ?? '', committedEta.get(stop.id) ?? null),
      })
    }
  }

  // ── Existing route ──
  const existing = ordered.filter((s) => !removed.has(s.id))
  rows.push({
    kind: 'section',
    id: 'sec-existing',
    title: 'Existing route',
    count: existing.length,
  })
  const brk = breakLabel(route.breaks)
  // The break comes before the start location because it is a property of the
  // DAY rather than of a stop — the same order the route list uses.
  rows.push({ kind: 'break', id: 'row-break', label: brk.label, planned: brk.planned })
  rows.push({
    kind: 'start',
    id: 'row-start',
    subtitle: startSubtitle(route),
    hasAnchor: Boolean(route.start),
  })
  /*
    Added stops appear HERE too, in the position the preview gives them.

    The first version left them out, which looked tidier and was wrong in two
    ways at once: the numbering came out 1, 2, 4, 5 with a hole where the new
    stop goes — which reads as a rendering bug — and a row saying "goes in at
    3" then sat above another row that also said 3.

    So the sequence is continuous and every number means the same thing. The
    top section is not a duplicate of this one; it is the actionable summary,
    where the undo and the run colour live. This one is the consequence.
  */
  const stagedAdd = new Set(added.map((s) => s.id))
  for (const stop of existing) {
    rows.push({
      kind: 'existing',
      id: stop.id,
      edited: edited.has(stop.id),
      added: stagedAdd.has(stop.id),
      ...describe(stop, seqOf.get(stop.id) ?? '', provisionalEta.get(stop.id) ?? null),
    })
  }
  rows.push({ kind: 'end', id: 'row-end', hasAnchor: Boolean(route.end) })

  return rows
}

/** Clock strings by stop id, from one plan. Empty when there is no plan. */
function etaMap(
  optimized: OptimizedRoute | undefined,
  stops: readonly AddressedStop[],
  nowMs: number,
): Map<string, string> {
  if (!optimized) return new Map()
  const live = liveEta({ optimized, stops, nowMs })
  const out = new Map<string, string>()
  for (const [id, at] of live.byStopId) {
    if (Number.isFinite(at)) out.set(id, clockAt(at))
  }
  return out
}

/** When the previewed round finishes, epoch ms — the bottom bar's headline. */
export function provisionalFinishMs(route: Route, nowMs: number): number | null {
  const optimized = route.pending?.provisional
  if (!optimized) return null
  return liveEta({ optimized, stops: stagedStops(route), nowMs }).finishMs
}
