import type { LineString } from 'geojson'
import type { AddressedStop, LatLng, OptimizedRoute, Route } from '../types.ts'
import { cumulativeArrivals, serviceSecFor } from './arrivals.ts'
import { END_KEY, START_KEY, type CostFn, type MatrixPoint } from './costMatrix.ts'
import { applyMove, insertAll, type InsertContext, type StopTiming } from './insertStops.ts'
import { allocateAppendedStopId, allocateInsertedStopId, type StopIdMode } from './stopIds.ts'
import { visitOrder } from './routeOrder.ts'
import { frozenOrder, plannedStops, removedStopIds, stagedStops } from './staging.ts'

/**
 * The preview: what the round would look like if you applied this.
 *
 * ── Why a preview exists at all ───────────────────────────────────────────
 *
 * A diff that only listed what changed would make the driver do the
 * arithmetic. The question they are actually asking is "does this still get me
 * home by six", and that is a number, not a list. So the review screen shows
 * real ETAs — computed from the same cached matrix, with no solver call and no
 * network beyond the one row and column the new stop needed.
 *
 * ── It previews the UPDATE model, not the reoptimised one ─────────────────
 *
 * The commit sheet offers two models, and only one of them can be previewed
 * usefully. "Update route" has a definite answer before you press it — these
 * stops, in these gaps. "Reoptimise" moves everything by design, so a per-row
 * ETA for it would be a promise the solver has not made yet. Previewing the
 * conservative one is also the safer default: the number on screen is the one
 * you get if you take the option that does not disturb the van.
 *
 * ── The geometry is straight lines, and says so ───────────────────────────
 *
 * A real road polyline costs an OSRM route request, and staging happens at a
 * kerb, possibly on one bar of signal, possibly several times in a row. The
 * preview draws straight legs and sets `estimated`, which the summary strip
 * and the finish pill already know how to say out loud. Committing fetches the
 * real thing once.
 *
 * Pure module: no React, no store, no I/O.
 */

export interface ProvisionalInput {
  route: Pick<Route, 'stops' | 'optimized' | 'pending' | 'start' | 'end' | 'endpointMode'>
  /** Objective-space costs — what the insertion is priced in. */
  cost: CostFn
  /** Driving seconds, which on a distance-objective route is a different grid. */
  durationSec: CostFn
  /** Metres, when they are known. Absent on a duration-objective route. */
  metres?: CostFn
  /** Now, as seconds from local midnight. Time windows are checked against it. */
  departSec: number
  stopIdMode?: StopIdMode
}

export interface ProvisionalLabel {
  stopId: string
  originalPosition: number
}

export interface ProvisionalResult {
  optimized: OptimizedRoute
  /** New labels for staged adds, earned from where they landed. */
  labels: Record<string, ProvisionalLabel>
  /** Every time window along the previewed route is still met. */
  feasible: boolean
}

/** Every point the plan runs over, in matrix-key form. */
export function provisionalPoints(input: ProvisionalInput['route']): MatrixPoint[] {
  const points: MatrixPoint[] = []
  if (input.start) points.push({ key: START_KEY, ...input.start })
  for (const stop of plannedStops(input)) points.push({ key: stop.id, lat: stop.lat, lng: stop.lng })
  if (input.end) points.push({ key: END_KEY, ...input.end })
  return points
}

