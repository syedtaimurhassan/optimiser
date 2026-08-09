import type { AddressedStop, OptimizedRoute } from '../types.ts'
import { secondsToClock } from './stopSettings.ts'

/**
 * Saying WHICH stop cannot be made, and by how much.
 *
 * ── The bar this is set against ───────────────────────────────────────────
 *
 * Spoke's answer to an impossible day is "can't reoptimise". That is true and
 * useless: it names nothing, so the driver has to guess which of forty windows
 * is the problem, and the only tool they have for guessing is deleting stops
 * until it works.
 *
 * The solver already knows. It returns the best route it could find and, per
 * stop, how late that route arrives. So the honest report is a sentence a person
 * can act on — "D7 closes at 14:00, earliest arrival 14:38" — and the route is
 * still shown, because a plan that misses one window by eight minutes is a
 * perfectly good day's work with one phone call in it.
 *
 * ── Why the route is never withheld ───────────────────────────────────────
 *
 * Refusing to show an infeasible route would mean a driver whose day genuinely
 * cannot be done gets nothing at all. The time-warp formulation exists precisely
 * so the search can return the least-bad answer instead of failing; throwing
 * that away at the last moment would waste it.
 *
 * Pure `lib/`: no React, no store. The clock formatting is shared with the edit
 * form so a window reads the same in the warning as it does in the form that
 * set it.
 */

export interface LateStop {
  stopId: string
  /** The immutable display label, e.g. "D7". */
  label: string
  /** Seconds past the window's close. Always positive. */
  lateBySec: number
  /** When the window shuts, seconds from local midnight. */
  twCloseSec: number
  /** When the driver gets there, seconds from local midnight. */
  arrivalSec: number
}

export interface InfeasibilityReport {
  /** Empty when every window is met — which is also the pre-M11 case. */
  late: LateStop[]
  /** Total lateness in seconds. */
  totalLateSec: number
  /** One sentence for the banner. Empty when there is nothing to say. */
  summary: string
}

const NOTHING: InfeasibilityReport = { late: [], totalLateSec: 0, summary: '' }

/** "38 min", "1 h 5 min". */
export function formatLateness(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/**
 * Which stops the plan cannot reach in time.
 *
 * `departAtSec` turns the route's relative arrivals into clock times, because a
 * window is a time of day and "1 h 12 min into the route" is not comparable
 * with "closes at 14:00".
 *
 * Returns nothing at all for a route solved before M11: `feasible` is undefined
 * there, and an old route did not fail its windows — it was never asked about
 * them. Treating undefined as false would light a warning on every route in the
 * driver's history.
 */
export function infeasibilityOf(
  optimized: Pick<OptimizedRoute, 'orderedStopIds' | 'arrivalSec' | 'feasible' | 'lateBySec'>,
  stops: readonly AddressedStop[],
  departAtSec: number,
): InfeasibilityReport {
  const { lateBySec, orderedStopIds, arrivalSec } = optimized
  if (optimized.feasible !== false || !lateBySec) return NOTHING

  const byId = new Map(stops.map((stop) => [stop.id, stop]))
  const late: LateStop[] = []
  let totalLateSec = 0

  for (let i = 0; i < orderedStopIds.length; i++) {
    const seconds = lateBySec[i] ?? 0
    if (seconds <= 0) continue
    const id = orderedStopIds[i]
    const stop = id ? byId.get(id) : undefined
    // An endpoint that is not a stop has no window and cannot be late; if one
    // somehow is, it is not something the driver can act on.
    if (!stop || stop.twCloseSec === undefined) continue
    totalLateSec += seconds
    late.push({
      stopId: stop.id,
      label: stop.stopId,
      lateBySec: seconds,
      twCloseSec: stop.twCloseSec,
      arrivalSec: departAtSec + (arrivalSec[i] ?? 0),
    })
  }

  if (late.length === 0) return NOTHING

  // Worst first: if only one line fits, it should be the one worth reading.
  late.sort((a, b) => b.lateBySec - a.lateBySec)

  const worst = late[0]
  const head =
    `${worst.label} closes at ${secondsToClock(worst.twCloseSec)}, ` +
    `earliest arrival ${secondsToClock(worst.arrivalSec)} ` +
    `(${formatLateness(worst.lateBySec)} late)`
  const summary =
    late.length === 1
      ? `One stop cannot be reached in time: ${head}.`
      : `${late.length} stops cannot be reached in time. Worst: ${head}.`

  return { late, totalLateSec, summary }
}
