import type { OptimizedRoute } from '../types'
import { formatLatLng } from '../lib/coordinates'

interface Props {
  route: OptimizedRoute
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h} h ${m} min`
}

/** Textual summary of a computed route: totals + the optimized stop order. */
export function RouteSummary({ route }: Props) {
  return (
    <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3">
      <div className="flex gap-4 text-sm">
        <div>
          <span className="block text-xs text-slate-500">Distance</span>
          <span className="font-semibold text-slate-800">
            {formatDistance(route.distanceMeters)}
          </span>
        </div>
        <div>
          <span className="block text-xs text-slate-500">Duration</span>
          <span className="font-semibold text-slate-800">
            {formatDuration(route.durationSeconds)}
          </span>
        </div>
        <div>
          <span className="block text-xs text-slate-500">Stops</span>
          <span className="font-semibold text-slate-800">
            {route.orderedWaypoints.length}
          </span>
        </div>
      </div>

      <ol className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-slate-600">
        {route.orderedWaypoints.map((p, i) => (
          <li key={`${p.lat},${p.lng},${i}`}>
            <span className="mr-2 font-medium text-blue-600">{i + 1}.</span>
            {formatLatLng(p)}
          </li>
        ))}
      </ol>
    </div>
  )
}