export function buildProvisional(input: ProvisionalInput): ProvisionalResult | null {
  const { route, cost, durationSec, metres, departSec } = input
  const changes = route.pending?.changes ?? []
  if (changes.length === 0) return null

  const all = stagedStops(route)
  const byId = new Map(all.map((s) => [s.id, s]))

  const pinnedFirst = Boolean(route.start)
  const pinnedLast = Boolean(route.end)

  // The frozen sequence: the driver's order, minus removals, with the
  // endpoints back on the ends where the matrix expects them.
  const frozen = [
    ...(pinnedFirst ? [START_KEY] : []),
    ...frozenOrder(route).map((s) => s.id),
    ...(pinnedLast ? [END_KEY] : []),
  ]

  const timing = (key: string): StopTiming => {
    const stop = byId.get(key)
    if (!stop) return { serviceSec: 0 }
    return {
      serviceSec: serviceSecFor(stop),
      twOpenSec: stop.twOpenSec,
      twCloseSec: stop.twCloseSec,
    }
  }

  const ctx: InsertContext = {
    sequence: frozen,
    cost,
    durationSec,
    timing,
    pinnedFirst,
    pinnedLast,
    departSec,
  }

  const added = changes.filter((c) => c.kind === 'add').map((c) => c.stopId)
  const inserted = insertAll(ctx, added)

  // Moves last, and pinned: the driver said where this one goes, and an
  // insertion decided afterwards must not be allowed to shuffle it.
  let sequence = inserted.sequence
  for (const change of changes) {
    if (change.kind !== 'move') continue
    sequence = applyMove(sequence, change.stopId, change.toIndex, pinnedFirst, pinnedLast)
  }

  const planLegs: number[] = []
  const planMetres: number[] = []
  for (let i = 0; i < sequence.length - 1; i++) {
    planLegs.push(durationSec(sequence[i], sequence[i + 1]) ?? 0)
    planMetres.push(metres?.(sequence[i], sequence[i + 1]) ?? 0)
  }
  const planService = sequence.map((key) => {
    const stop = byId.get(key)
    return stop ? serviceSecFor(stop) : 0
  })
  const planArrivals = cumulativeArrivals({ legSeconds: planLegs, serviceSeconds: planService })

  /*
    Handled stops go back into the ORDER, having been left out of the PLAN.

    The plan must not drive to a door the van has already been to — that is why
    `plannedStops` drops them. But the order is also what decides which stops
    the carousel pages through and which the map draws, and staging one change
    must not make twenty delivered stops disappear from the driver's list.

    So they are spliced back in where the committed plan had them, costing
    nothing: zero service, and an arrival that collapses forward onto the next
    real stop, which keeps every array the same length and every total intact.
    `liveEta` never surfaces an arrival for a handled stop anyway.
  */
  const { sequence: display, arrivalSec, legSeconds, legMeters } = restoreHandled({
    route,
    planned: sequence,
    arrivals: planArrivals,
    legs: planLegs,
    metres: metres ? planMetres : undefined,
    byId,
  })

  const orderedStopIds = display.map((key) => (byId.has(key) ? key : null))
  const orderedWaypoints: LatLng[] = display.map((key) => {
    const stop = byId.get(key)
    if (stop) return { lat: stop.lat, lng: stop.lng }
    return (key === START_KEY ? route.start : route.end) ?? { lat: 0, lng: 0 }
  })

  const geometry: LineString = {
    type: 'LineString',
    coordinates: orderedWaypoints.map((p) => [p.lng, p.lat]),
  }

  const optimized: OptimizedRoute = {
    orderedWaypoints,
    orderedStopIds,
    arrivalSec,
    legSeconds,
    legMeters,
    geometry,
    distanceMeters: planMetres.reduce((a, b) => a + b, 0),
    durationSeconds: planLegs.reduce((a, b) => a + b, 0),
    candidatesVisited: orderedStopIds.filter((id) => id !== null).length,
    candidatesTotal: all.length,
    // Straight legs and a matrix, not a road router. Both the summary strip
    // and the finish pill already know how to say so.
    estimated: true,
  }

  return {
    optimized,
    labels: labelsFor(sequence, byId, added, input.stopIdMode ?? 'letterBlock'),
    feasible: inserted.feasible,
  }
}

interface RestoreInput {
  route: ProvisionalInput['route']
  /** The planned sequence, pending stops and endpoints only. */
  planned: readonly string[]
  arrivals: readonly number[]
  legs: readonly number[]
  metres: readonly number[] | undefined
  byId: ReadonlyMap<string, AddressedStop>
}

/**
 * Put the already-handled stops back into the order, at no cost.
 *
 * Each one is inserted immediately before the first planned entry that follows
 * it in the COMMITTED order, so a delivered stop keeps the position the driver
 * remembers rather than being swept to one end. Its arrival collapses forward
 * onto the entry after it — a handled stop never shows an ETA, so the value is
 * never read, and collapsing forward is what keeps every leg total unchanged.
 */
function restoreHandled({ route, planned, arrivals, legs, metres, byId }: RestoreInput): {
  sequence: string[]
  arrivalSec: number[]
  legSeconds: number[]
  legMeters: number[] | undefined
} {
  const plannedSet = new Set(planned)
  const removed = removedStopIds(route.pending)
  /*
    Two different reasons a stop is absent from the plan, and only ONE of them
    comes back.

    Handled: the van has been there, so it costs nothing and belongs in the
    order. Staged for removal: it is about to stop existing, and putting it in
    the order would make `liveEta` count it as still to come — the preview's
    finish time would then include a stop the driver is removing, which is the
    one number this whole screen exists to get right. The map still draws it,
    wearing its red trash chip, from `stagedStops` rather than from the order.
  */
  const restorable = (stop: AddressedStop) =>
    !plannedSet.has(stop.id) && byId.has(stop.id) && !removed.has(stop.id)

  const committed = visitOrder({ stops: route.stops, optimized: route.optimized })
  const handled = committed.filter(restorable)

  if (handled.length === 0) {
    return {
      sequence: [...planned],
      arrivalSec: [...arrivals],
      legSeconds: [...legs],
      legMeters: metres ? [...metres] : undefined,
    }
  }

  // Where each handled stop goes: before the next committed entry that IS in
  // the plan. Nothing after it survives, so it goes at the end.
  const before = new Map<string, string[]>()
  const trailing: string[] = []
  for (const [index, stop] of committed.entries()) {
    if (!restorable(stop)) continue
    const successor = committed.slice(index + 1).find((s) => plannedSet.has(s.id))
    if (!successor) {
      trailing.push(stop.id)
      continue
    }
    const list = before.get(successor.id)
    if (list) list.push(stop.id)
    else before.set(successor.id, [stop.id])
  }

  const sequence: string[] = []
  const arrivalSec: number[] = []
  const legSeconds: number[] = []
  const legMeters: number[] | undefined = metres ? [] : undefined

  for (const [i, key] of planned.entries()) {
    for (const handledId of before.get(key) ?? []) {
      sequence.push(handledId)
      // Collapses forward onto the stop that follows it.
      arrivalSec.push(arrivals[i] ?? 0)
      legSeconds.push(0)
      legMeters?.push(0)
    }
    sequence.push(key)
    arrivalSec.push(arrivals[i] ?? 0)
    if (i < planned.length - 1) {
      legSeconds.push(legs[i] ?? 0)
      legMeters?.push(metres?.[i] ?? 0)
    }
  }

  for (const handledId of trailing) {
    sequence.push(handledId)
    arrivalSec.push(arrivals[arrivals.length - 1] ?? 0)
    legSeconds.push(0)
    legMeters?.push(0)
  }

  return { sequence, arrivalSec, legSeconds, legMeters }
}

