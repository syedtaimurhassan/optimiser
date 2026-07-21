import { useRouteStore } from '../store/routeStore'
import { WaypointList } from './WaypointList'

/** Waypoints section: count header + clear-all + the removable list. */
export function WaypointsPanel() {
  const count = useRouteStore((s) => s.waypoints.length)
  const clearWaypoints = useRouteStore((s) => s.clearWaypoints)

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Waypoints ({count})
        </h2>
        {count > 0 && (
          <button
            onClick={clearWaypoints}
            className="text-xs text-slate-400 hover:text-red-500"
          >
            clear all
          </button>
        )}
      </div>
      <WaypointList />
    </section>
  )
}
