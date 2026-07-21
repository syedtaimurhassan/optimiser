import { useRouteStore } from '../store/routeStore'

/** App title, "Start over" (when there's a session), the saved note, and the
 *  optimizer isolation warning. */
export function HeaderPanel() {
  const hasSession = useRouteStore((s) =>
    Boolean(
      s.startLocation || s.endLocation || s.waypoints.length > 0 || s.optimizedRoute,
    ),
  )
  const resetAll = useRouteStore((s) => s.resetAll)
  const solverWarning = useRouteStore((s) => s.solverWarning)

  return (
    <>
      <header>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-bold text-slate-800">Route Optimiser</h1>
          {hasSession && (
            <button
              onClick={resetAll}
              className="mt-1 text-xs text-slate-400 hover:text-red-500"
            >
              Start over
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Set a start &amp; end, then add intermediate stops.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Auto-saved on this device — safe to close &amp; reopen.
        </p>
      </header>

      {solverWarning && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700">
          ⚠️ {solverWarning}
        </div>
      )}
    </>
  )
}
