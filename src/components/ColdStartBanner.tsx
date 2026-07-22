import { useRouteStore } from '../store/routeStore'

/**
 * One-time cold-start notice. The optimizer (OR-Tools WASM) is fetched lazily
 * after first paint, so on every fresh load there's a short window where it
 * isn't ready yet. This reassures the user it's coming and that they can keep
 * working. Auto-hides the moment the solver is ready; the isolation problem
 * (no SharedArrayBuffer) is surfaced separately as a warning in the header.
 */
export function ColdStartBanner() {
  const solverReady = useRouteStore((s) => s.solverReady)
  const solverWarning = useRouteStore((s) => s.solverWarning)

  if (solverReady || solverWarning) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-500"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
      <span className="flex-1">
        <span className="font-semibold">Preparing the route optimizer…</span> a
        one-time download (~16&nbsp;MB, then cached). You can add stops and set
        your start/end meanwhile — Calculate unlocks automatically.
      </span>
    </div>
  )
}
