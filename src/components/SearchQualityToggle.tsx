import { useRouteStore, type SearchQuality } from '../store/routeStore'

/**
 * "Search quality" — how long the multi-start optimizer may search before
 * returning. Higher tiers explore more restarts (better routes on hard, clustered
 * inputs) at the cost of a longer wait. It's a ceiling: easy inputs converge and
 * return early regardless of tier.
 */
export function SearchQualityToggle() {
  const searchQuality = useRouteStore((s) => s.searchQuality)
  const setSearchQuality = useRouteStore((s) => s.setSearchQuality)

  const opts: { key: SearchQuality; label: string; hint: string }[] = [
    { key: 'fast', label: 'Fast', hint: '~1s' },
    { key: 'deep', label: 'Deep', hint: '~3s' },
    { key: 'maximum', label: 'Maximum', hint: '~5s' },
  ]

  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">Search quality</span>
      <div className="flex rounded-md border border-slate-300 p-0.5">
        {opts.map((o) => {
          const active = searchQuality === o.key
          return (
            <button
              key={o.key}
              onClick={() => setSearchQuality(o.key)}
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
      <p className="text-xs text-slate-400">
        Higher effort finds better routes on large, clustered sets — but takes
        longer. Simple routes finish early either way.
      </p>
    </div>
  )
}
