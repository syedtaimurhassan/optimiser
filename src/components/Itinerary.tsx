import { useMemo, useState } from 'react'
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

interface RowProps {
  p: LatLng
  seq: number
  isStop: boolean
  isCurrent: boolean
  isLast: boolean
  num: number | undefined
  stopId: string | undefined
}

/** One itinerary row. Owns its hover-sync subscription (so only this row
 *  re-renders on hover) and its own slide-out animation when delivered. */
function ItineraryRow({ p, seq, isStop, isCurrent, isLast, num, stopId }: RowProps) {
  const markDone = useRouteStore((s) => s.markDeliveredByCoord)
  const setHoveredStopId = useRouteStore((s) => s.setHoveredStopId)
  const isHovered = useRouteStore((s) => stopId != null && s.hoveredStopId === stopId)
  const [leaving, setLeaving] = useState(false)

  const color = isCurrent ? '#059669' : isLast ? '#e11d48' : '#2563eb'
  const role = isCurrent ? 'Next' : isLast ? 'Last' : 'Stop'

  // Animate the row out, then commit the delivery once it has slid away.
  function deliver() {
    if (leaving) return
    setLeaving(true)
    setHoveredStopId(null)
    setTimeout(() => markDone(p.lat, p.lng), 280)
  }

  return (
    <li
      onMouseEnter={() => stopId && setHoveredStopId(stopId)}
      onMouseLeave={() => stopId && setHoveredStopId(null)}
      className={`flex items-center gap-2 overflow-hidden px-2 text-sm transition-all duration-300 ease-in-out ${
        leaving
          ? 'max-h-0 -translate-x-8 py-0 opacity-0'
          : `max-h-24 py-2 ${isHovered ? 'bg-blue-50' : ''}`
      }`}
    >
      {isStop ? (
        <button
          onClick={deliver}
          title="Mark delivered"
          aria-label={`Mark stop #${num} delivered`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-emerald-600"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] text-transparent hover:border-emerald-500 hover:text-emerald-500">
            ✓
          </span>
        </button>
      ) : (
        <span
          title="Reference point (not a stop)"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-300"
        >
          ⚑
        </span>
      )}
      <StopBadge label={String(seq)} color={color} />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-slate-700">
          {role}
          {num !== undefined && (
            <span className="ml-1.5 font-semibold text-slate-400">#{num}</span>
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
        className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-slate-300 px-3 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
      >
        Maps ↗
      </a>
    </li>
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

  const { deliveredKeys, stopKeys, numByKey, idByKey } = useMemo(() => {
    const delivered = new Set<string>()
    const all = new Set<string>()
    const nums = new Map<string, number>()
    const ids = new Map<string, string>()
    for (const w of waypoints) {
      all.add(key(w))
      nums.set(key(w), w.num)
      ids.set(key(w), w.id)
      if (w.delivered) delivered.add(key(w))
    }
    return { deliveredKeys: delivered, stopKeys: all, numByKey: nums, idByKey: ids }
  }, [waypoints])

  // Remaining = ordered stops still to visit, each keeping its ORIGINAL route
  // position (`seq`) so numbers never renumber when a stop is delivered/removed.
  // Delivered stops and stops removed since are dropped; manual anchors stay.
  const remaining = useMemo(
    () =>
      route.orderedWaypoints
        .map((p, idx) => ({ p, seq: idx + 1, isStop: stopKeys.has(key(p)) }))
        .filter(({ p, isStop }) =>
          isStop
            ? !deliveredKeys.has(key(p))
            : sameCoord(startLocation, p) || sameCoord(endLocation, p),
        ),
    [route, stopKeys, deliveredKeys, startLocation, endLocation],
  )

  const deliverableRemaining = remaining.filter((e) => e.isStop).length
  const batches =
    remaining.length >= 2
      ? googleMapsDirectionsBatches(remaining.map((e) => e.p))
      : []

  const linkBtn =
    'flex min-h-[44px] items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700'

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
        {remaining.map(({ p, seq, isStop }, ri) => (
          // Badge number = stable original route position. Color/role reflect the
          // CURRENT progress: the first remaining stop is your next target (green),
          // the last remaining is the final one (red).
          <ItineraryRow
            key={key(p)}
            p={p}
            seq={seq}
            isStop={isStop}
            isCurrent={ri === 0}
            isLast={ri === remaining.length - 1}
            num={numByKey.get(key(p))}
            stopId={isStop ? idByKey.get(key(p)) : undefined}
          />
        ))}
      </ol>
    </div>
  )
}
