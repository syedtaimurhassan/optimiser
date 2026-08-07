import { Redirect } from 'wouter'
import { CURRENT_ROUTE_ID } from '../routeIds'

/**
 * The routes list — a Spoke-style "your days" index. Arrives in M2, when the
 * data model actually supports more than one route.
 *
 * Until then this redirects straight to the working screen. There is exactly one
 * implicit session, so showing a list of it would be both a lie and a
 * regression: M1 is infrastructure, and the app must land where it always did.
 *
 * M2 replaces this whole component with the real list.
 */
export function RoutesListScreen() {
  return <Redirect to={`/route/${CURRENT_ROUTE_ID}`} replace />
}