/**
 * The IDs the inserted stops earned.
 *
 * ── Why the label follows the POSITION, and why that is not a contradiction ─
 *
 * M2's doctrine is that an ID is a property of the parcel and a position is a
 * property of the route, and they never track each other. That still holds:
 * this runs ONCE, while the stop is still staged and no label has been written
 * on anything. What it is choosing is which existing parcel this new one sits
 * beside — "the one after D7" — which is genuinely useful information to a
 * driver reaching into a van, and is fixed forever the moment they apply.
 *
 * A stop that lands at the very end of the round is an APPEND, not an insert:
 * it gets the next original number (E1) rather than a decimal off the last
 * stop, because nothing has been squeezed in between anything.
 */
function labelsFor(
  sequence: readonly string[],
  byId: ReadonlyMap<string, AddressedStop>,
  added: readonly string[],
  mode: StopIdMode,
): Record<string, ProvisionalLabel> {
  const labels: Record<string, ProvisionalLabel> = {}
  if (added.length === 0) return labels

  const staged = new Set(added)
  const settled = [...byId.values()].filter((s) => !staged.has(s.id))

  /*
    Only SETTLED stops seed the allocator.

    A staged add is already wearing a provisional label — an E1 handed out at
    the moment it was created, before anything knew where it would land. Count
    those as taken and the append path immediately finds E1 occupied by the
    very stop it is labelling, and falls back to a decimal off it.
  */
  const taken = new Set(settled.map((s) => s.stopId))
  let highest = settled.reduce((max, s) => Math.max(max, s.originalPosition), 0)

  /*
    Walk the sequence, not the change list.

    Two stops added beside each other must resolve left to right: the first
    takes D7.1 from D7, and the second must then anchor off D7.1 to become D7.2
    rather than anchoring off the label the first one is no longer wearing.
  */
  const current = new Map<string, ProvisionalLabel>()
  for (const stop of settled) {
    current.set(stop.id, { stopId: stop.stopId, originalPosition: stop.originalPosition })
  }

  const lastStopIndex = sequence.reduce((last, key, i) => (byId.has(key) ? i : last), -1)

  for (const [index, key] of sequence.entries()) {
    if (!staged.has(key)) continue

    // A stop that lands at the very end of the round is an APPEND, not an
    // insert: nothing has been squeezed in between anything, so it takes the
    // next original number rather than a decimal off the stop before it.
    if (index === lastStopIndex) {
      const identity = allocateAppendedStopId(highest, taken, mode)
      taken.add(identity.stopId)
      highest = identity.originalPosition
      labels[key] = identity
      current.set(key, identity)
      continue
    }

    // The neighbour it is squeezing in beside: the one before it when there is
    // one, otherwise the one after — a stop inserted at the head of the round
    // takes its label from what it now precedes.
    const anchor =
      neighbourLabel(sequence, current, index, -1) ?? neighbourLabel(sequence, current, index, 1)
    if (!anchor) continue

    const identity = {
      stopId: allocateInsertedStopId(anchor.stopId, taken),
      // Inherited: this stop belongs to that part of the original round, which
      // is what "Originally 37th" means on the card.
      originalPosition: anchor.originalPosition,
    }
    taken.add(identity.stopId)
    labels[key] = identity
    current.set(key, identity)
  }

  return labels
}

/** The nearest labelled entry in `direction`, skipping endpoints and unlabelled adds. */
function neighbourLabel(
  sequence: readonly string[],
  current: ReadonlyMap<string, ProvisionalLabel>,
  from: number,
  direction: 1 | -1,
): ProvisionalLabel | undefined {
  for (let i = from + direction; i >= 0 && i < sequence.length; i += direction) {
    const label = current.get(sequence[i])
    if (label) return label
  }
  return undefined
}
