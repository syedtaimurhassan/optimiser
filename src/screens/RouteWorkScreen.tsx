import { useEffect } from 'react'
import { Link, useParams } from 'wouter'
import { Sidebar } from '../components/Sidebar'
import { MapComponent } from '../components/MapComponent'
import { CalculatingOverlay } from '../components/CalculatingOverlay'
import { CalculateFab } from '../components/CalculateFab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CreateRouteModal } from '../components/routes/CreateRouteModal'
import { DrawerTrigger } from '../components/routes/DrawerTrigger'
import { RouteOverflowSheet } from '../components/routes/RouteOverflowSheet'
import { RoutesDrawer } from '../components/routes/RoutesDrawer'
import { useRoutesStore } from '../store/routesStore'

/**
 * The route working screen: map + controls, for the route named in the URL.
 *
 * The contents are still the app's original single-screen layout — M4 and M5
 * replace them. What M3 adds is that the screen is now genuinely about a
 * specific route: `/route/:routeId` selects it, so a deep link, a bookmark or
 * the back button all land on the right one.
 */
export function RouteWorkScreen() {
  const params = useParams<{ routeId: string }>()
  const routeId = params.routeId

  const exists = useRoutesStore((s) => Boolean(s.routes[routeId]))
  const activeRouteId = useRoutesStore((s) => s.activeRouteId)
  const setActiveRoute = useRoutesStore((s) => s.setActiveRoute)

  // The URL is the source of truth for which route is open. The drawer also
  // sets the active route before navigating, so this is the fallback path —
  // deep links, bookmarks, and the back button.
  useEffect(() => {
    if (exists && activeRouteId !== routeId) setActiveRoute(routeId)
  }, [exists, activeRouteId, routeId, setActiveRoute])

  // A deleted route's URL stays in the address bar and in history. Saying so
  // is better than silently redirecting somewhere else, which would leave
  // someone convinced they had opened the route they asked for.
  if (!exists) return <RouteMissing />

  // One frame while the effect above syncs, on the deep-link path only.
  // Rendering the map first would paint the previously active route's stops
  // under this route's URL.
  if (activeRouteId !== routeId) return <div className="h-[100dvh] bg-surface-variant" />

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100 md:flex-row">
      {/* Map — full-screen on mobile (sheet floats over it); right column on desktop */}
      <main className="relative h-[100dvh] w-full shrink-0 md:order-2 md:h-auto md:w-auto md:flex-1">
        {/*
          The map gets its own boundary because MapLibre fails in ways React
          can't see coming — a malformed geometry or a 0×0 container throws from
          inside an imperative callback, and a device with no usable WebGL
          throws at construction. Without this, one bad polyline would take
          down the sidebar too, removing the very controls the user needs to
          correct the input that caused it.
        */}
        <ErrorBoundary name="map" label="map">
          <MapComponent />
        </ErrorBoundary>
        <CalculatingOverlay />
      </main>

      {/* Sidebar: draggable bottom sheet on mobile, left column on desktop */}
      <Sidebar />

      {/* Calculate FAB — mobile only */}
      <CalculateFab />

      {/* The routes drawer, the control that opens it, and the create/edit
          modal that opens over it. All three portal to the body, so their
          order here is not their stacking order — see each one's zIndex. */}
      <DrawerTrigger />
      <RoutesDrawer />
      <RouteOverflowSheet />
      <CreateRouteModal />
    </div>
  )
}

function RouteMissing() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-surface-variant p-6 text-center">
      <div>
        <h1 className="text-title font-semibold text-on-surface">This route no longer exists</h1>
        <p className="mt-1 text-body text-on-surface-variant">It may have been deleted.</p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-touch items-center rounded-pill bg-primary px-5 text-row font-semibold text-on-primary"
      >
        Go to my routes
      </Link>
    </div>
  )
}
