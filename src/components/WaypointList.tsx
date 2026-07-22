import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRouteStore } from '../store/routeStore'
import { formatLatLng } from '../lib/coordinates'
import type { LatLng, Stop } from '../types'

const sameCoord = (a: LatLng | null, b: LatLng) =>
  !!a && a.lat === b.lat && a.lng === b.lng

/** One action item inside a stop's overflow menu. */
function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center rounded-md border px-3 text-xs font-medium transition-colors ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

function StopRow({ stop }: { stop: Stop }) {
  const [open, setOpen] = useState(false)
  const startLocation = useRouteStore((s) => s.startLocation)
  const endLocation = useRouteStore((s) => s.endLocation)
  const setStart = useRouteStore((s) => s.setStart)
  const setEnd = useRouteStore((s) => s.setEnd)
  const markDelivered = useRouteStore((s) => s.markDelivered)
  const removeWaypoint = useRouteStore((s) => s.removeWaypoint)
  // Only this row re-renders when its own hover state flips.
  const isHovered = useRouteStore((s) => s.hoveredStopId === stop.id)
  const setHoveredStopId = useRouteStore((s) => s.setHoveredStopId)

  const isStart = sameCoord(startLocation, stop)
  const isEnd = sameCoord(endLocation, stop)
  const coord = { lat: stop.lat, lng: stop.lng }
  const close = () => setOpen(false)

  return (
    <li
      className={`text-sm transition-colors ${isHovered ? 'bg-blue-50' : ''}`}
      onMouseEnter={() => setHoveredStopId(stop.id)}
      onMouseLeave={() => setHoveredStopId(null)}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="min-w-0 flex-1 truncate text-slate-600">
          <span className="mr-1.5 font-semibold text-slate-400">#{stop.num}</span>
          {formatLatLng(stop)}
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
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Stop actions"
          aria-expanded={open}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded text-lg leading-none ${
            open ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100'
          }`}
        >
          ⋮
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50 px-2 py-2">
          {isStart ? (
            <MenuItem onClick={() => (setStart(null), close())}>Unset start</MenuItem>
          ) : (
            <MenuItem onClick={() => (setStart(coord), close())}>Set as start</MenuItem>
          )}
          {isEnd ? (
            <MenuItem onClick={() => (setEnd(null), close())}>Unset end</MenuItem>
          ) : (
            <MenuItem onClick={() => (setEnd(coord), close())}>Set as end</MenuItem>
          )}
          <MenuItem onClick={() => (markDelivered(stop.id), close())}>
            ✓ Mark delivered
          </MenuItem>
          <MenuItem danger onClick={() => removeWaypoint(stop.id)}>
            Remove
          </MenuItem>
        </div>
      )}
    </li>
  )
}

/** Active (not-yet-delivered) stops. Each row's actions live in a ⋮ overflow
 *  menu that expands inline — keeping the row uncluttered. */
export function WaypointList() {
  const waypoints = useRouteStore(useShallow((s) => s.waypoints))
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
      {active.map((wp) => (
        <StopRow key={wp.id} stop={wp} />
      ))}
    </ul>
  )
}
