import { useMemo, useState } from 'react'
import { useRoutesStore } from '../../store/routesStore'
import { DEFAULT_DEPART_SEC } from '../../lib/compute/solverPort'
import { formatLateness, infeasibilityOf } from '../../lib/infeasibility'
import { secondsToClock } from '../../lib/stopSettings'

/**
 * "This day cannot be done as planned", with the reason.
 *
 * ── Doing better than "can't reoptimise" ──────────────────────────────────
 *
 * Spoke's answer to an impossible day is a blunt failure with no detail, which
 * leaves the driver deleting stops at random to find out which window is the
 * problem. The solver already knows which one, and by how much, so the banner
 * names it — and expands to name all of them.
 *
 * The route is still shown, and that is deliberate. A plan that misses one
 * window by eight minutes is a good day's work with one phone call in it, and
 * refusing to display it would mean a driver whose day genuinely cannot be done
 * gets nothing at all. The whole point of the time-warp formulation is that the
 * search returns the least-bad answer instead of failing.
 *
 * Renders nothing when every window is met, and nothing for a route solved
 * before M11 — see `infeasibilityOf` for why undefined is not false.
 */
export function InfeasibilityBanner() {
  const [expanded, setExpanded] = useState(false)
  const route = useRoutesStore((s) => (s.activeRouteId ? s.routes[s.activeRouteId] : null))

  const report = useMemo(() => {
    if (!route?.optimized) return null
    return infeasibilityOf(route.optimized, route.stops, route.startSec ?? DEFAULT_DEPART_SEC)
  }, [route])

  if (!report || report.late.length === 0) return null

  return (
    <div
      role="status"
      className="pointer-events-auto mx-3 rounded-row border border-amber-300 bg-amber-50 px-3 py-2 text-body text-amber-900 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-px shrink-0">
          ⚠
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{report.summary}</p>
          {report.late.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-1 min-h-touch text-label font-semibold underline underline-offset-2"
            >
              {expanded ? 'Hide the rest' : `Show all ${report.late.length}`}
            </button>
          )}
          {expanded && (
            <ul className="mt-1 space-y-0.5 text-label">
              {report.late.map((late) => (
                <li key={late.stopId}>
                  <span className="font-semibold">{late.label}</span> closes{' '}
                  {secondsToClock(late.twCloseSec)}, arrive {secondsToClock(late.arrivalSec)} —{' '}
                  {formatLateness(late.lateBySec)} late
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
