import { useRouteStore } from '../store/routeStore'
import { RouteSummary } from './RouteSummary'
import { Itinerary } from './Itinerary'

/**
 * Route results: live progress line, planned totals, and the interactive
 * itinerary. Subscribes to the computed route + a derived delivered count so
 * the progress updates as stops are ticked off.
 */
export function ResultsPanel() {
  const route = useRouteStore((s) => s.optimizedRoute)
  // How many of THIS route's stops are now delivered (primitive -> stable).
  const deliveredInRoute = useRouteStore((s) => {
    if (!s.optimizedRoute) return 0
    const routeKeys = new Set(
      s.optimizedRoute.orderedWaypoints.map((p) => `${p.lat},${p.lng}`),
    )
    return s.waypoints.filter(
      (w) => w.delivered && routeKeys.has(`${w.lat},${w.lng}`),
    ).length
  })

  if (!route) return null

  const remaining = route.candidatesVisited - deliveredInRoute

  return (
    <section className="space-y-2">
      <p className="text-xs text-slate-500">
        Optimized {route.candidatesVisited} of {route.candidatesTotal} stop
        {route.candidatesTotal === 1 ? '' : 's'}.
        {deliveredInRoute > 0 && (
          <span className="font-medium text-emerald-600">
            {' '}
            {deliveredInRoute} delivered · {remaining} to go.
          </span>
        )}
      </p>
      <RouteSummary route={route} />
      <Itinerary route={route} />
    </section>
  )
}
