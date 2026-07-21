import { useShallow } from 'zustand/react/shallow'
import { useRouteStore } from '../store/routeStore'
import { formatLatLng } from '../lib/coordinates'
import type { LatLng } from '../types'

const sameCoord = (a: LatLng | null, b: LatLng) =>
  !!a && a.lat === b.lat && a.lng === b.lng

/** Scrollable list of candidate stops; each can be set as start/end or removed. */
export function WaypointList() {
  const { waypoints, startLocation, endLocation } = useRouteStore(
    useShallow((s) => ({
      waypoints: s.waypoints,
      startLocation: s.startLocation,
      endLocation: s.endLocation,
    })),
  )
  const removeWaypoint = useRouteStore((s) => s.removeWaypoint)
  const setStart = useRouteStore((s) => s.setStart)
  const setEnd = useRouteStore((s) => s.setEnd)

  if (waypoints.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        No waypoints yet. Upload a CSV or JSON file above.
      </p>
    )
  }

  return (
    <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
      {waypoints.map((wp, i) => {
        const isStart = sameCoord(startLocation, wp)
        const isEnd = sameCoord(endLocation, wp)
        return (
          <li
            key={`${wp.lat},${wp.lng},${i}`}
            className="flex items-center gap-2 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-slate-600">
              <span className="mr-2 text-slate-400">{i + 1}.</span>
              {formatLatLng(wp)}
            </span>

            {isStart && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                START
              </span>
            )}
            {isEnd && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                END
              </span>
            )}

            {!isStart && (
              <button
                onClick={() => setStart(wp)}
                title="Set as start"
                className="text-[11px] text-slate-400 hover:text-emerald-600"
              >
                start
              </button>
            )}
            {!isEnd && (
              <button
                onClick={() => setEnd(wp)}
                title="Set as end"
                className="text-[11px] text-slate-400 hover:text-rose-600"
              >
                end
              </button>
            )}
            <button
              onClick={() => removeWaypoint(i)}
              aria-label={`Remove waypoint ${i + 1}`}
              className="text-slate-300 hover:text-red-500"
            >
              ✕
            </button>
          </li>
        )
      })}
    </ul>
  )
}
