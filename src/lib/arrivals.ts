import type { AddressedStop, OptimizedRoute } from '../types.ts'
import { DEFAULT_SERVICE_SEC } from './stopSettings.ts'

/**
 * When the driver actually gets there.
 *
 * ── What replaced what ────────────────────────────────────────────────────
 *
 * Until M7 there were no arrival times at all: `arrivalSec` was an empty array
 * and `routeSummary` approximated the finish time by scaling the solved TOTAL
 * by the share of stops still pending. Its own docstring called that a
 * straight line through a curve, said it read optimistically on a round whose
 * long legs come last, and told M7 to REPLACE it rather than refine it. This
 * is that replacement.
 *
 * ── The plan is relative; the clock is not ────────────────────────────────
 *
 * `arrivalSec` is seconds from the START OF THE ROUTE, which is the only form
 * that survives being stored: a route solved at 08:00 and opened at 14:00 has
 * not changed shape, only when it is happening. The wall clock is therefore
 * computed at RENDER time by anchoring the plan to now.
 *
 * ── Where "now" is anchored, and why it is not the first stop ─────────────
 *
 * The driver is not standing at the start of the route; they are somewhere
 * between the last stop they handled and the next one they have not. So the
 * anchor is: **the next pending stop is reached in the time it takes to drive
 * the leg into it**, starting now. Everything downstream follows the plan from
 * there.
 *
 * Anchoring at the next stop's planned arrival instead would say "you arrive
 * now", which is wrong at every moment except one. Anchoring at the route's
 * planned start would mean a driver who set off late saw times that were wrong
 * by the same amount all day, which is precisely the failure that makes people
 * stop believing an ETA.
 *
 * Stops already handled get no ETA. An estimated arrival at a door you have
 * already been to is not stale information, it is noise.
 */

export interface ArrivalsInput {
  /** Driving seconds per leg of the ordered point list. Length = points − 1. */
  legSeconds: readonly number[]
  /** Seconds spent AT each ordered point. Length = points. Endpoints are 0. */
  serviceSeconds: readonly number[]
  /**
   * Rest breaks, and which ordered point each one follows.
   *
   * A break has no coordinate, so it is not one of the points — but it does
   * occupy the day, and every arrival after it is later by its whole duration.
   * Leaving it out is the kind of error that shows up as a driver being
   * consistently 45 minutes behind an ETA nobody can explain.
   */
  breaks?: readonly { afterIndex: number; durationSec: number }[]
}

/**
 * The plan, as seconds from the route's start.
 *
 * `arrival[0]` is 0 — the moment the driver leaves the start. Each subsequent
 * arrival adds the time spent at the previous point, any break taken after it,
 * and the drive from it.
 */
export function cumulativeArrivals({
  legSeconds,
  serviceSeconds,
  breaks = [],
}: ArrivalsInput): number[] {
  const count = legSeconds.length + 1
  // Several breaks can follow the same point, so this accumulates rather than
  // assigns — two half-hours after stop 4 is an hour after stop 4.
  const restAfter = new Map<number, number>()
  for (const rest of breaks) {
    restAfter.set(rest.afterIndex, (restAfter.get(rest.afterIndex) ?? 0) + rest.durationSec)
  }
  const out: number[] = Array.from({ length: count }, () => 0)
  for (let i = 1; i < count; i++) {
    out[i] =
      out[i - 1] + (serviceSeconds[i - 1] ?? 0) + (restAfter.get(i - 1) ?? 0) + (legSeconds[i - 1] ?? 0)
  }
  return out
}

/** How long a stop takes, with the documented default when nobody has said. */
export const serviceSecFor = (stop: Pick<AddressedStop, 'serviceTimeSec'>): number =>
  stop.serviceTimeSec ?? DEFAULT_SERVICE_SEC

