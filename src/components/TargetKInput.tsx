import { useRouteStore } from '../store/routeStore'

/**
 * Lets the user pick K — how many of the uploaded waypoints to actually visit.
 * Subscribes only to `targetK` and the waypoint count, so typing here re-renders
 * nothing else (not the map, not the itinerary).
 */
export function TargetKInput() {
  const value = useRouteStore((s) => s.targetK)
  const max = useRouteStore((s) => s.waypoints.filter((w) => !w.delivered).length)
  const setTargetK = useRouteStore((s) => s.setTargetK)

  const tooMany = value !== null && max > 0 && value > max

  function handleChange(raw: string) {
    if (raw === '') {
      setTargetK(null)
      return
    }
    const n = parseInt(raw, 10)
    setTargetK(Number.isFinite(n) ? n : null)
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor="target-k"
        className="text-sm font-semibold text-slate-700"
      >
        Stops to visit (K)
      </label>
      <input
        id="target-k"
        type="number"
        min={1}
        max={max || undefined}
        value={value ?? ''}
        disabled={max === 0}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={max === 0 ? 'Upload waypoints first' : `1 – ${max}`}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      <p className={`text-xs ${tooMany ? 'text-red-500' : 'text-slate-400'}`}>
        {max === 0
          ? 'Add waypoints, then choose how many to visit.'
          : tooMany
            ? `Only ${max} waypoints available.`
            : `Choose the best K of ${max} uploaded stops (used when calculating).`}
      </p>
    </div>
  )
}
