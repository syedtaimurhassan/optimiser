import { useRouteStore } from '../store/routeStore'

/** Spinner shown inside the FAB while a route is computing. */
function Spinner() {
  return (
    <svg className="h-5 w-5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

/**
 * Mobile-only floating action button for Calculate. On phones the sidebar is a
 * bottom sheet (which may be collapsed), so the primary action floats above
 * everything at bottom-right. Hidden at md+, where the pinned footer button in
 * the sidebar takes over. Mirrors the enable/loading logic of CalculatePanel.
 */
export function CalculateFab() {
  const isCalculating = useRouteStore((s) => s.isCalculating)
  const calculateRoute = useRouteStore((s) => s.calculateRoute)
  const pointCount = useRouteStore(
    (s) =>
      s.waypoints.filter((w) => !w.delivered).length +
      (s.startLocation ? 1 : 0) +
      (s.endLocation ? 1 : 0),
  )

  const canCalculate = pointCount >= 2 && !isCalculating

  return (
    <button
      onClick={calculateRoute}
      disabled={!canCalculate}
      aria-label={isCalculating ? 'Calculating route' : 'Calculate route'}
      className={`fixed bottom-6 right-6 z-[1600] flex min-h-[44px] items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors md:hidden disabled:cursor-not-allowed ${
        isCalculating ? 'bg-blue-500' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400/80'
      }`}
    >
      {isCalculating ? (
        <Spinner />
      ) : (
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 17h4l3-10 3 14 3-8h3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {isCalculating ? 'Optimizing…' : 'Calculate'}
    </button>
  )
}
