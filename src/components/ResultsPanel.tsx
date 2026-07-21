import { useRouteStore } from '../store/routeStore'
import { RouteSummary } from './RouteSummary'
import { Itinerary } from './Itinerary'

/**
 * Route results: "visiting K of N", totals, and the interactive itinerary.
 * Subscribes only to the computed route (+ candidate count), so it doesn't
 * re-render while a calculation's status is ticking.
 */
export function ResultsPanel() {
  const route = useRouteStore((s) => s.optimizedRoute)

  if (!route) return null

  return (
    <section className="space-y-2">
      <p className="text-xs text-slate-500">
        Visiting {route.candidatesVisited} of {route.candidatesTotal} candidate
        stop{route.candidatesTotal === 1 ? '' : 's'}.
      </p>
      <RouteSummary route={route} />
      <Itinerary route={route} />
    </section>
  )
}
