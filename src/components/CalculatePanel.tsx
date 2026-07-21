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
  const hasStartEnd = useRouteStore((s) => Boolean(s.startLocation && s.endLocation))
  const calculateRoute = useRouteStore((s) => s.calculateRoute)

  const canCalculate = hasStartEnd && !isCalculating

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

      {!hasStartEnd ? (
        <p className="text-xs text-slate-400">
          Set both a start and an end location to calculate.
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
