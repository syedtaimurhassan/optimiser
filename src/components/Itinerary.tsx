import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { LatLng, OptimizedRoute } from '../types'
import { formatLatLng } from '../lib/coordinates'
import { useRouteStore } from '../store/routeStore'
import {
  googleMapsSearchUrl,
  googleMapsDirectionsBatches,
} from '../lib/googleMaps'

interface Props {
  route: OptimizedRoute
}

const key = (p: LatLng) => `${p.lat},${p.lng}`
const sameCoord = (a: LatLng | null, b: LatLng) =>
  !!a && a.lat === b.lat && a.lng === b.lng

/** Small colored badge showing the stop's stable number (or S/E for anchors). */
function StopBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
      style={{ background: color }}
    >
      {label}
    </span>
  )
}

/**
 * Live itinerary: the remaining route, DERIVED from the computed order minus
 * whatever's been marked delivered (and minus stops removed since). Ticking a
 * stop makes it vanish and recomputes the Google Maps legs; restoring it (from
 * the Delivered section) brings it back — all with no recalculation.
 */
export function Itinerary({ route }: Props) {
  const { waypoints, startLocation, endLocation } = useRouteStore(
    useShallow((s) => ({
      waypoints: s.waypoints,
      startLocation: s.startLocation,
      endLocation: s.endLocation,
    })),
  )
  const markDone = useRouteStore((s) => s.markDeliveredByCoord)

  const { deliveredKeys, stopKeys, numByKey } = useMemo(() => {
    const delivered = new Set<string>()
    const all = new Set<string>()
    const nums = new Map<string, number>()
    for (const w of waypoints) {
      all.add(key(w))
      nums.set(key(w), w.num)
      if (w.delivered) delivered.add(key(w))
    }
    return { deliveredKeys: delivered, stopKeys: all, numByKey: nums }
  }, [waypoints])

  // Remaining = ordered stops still to visit: drop delivered stops and any stop
  // that was removed since; keep manual start/end anchors.
  const remaining = useMemo(
    () =>
      route.orderedWaypoints.filter((p) => {
        const k = key(p)
        if (stopKeys.has(k)) return !deliveredKeys.has(k)
        return sameCoord(startLocation, p) || sameCoord(endLocation, p)
      }),
    [route, stopKeys, deliveredKeys, startLocation, endLocation],
  )

  const deliverableRemaining = remaining.filter((p) => stopKeys.has(key(p))).length
  const batches = remaining.length >= 2 ? googleMapsDirectionsBatches(remaining) : []

  const linkBtn =
    'block rounded-md bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700'

  // Everything the route had to collect is done.
  if (route.candidatesTotal > 0 && deliverableRemaining === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">
        ✓ All stops delivered. Restore any from the Delivered section to bring
        them back.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* --- Navigate what's left --- */}
      {batches.length > 0 && (
        <div className="space-y-1.5">
          {batches.length === 1 ? (
            <a href={batches[0].url} target="_blank" rel="noopener noreferrer" className={linkBtn}>
              Navigate Remaining Route in Google Maps
            </a>
          ) : (
            <>
              <p className="text-xs text-amber-600">
                {remaining.length} stops exceed Google Maps’ limit — split into{' '}
                {batches.length} legs (in order):
              </p>
              {batches.map((b, i) => (
                <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                  Navigate Leg {i + 1} of {batches.length}
                </a>
              ))}
            </>
          )}
        </div>
      )}

      {/* --- Remaining stops --- */}
      <ol className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
        {remaining.map((p, i) => {
          const isStop = stopKeys.has(key(p))
          const isFirst = i === 0
          const isLast = i === remaining.length - 1
          const color = isFirst ? '#059669' : isLast ? '#e11d48' : '#2563eb'
          const num = numByKey.get(key(p))
          // Badge = visiting order (this list is sorted in the order you drive).
          // The stable stop identity (#num) is shown beside the role.
          const role = isFirst ? 'Start' : isLast ? 'End' : 'Stop'

          return (
            <li key={key(p)} className="flex items-center gap-2 px-2 py-2 text-sm">
              {isStop ? (
                <button
                  onClick={() => markDone(p.lat, p.lng)}
                  title="Mark delivered"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[11px] text-transparent hover:border-emerald-500 hover:text-emerald-500"
                >
                  ✓
                </button>
              ) : (
                <span
                  title="Reference point (not a stop)"
                  className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-300"
                >
                  ⚑
                </span>
              )}
              <StopBadge label={String(i + 1)} color={color} />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-700">
                  {role}
                  {num !== undefined && (
                    <span className="ml-1.5 font-semibold text-slate-400">
                      #{num}
                    </span>
                  )}
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
