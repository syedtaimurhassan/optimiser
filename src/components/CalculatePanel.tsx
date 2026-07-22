import { useEffect, useRef, useState } from 'react'
import { useRouteStore } from '../store/routeStore'

/** Inline spinner for the loading state. */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  )
}

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
  const pointCount = useRouteStore(
    (s) =>
      s.waypoints.filter((w) => !w.delivered).length +
      (s.startLocation ? 1 : 0) +
      (s.endLocation ? 1 : 0),
  )
  const calculateRoute = useRouteStore((s) => s.calculateRoute)

  const enoughPoints = pointCount >= 2
  const canCalculate = enoughPoints && !isCalculating

  // Flash "Complete!" briefly when a run finishes successfully (UI-only).
  const [justDone, setJustDone] = useState(false)
  const wasCalculating = useRef(false)
  useEffect(() => {
    if (wasCalculating.current && !isCalculating && !routeError) {
      setJustDone(true)
      const id = setTimeout(() => setJustDone(false), 1200)
      wasCalculating.current = isCalculating
      return () => clearTimeout(id)
    }
    wasCalculating.current = isCalculating
  }, [isCalculating, routeError])

  return (
    <section className="space-y-2">
      <button
        onClick={calculateRoute}
        disabled={!canCalculate}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${
          isCalculating
            ? 'bg-blue-500'
            : justDone
              ? 'bg-emerald-600'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
        }`}
      >
        {isCalculating ? (
          <>
            <Spinner />
            {calcStatus ?? 'Calculating…'}
          </>
        ) : justDone ? (
          '✓ Complete!'
        ) : (
          'Calculate Route'
        )}
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
