import { useRouteStore } from '../store/routeStore'
import { formatLatLng } from '../lib/coordinates'

/** Scrollable, removable list of the current intermediate waypoints. */
export function WaypointList() {
  const waypoints = useRouteStore((s) => s.waypoints)
  const onRemove = useRouteStore((s) => s.removeWaypoint)

  if (waypoints.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        No waypoints yet. Upload a CSV or JSON file above.
      </p>
    )
  }

  return (
    <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
      {waypoints.map((wp, i) => (
        <li
          key={`${wp.lat},${wp.lng},${i}`}
          className="flex items-center justify-between px-3 py-2 text-sm"
        >
          <span className="text-slate-600">
            <span className="mr-2 text-slate-400">{i + 1}.</span>
            {formatLatLng(wp)}
          </span>
          <button
            onClick={() => onRemove(i)}
            aria-label={`Remove waypoint ${i + 1}`}
            className="text-slate-300 hover:text-red-500"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
