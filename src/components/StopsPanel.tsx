import { useRouteStore } from '../store/routeStore'
import { CollapsibleSection } from './CollapsibleSection'
import { FileUploader } from './FileUploader'
import { WaypointList } from './WaypointList'

/** Collapsible "Stops" section: upload + the active stop list + clear-all. */
export function StopsPanel() {
  const activeCount = useRouteStore(
    (s) => s.waypoints.filter((w) => !w.delivered).length,
  )
  const clearWaypoints = useRouteStore((s) => s.clearWaypoints)

  return (
    <CollapsibleSection title="Stops" badge={activeCount} defaultOpen>
      <FileUploader />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Active stops</span>
        {activeCount > 0 && (
          <button
            onClick={clearWaypoints}
            className="text-xs text-slate-400 hover:text-red-500"
          >
            clear all
          </button>
        )}
      </div>
      <WaypointList />
    </CollapsibleSection>
  )
}
