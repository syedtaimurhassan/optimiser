import { useMemo } from 'react'
import { useRouteStore } from '../store/routeStore'
import { CollapsibleSection } from './CollapsibleSection'
import { formatLatLng } from '../lib/coordinates'

/** Collapsible list of delivered/done stops, each restorable to the active list.
 *  Renders nothing until at least one stop is delivered. */
export function DeliveredPanel() {
  const waypoints = useRouteStore((s) => s.waypoints)
  const restoreStop = useRouteStore((s) => s.restoreStop)
  const restoreAll = useRouteStore((s) => s.restoreAll)

  const delivered = useMemo(
    () => waypoints.filter((w) => w.delivered),
    [waypoints],
  )
  if (delivered.length === 0) return null

  return (
    <CollapsibleSection title="Delivered" badge={delivered.length}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Done stops — excluded from routing.
        </span>
        <button
          onClick={restoreAll}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          ↩ Restore all
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {delivered.map((wp) => (
          <li key={wp.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-400 line-through">
              {formatLatLng(wp)}
            </span>
            <button
              onClick={() => restoreStop(wp.id)}
              title="Put back on the active list"
              className="shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
            >
              ↩ Restore
            </button>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  )
}
