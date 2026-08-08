import type { AddressedStop, PendingChange, PendingChangeSet, Route } from '../types.ts'
import type { StagedKind } from './map/chipSpec.ts'
import { visitOrder } from './routeOrder.ts'

/**
 * Staged changes, as algebra.
 *
 * ── The rule the whole milestone rests on ─────────────────────────────────
 *
 * A driver mid-round has a mental model of their sequence and has PHYSICALLY
 * SORTED PARCELS to match it. Adding a stop must therefore not move anything,
 * and must not be applied at all until they have seen what it would cost. So
 * edits accumulate here, as a reviewable diff, and the authoritative route is
 * not touched until commit.
 *
 * ── Two views of a staged route, and why both are needed ──────────────────
 *
 * `stagedStops` KEEPS removals, because the map has to draw the red trash chip
 * on a stop that is still there until you apply. `plannedStops` DROPS them,
 * because the provisional route is what the round would look like afterwards.
 * Collapsing the two into one was the first thing tried and it produces a
 * preview that still drives to the stop it says it is removing.
 *
 * ── Which edits stage ─────────────────────────────────────────────────────
 *
 * Only the ones that can move a stop or shift an ETA — see `stagesPlan`. An
 * access code cannot do either, and a review screen that filled up with door
 * codes would train the driver to apply without reading, which is the one
 * behaviour this design exists to prevent.
 *
 * Pure module: no React, no store, no I/O.
 */

/**
 * The fields whose value the plan actually depends on TODAY.
 *
 * `lat`/`lng`/`address` change the distances. `serviceTimeSec` changes every
 * arrival downstream. The time window changes whether a gap is feasible at
 * all. Those six are exactly what `lib/provisional.ts` reads, and the list is
 * defined by that rather than by what sounds route-ish.
 *
 * ── Two fields that are deliberately NOT here ─────────────────────────────
 *
 * `order` ("First"/"Last") and `kind` ("Pickup") both sound like they belong,
 * and neither one currently reaches the plan: `planSelectiveRoute` takes its
 * endpoints from the route's own anchors and never looks at `order`, and
 * nothing anywhere honours pickup-before-delivery. Staging them would put
 * changes on the review screen that provably move nothing — the exact
 * "diff full of noise" failure the split exists to avoid.
 *
 * `kind` has a second reason: it drives the automatic purple/teal group rule
 * in the store, which operates on the committed stop. Staging it would leave
 * the rule reading a value the driver has already changed.
 *
 * When M9–M11 teach the solver about pinned order and pickups, they belong in
 * this list, and this comment is the note that says so.
 *
 * Everything else — notes, access codes, recipient, parcel finder, group,
 * parcel count, photos, status — writes straight through, as before.
 */
const PLAN_FIELDS = [
  'lat',
  'lng',
  'address',
  'twOpenSec',
  'twCloseSec',
  'serviceTimeSec',
] as const satisfies readonly (keyof AddressedStop)[]

/** Does this patch need reviewing, or can it just be written? */
export function stagesPlan(patch: Partial<AddressedStop>): boolean {
  return PLAN_FIELDS.some((field) => field in patch)
}

/** The half of a patch that stages, and the half that writes through. */
export function splitPatch(patch: Partial<AddressedStop>): {
  planned: Partial<AddressedStop>
  direct: Partial<AddressedStop>
} {
  const planned: Partial<AddressedStop> = {}
  const direct: Partial<AddressedStop> = {}
  for (const [key, value] of Object.entries(patch)) {
    const target = (PLAN_FIELDS as readonly string[]).includes(key) ? planned : direct
    Object.assign(target, { [key]: value })
  }
  return { planned, direct }
}

// ──────────────────────────────────────────────────────── accumulating

/**
 * Fold a new change into the set.
 *
 * Collapsing is not a nicety — it is what makes the header count honest.
 * Nudging one stop's time window twice is ONE change to the route, and a
 * review screen that called it two would be counting keystrokes rather than
 * consequences. Four rules, each of which is a thing a driver actually does:
 *
 *  - edit then edit the same stop  → one change, patches merged
 *  - add then edit the staged stop → still just the add, with the edit in it
 *  - add then remove the same stop → nothing at all; they changed their mind
 *  - move then move                → one change, the last position wins
 *
 * A `remove` of a stop that is genuinely on the route is never collapsed
 * against an `add`, because the two name different stops.
 */
export function foldChange(changes: readonly PendingChange[], next: PendingChange): PendingChange[] {
  const existing = changes.filter((c) => c.stopId === next.stopId)
  const others = changes.filter((c) => c.stopId !== next.stopId)
  const at = (kind: PendingChange['kind']) => existing.find((c) => c.kind === kind)

  const staged = at('add')

  if (next.kind === 'remove' && staged) {
    // Removing a stop that was itself only staged retracts the add. There is
    // no diff to show for a stop that never made it onto the route.
    return others
  }

  if (next.kind === 'edit') {
    if (staged && staged.kind === 'add') {
      return [
        ...others,
        ...existing.filter((c) => c !== staged),
        { ...staged, stop: { ...staged.stop, ...next.patch } },
      ]
    }
    const prior = at('edit')
    if (prior && prior.kind === 'edit') {
      return [
        ...others,
        ...existing.filter((c) => c !== prior),
        { ...prior, patch: { ...prior.patch, ...next.patch }, at: next.at },
      ]
    }
  }

  // One change of a given kind per stop. A second `move` replaces the first
  // rather than queueing behind it — the driver dragged the row twice, they
  // did not ask for it to be moved twice.
  const replaced = existing.filter((c) => c.kind !== next.kind)
  return [...others, ...replaced, next]
}

