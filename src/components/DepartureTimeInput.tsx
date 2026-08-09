import { useRoutesStore } from '../store/routesStore'
import { DEFAULT_DEPART_SEC } from '../lib/compute/solverPort'
import { clockToSeconds, secondsToClock } from '../lib/stopSettings'

/**
 * When the driver leaves.
 *
 * ── Why this control has to exist at all ──────────────────────────────────
 *
 * A time window is a time of day. Without a departure time the solver has
 * nothing to compare one against, so "deliver before 14:00" is unanswerable —
 * and getting it wrong is not a small error: setting off two hours later than
 * the plan assumed makes every window in the afternoon unreachable, and the
 * driver would see a warning they could neither explain nor fix.
 *
 * ── Why not "now" ─────────────────────────────────────────────────────────
 *
 * Because a route solved at 08:00 and re-solved at 14:00 would then be a
 * different route, and a plan whose shape depends on when you asked for it is
 * not a plan. It also makes tomorrow's round impossible to prepare tonight.
 *
 * `<input type="time">` rather than a custom picker: it is the one control every
 * mobile browser renders as the platform's own time wheel, which on a phone in a
 * van beats anything hand-rolled.
 */
export function DepartureTimeInput() {
  const startSec = useRoutesStore((s) =>
    s.activeRouteId ? s.routes[s.activeRouteId]?.startSec : undefined,
  )
  const setStartSec = useRoutesStore((s) => s.setStartSec)

  const value = secondsToClock(startSec ?? DEFAULT_DEPART_SEC)

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">
        Start time
        <span className="ml-1 text-xs text-slate-400">when you set off</span>
      </span>
      <input
        type="time"
        value={value}
        onChange={(event) => {
          const seconds = clockToSeconds(event.target.value)
          // A half-typed value parses to undefined; leaving the route's own
          // setting alone until it is a real time stops the field from
          // resetting itself under the driver's fingers.
          if (seconds !== undefined) setStartSec(seconds)
        }}
        className="min-h-touch rounded-md border border-slate-300 px-2 text-sm"
      />
    </label>
  )
}
