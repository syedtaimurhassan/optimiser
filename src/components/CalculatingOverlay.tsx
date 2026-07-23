import { useRouteStore } from '../store/routeStore'

/**
 * Frosted-glass overlay shown over the map while a route is being computed.
 * Blocks map interaction during the run and surfaces the live status text, so
 * the map area reflects the same progress as the Calculate button.
 */
export function CalculatingOverlay() {
  const isCalculating = useRouteStore((s) => s.isCalculating)
  const calcStatus = useRouteStore((s) => s.calcStatus)

  if (!isCalculating) return null

  return (
    <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-white/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/85 px-5 py-4 shadow-lg">
        <svg
          className="h-6 w-6 shrink-0 animate-spin text-blue-600"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-800">{calcStatus ?? 'Optimizing route…'}</p>
          <p className="text-xs text-slate-500">
            Exploring route options to avoid a sub-optimal result — this can take
            a few seconds.
          </p>
        </div>
      </div>
    </div>
  )
}
