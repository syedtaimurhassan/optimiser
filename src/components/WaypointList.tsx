import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRouteStore } from '../store/routeStore'
import { formatLatLng } from '../lib/coordinates'
import type { LatLng } from '../types'

const sameCoord = (a: LatLng | null, b: LatLng) =>
  !!a && a.lat === b.lat && a.lng === b.lng

/** Active (not-yet-delivered) stops; each can be marked done, set as start/end,
 *  or removed. */
export function WaypointList() {
  const { waypoints, startLocation, endLocation } = useRouteStore(
    useShallow((s) => ({
      waypoints: s.waypoints,
      startLocation: s.startLocation,
      endLocation: s.endLocation,
    })),
  )
  const removeWaypoint = useRouteStore((s) => s.removeWaypoint)
  const markDelivered = useRouteStore((s) => s.markDelivered)
  const setStart = useRouteStore((s) => s.setStart)
  const setEnd = useRouteStore((s) => s.setEnd)

  const active = useMemo(() => waypoints.filter((w) => !w.delivered), [waypoints])

  if (active.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        No active stops. Upload a CSV/JSON file above.
      </p>
    )
  }

  return (
    <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
      {active.map((wp, i) => {
        const isStart = sameCoord(startLocation, wp)
        const isEnd = sameCoord(endLocation, wp)
        return (
          <li key={wp.id} className="flex items-center gap-1.5 px-2 py-2 text-sm">
            <button
              onClick={() => markDelivered(wp.id)}
              title="Mark delivered"
              className="shrink-0 rounded-full border border-slate-300 px-1.5 text-xs text-slate-400 hover:border-emerald-500 hover:text-emerald-600"
            >
              ✓
            </button>
            <span className="min-w-0 flex-1 truncate text-slate-600">
              <span className="mr-1 text-slate-400">{i + 1}.</span>
              {formatLatLng(wp)}
            </span>

            {isStart && (
              <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-700">
                START
              </span>
            )}
            {isEnd && (
              <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-700">
                END
              </span>
            )}
            {!isStart && (
              <button
                onClick={() => setStart({ lat: wp.lat, lng: wp.lng })}
                title="Set as start"
                className="text-[11px] text-slate-400 hover:text-emerald-600"
              >
                start
              </button>
            )}
            {!isEnd && (
              <button
                onClick={() => setEnd({ lat: wp.lat, lng: wp.lng })}
                title="Set as end"
                className="text-[11px] text-slate-400 hover:text-rose-600"
              >
                end
              </button>
            )}
            <button
              onClick={() => removeWaypoint(wp.id)}
              aria-label="Remove stop"
              className="shrink-0 text-slate-300 hover:text-red-500"
            >
              ✕
            </button>
          </li>
        )
      })}
    </ul>
  )
}
