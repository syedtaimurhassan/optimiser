import { useEffect } from 'react'
import { Redirect } from 'wouter'
import { useRoutesStore } from '../store/routesStore'

/**
 * The app's landing path.
 *
 * There is no separate routes *screen*: the list is a drawer that slides over
 * the route you are working on, so "/" resolves to whichever route is active
 * and the drawer is opened from there. That is Spoke's model, and it is why
 * this file is a redirect rather than a list.
 *
 * M1's placeholder redirected to a hardcoded `CURRENT_ROUTE_ID`; now that real
 * route ids exist, it redirects to the real one.
 */
export function RoutesListScreen() {
  const activeRouteId = useRoutesStore((s) => s.activeRouteId)
  const createRoute = useRoutesStore((s) => s.createRoute)

  // Hydration guarantees an active route, and so does deleteRoute. This is the
  // recovery path if that invariant is ever broken — self-healing rather than
  // a blank screen. It runs in an effect because creating a route during
  // render is a side effect, and React is entitled to call render twice.
  useEffect(() => {
    if (!activeRouteId) createRoute()
  }, [activeRouteId, createRoute])

  if (!activeRouteId) return null

  return <Redirect to={`/route/${activeRouteId}`} replace />
}
