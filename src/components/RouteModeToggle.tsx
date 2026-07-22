import { useRouteStore } from '../store/routeStore'

/**
 * Explicit choice between a fixed-endpoint route (you pick the start/end) and an
 * open route (the optimizer picks the best endpoints among your stops).
 * Switching to "Open" releases any fixed anchors; the routing logic already
 * treats null start/end as an open route.
 */
export function RouteModeToggle() {
  const routeMode = useRouteStore((s) => s.routeMode)
  const setRouteMode = useRouteStore((s) => s.setRouteMode)

  const opts = [
    { key: 'fixed' as const, label: 'Fixed ends', hint: 'You set start / end' },
    { key: 'open' as const, label: 'Open route', hint: 'Optimizer picks ends' },
  ]

  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">Route type</span>
      <div className="flex rounded-md border border-slate-300 p-0.5">
        {opts.map((o) => {
          const active = routeMode === o.key
          return (
            <button
              key={o.key}
              onClick={() => setRouteMode(o.key)}
              aria-pressed={active}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded px-2 py-1 text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{o.label}</span>
              <span className={`text-[10px] font-normal ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                {o.hint}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
