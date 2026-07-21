import { useRouteStore } from '../store/routeStore'

/**
 * The Calculate button + live status/error. Subscribes only to the calculation
 * status slices, so the frequent status ticks during a run never re-render the
 * map or the results/itinerary.
 */
export function CalculatePanel() {
  const isCalculating = useRouteStore((s) => s.isCalculating)
  const calcStatus = useRouteStore((s) => s.calcStatus)
  const routeError = useRouteStore((s) => s.routeError)
  const solverReady = useRouteStore((s) => s.solverReady)
  // A route needs at least 2 distinct points; start/end are optional now.
  // Delivered stops don't count — they're done.
  const pointCount = useRouteStore(
    (s) =>
      s.waypoints.filter((w) => !w.delivered).length +
      (s.startLocation ? 1 : 0) +
      (s.endLocation ? 1 : 0),
  )
  const calculateRoute = useRouteStore((s) => s.calculateRoute)

  const enoughPoints = pointCount >= 2
  const canCalculate = enoughPoints && !isCalculating

  return (
    <section className="space-y-2">
      <button
        onClick={calculateRoute}
        disabled={!canCalculate}
        className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${
          isCalculating
            ? 'animate-pulse bg-blue-500'
            : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
        }`}
      >
        {isCalculating ? (calcStatus ?? 'Calculating…') : 'Calculate Route'}
      </button>

      {!enoughPoints ? (
        <p className="text-xs text-slate-400">
          Add at least 2 points — upload a file, or set a start/end. Start &amp;
          end are optional.
        </p>
      ) : !isCalculating && !solverReady ? (
        <p className="text-xs text-slate-400">
          Preparing optimizer (one-time download)…
        </p>
      ) : null}

      {routeError && <p className="text-xs text-red-500">{routeError}</p>}
    </section>
  )
}