export interface LiveEtaInput {
  optimized: Pick<OptimizedRoute, 'orderedStopIds' | 'arrivalSec'> & {
    legSeconds?: number[]
    legMeters?: number[]
  }
  stops: readonly AddressedStop[]
  /** Now, epoch ms. Passed in rather than read, so this stays pure. */
  nowMs: number
}

export interface LiveEta {
  /** Predicted arrival per stop id, epoch ms. Absent for stops already handled. */
  byStopId: Map<string, number>
  /** When the driver reaches the last ordered point, epoch ms. */
  finishMs: number | null
  /** Metres still to drive, when per-leg distances are known. */
  metresLeft: number | null
}

const EMPTY: LiveEta = { byStopId: new Map(), finishMs: null, metresLeft: null }

export function liveEta({ optimized, stops, nowMs }: LiveEtaInput): LiveEta {
  const { orderedStopIds, arrivalSec } = optimized
  if (arrivalSec.length === 0 || arrivalSec.length !== orderedStopIds.length) return EMPTY

  const byId = new Map(stops.map((s) => [s.id, s]))

  // The first ordered point that is a stop still waiting to be done. Failed
  // counts as handled: the van has been there and left.
  let next = -1
  for (let i = 0; i < orderedStopIds.length; i++) {
    const id = orderedStopIds[i]
    if (id !== null && byId.get(id)?.status === 'pending') {
      next = i
      break
    }
  }

  // Nothing left to do. The route finishes as soon as the driver reaches the
  // end point, and there is no stop left to predict an arrival for.
  if (next === -1) {
    return {
      byStopId: new Map(),
      finishMs: nowMs + lastLegSec(optimized) * 1000,
      metresLeft: lastLegMeters(optimized),
    }
  }

  // Back the anchor off by the DRIVE into the next stop, so it reads "you get
  // there in the time the leg takes" rather than "you are there now". The
  // service time at the previous point is subtracted with it: the driver has
  // already spent it.
  const previousId = next > 0 ? orderedStopIds[next - 1] : null
  const previousStop = previousId ? byId.get(previousId) : undefined
  // A previous point that WAS a stop but no longer exists — deleted since the
  // solve — still contributed its service time to every arrival downstream, so
  // the default is subtracted rather than nothing. Assuming zero would charge
  // the driver a minute they will not spend and push the whole rest of the
  // round out by it.
  const previousService = previousId
    ? previousStop
      ? serviceSecFor(previousStop)
      : DEFAULT_SERVICE_SEC
    : 0
  const legIn =
    next > 0 ? Math.max(arrivalSec[next] - arrivalSec[next - 1] - previousService, 0) : 0

  const baseSec = arrivalSec[next] - legIn
  const offsetMs = nowMs - baseSec * 1000

  const byStopId = new Map<string, number>()
  for (let i = next; i < orderedStopIds.length; i++) {
    const id = orderedStopIds[i]
    if (id !== null && byId.has(id)) byStopId.set(id, offsetMs + arrivalSec[i] * 1000)
  }

  return {
    byStopId,
    finishMs: offsetMs + arrivalSec[arrivalSec.length - 1] * 1000,
    metresLeft: remainingMeters(optimized.legMeters, next),
  }
}

/** Metres from where the driver is now: the leg into the next stop, and the rest. */
function remainingMeters(legMeters: number[] | undefined, next: number): number | null {
  if (!legMeters || legMeters.length === 0) return null
  let total = 0
  for (let j = Math.max(next - 1, 0); j < legMeters.length; j++) total += legMeters[j]
  return total
}

/** The drive still to come on a round with nothing left to deliver. */
function lastLegSec(optimized: LiveEtaInput['optimized']): number {
  const legs = optimized.legSeconds
  return legs && legs.length > 0 ? legs[legs.length - 1] : 0
}

function lastLegMeters(optimized: LiveEtaInput['optimized']): number | null {
  const legs = optimized.legMeters
  return legs && legs.length > 0 ? legs[legs.length - 1] : null
}
