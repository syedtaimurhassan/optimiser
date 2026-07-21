import { useMemo } from 'react'
import type { OptimizedRoute } from '../types'
import { formatLatLng } from '../lib/coordinates'
import { useRouteStore } from '../store/routeStore'
import {
  googleMapsSearchUrl,
  googleMapsDirectionsBatches,
} from '../lib/googleMaps'

interface Props {
  route: OptimizedRoute
}

const key = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`

/** Small colored index badge matching the map markers (green/blue/red). */
function StopBadge({ n, color }: { n: number; color: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: color }}
    >
      {n}
    </span>
  )
}

/** Interactive itinerary: ordered stops + Google Maps handoff links. */
export function Itinerary({ route }: Props) {
  const stops = route.orderedWaypoints
  const batches = googleMapsDirectionsBatches(stops)

  // Live "delivered" state so ticking off a stop strikes it through immediately.
  const waypoints = useRouteStore((s) => s.waypoints)
  const markDone = useRouteStore((s) => s.markDeliveredByCoord)
  const deliveredKeys = useMemo(
    () => new Set(waypoints.filter((w) => w.delivered).map(key)),
    [waypoints],
  )

  const linkBtn =
    'block rounded-md bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700'

  return (
    <div className="space-y-3">
      {/* --- Navigate the whole route --- */}
      <div className="space-y-1.5">
        {batches.length === 1 ? (
          <a
            href={batches[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkBtn}
          >
            Navigate Entire Route in Google Maps
          </a>
        ) : (
          <>
            <p className="text-xs text-amber-600">
              {stops.length - 2} waypoints exceed Google Maps’ limit — split into{' '}
              {batches.length} legs:
            </p>
            {batches.map((b, i) => (
              <a
                key={i}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkBtn}
              >
                Navigate Part {i + 1} of {batches.length} (stops {b.fromIndex + 1}–
                {b.toIndex + 1})
              </a>
            ))}
          </>
        )}
      </div>

      {/* --- Ordered list of individual stops --- */}
      <ol className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
        {stops.map((p, i) => {
          const isStart = i === 0
          const isEnd = i === stops.length - 1
          const color = isStart ? '#059669' : isEnd ? '#e11d48' : '#2563eb'
          const label = isStart ? 'Start' : isEnd ? 'End' : `Stop ${i + 1}`

          const done = deliveredKeys.has(key(p))
          return (
            <li
              key={`${p.lat},${p.lng},${i}`}
              className="flex items-center gap-2 px-2 py-2 text-sm"
            >
              <button
                onClick={() => markDone(p.lat, p.lng)}
                disabled={done}
                title={done ? 'Delivered' : 'Mark delivered'}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500'
                }`}
              >
                ✓
              </button>
              <StopBadge n={i + 1} color={done ? '#94a3b8' : color} />
              <span className="min-w-0 flex-1">
                <span
                  className={`font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                >
                  {label}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {formatLatLng(p)}
                </span>
              </span>
              <a
                href={googleMapsSearchUrl(p)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
              >
                Maps ↗
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