/** Drop one change by its own id — the review screen's per-row undo. */
export function dropChange(changes: readonly PendingChange[], changeId: string): PendingChange[] {
  return changes.filter((c) => c.id !== changeId)
}

/**
 * "1 change" / "2 changes".
 *
 * ── Where we fix Spoke ────────────────────────────────────────────────────
 *
 * Spoke's header reads "2 stops", which is ambiguous in the one place it
 * cannot afford to be: it could mean two stops were changed or that the route
 * has two stops. Ours names the unit it is actually counting.
 */
export function changeCount(pending: PendingChangeSet | undefined): number {
  return pending?.changes.length ?? 0
}

export function describeChangeCount(count: number): string {
  return `${count} change${count === 1 ? '' : 's'}`
}

/** Is this route in staged mode? */
export const isStaged = (route: Pick<Route, 'pending'>): boolean => changeCount(route.pending) > 0

// ────────────────────────────────────────────────────────── the views

type StagedRoute = Pick<Route, 'stops' | 'optimized' | 'pending'>

/**
 * Staged edits by stop uuid, for the map's chip states.
 *
 * A stop can only be in one staged state at a time, and `foldChange` is what
 * guarantees it: an add that gets removed retracts, so nothing is ever both.
 */
export function stagedKindByStopId(
  pending: PendingChangeSet | undefined,
): Record<string, StagedKind> {
  const out: Record<string, StagedKind> = {}
  for (const change of pending?.changes ?? []) {
    if (change.kind === 'add') out[change.stopId] = 'add'
    else if (change.kind === 'remove') out[change.stopId] = 'remove'
  }
  return out
}

/**
 * The route as the MAP and the stop card see it: edits applied, added stops
 * present, removed stops still there and marked.
 *
 * Removals stay because the annotation is the point — a red chip with a trash
 * glyph on the stop you are about to drop is the review, and a stop that had
 * simply vanished from the map would be a change you could not inspect.
 */
export function stagedStops(route: StagedRoute): AddressedStop[] {
  const changes = route.pending?.changes ?? []
  if (changes.length === 0) return route.stops

  const patches = new Map<string, Partial<AddressedStop>>()
  const added: AddressedStop[] = []
  for (const change of changes) {
    if (change.kind === 'edit') patches.set(change.stopId, change.patch)
    else if (change.kind === 'add') added.push(change.stop)
  }

  const merged = route.stops.map((stop) => {
    const patch = patches.get(stop.id)
    return patch ? { ...stop, ...patch } : stop
  })
  return added.length === 0 ? merged : [...merged, ...added]
}

/**
 * The whole route as the map, the carousel and the edit form see it.
 *
 * One function rather than three call sites doing the same two substitutions,
 * because the two have to move together: a carousel built from the staged
 * stops but ordered by the COMMITTED plan puts the new stop at the end of the
 * swipe run instead of where the preview says it goes, and the map would then
 * fly to a different stop than the card is showing.
 *
 * Returns the route itself when nothing is staged, so every downstream
 * `useMemo` keyed on it stays stable.
 */
export function stagedRoute<T extends StagedRoute>(route: T): T {
  if (!route.pending || route.pending.changes.length === 0) return route
  return {
    ...route,
    stops: stagedStops(route),
    optimized: route.pending.provisional ?? route.optimized,
  }
}

/** One stop as the staged view sees it, or null when it is not on the route. */
export function stagedStop(route: StagedRoute, stopId: string): AddressedStop | null {
  return stagedStops(route).find((s) => s.id === stopId) ?? null
}

/** Everything a `remove` is staged against. */
export function removedStopIds(pending: PendingChangeSet | undefined): Set<string> {
  return new Set(
    (pending?.changes ?? []).filter((c) => c.kind === 'remove').map((c) => c.stopId),
  )
}

/**
 * The stops the PROVISIONAL route is planned over: the staged view with
 * removals actually gone.
 *
 * Handled stops are dropped too, for the same reason `calculateRoute` drops
 * them: a plan that routes through doors the driver has already been to is not
 * a plan, and the arrival times downstream of it are all wrong.
 */
export function plannedStops(route: StagedRoute): AddressedStop[] {
  const removed = removedStopIds(route.pending)
  return stagedStops(route).filter((s) => !removed.has(s.id) && s.status === 'pending')
}

/**
 * The frozen sequence a staged insert is inserted INTO: the solved order,
 * minus anything handled or staged for removal, and with staged adds excluded
 * because their position is what is being decided.
 *
 * This is the driver's manual order, and preserving it is the entire point of
 * the "Update route" model.
 */
export function frozenOrder(route: StagedRoute): AddressedStop[] {
  const removed = removedStopIds(route.pending)
  const staged = new Set(
    (route.pending?.changes ?? []).filter((c) => c.kind === 'add').map((c) => c.stopId),
  )
  return visitOrder({ stops: stagedStops(route), optimized: route.optimized }).filter(
    (s) => !removed.has(s.id) && !staged.has(s.id) && s.status === 'pending',
  )
}

/** Stops staged to be added, oldest first — the review screen's first section. */
export function addedStops(pending: PendingChangeSet | undefined): AddressedStop[] {
  return (pending?.changes ?? [])
    .filter((c) => c.kind === 'add')
    .sort((a, b) => a.at - b.at)
    .map((c) => c.stop)
}
