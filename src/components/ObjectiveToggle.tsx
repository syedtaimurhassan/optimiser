import { useRouteStore } from '../store/routeStore'

/** "Optimize for: Time / Distance" — sets which cost matrix the optimizer uses. */
export function ObjectiveToggle() {
  const objective = useRouteStore((s) => s.objective)
  const setObjective = useRouteStore((s) => s.setObjective)

  const opts = [
    { key: 'duration' as const, label: 'Time' },
    { key: 'distance' as const, label: 'Distance' },
  ]

  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">Optimize for</span>
      <div className="flex rounded-md border border-slate-300 p-0.5">
        {opts.map((o) => (
          <button
            key={o.key}
            onClick={() => setObjective(o.key)}
            className={`flex-1 rounded px-3 py-1 text-sm font-medium transition-colors ${
              objective === o.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
