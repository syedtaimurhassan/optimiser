import { useEffect, useMemo } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { Sidebar } from '../components/Sidebar'
import { RouteSheet } from '../components/sheet/RouteSheet'
import { RouteSetupSheet } from '../components/sheet/RouteSetupSheet'
import { MapComponent } from '../components/MapComponent'
import { CalculatingOverlay } from '../components/CalculatingOverlay'
import { CalculateFab } from '../components/CalculateFab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CreateRouteModal } from '../components/routes/CreateRouteModal'
import { DrawerTrigger } from '../components/routes/DrawerTrigger'
import { RouteOverflowSheet } from '../components/routes/RouteOverflowSheet'
import { RoutesDrawer } from '../components/routes/RoutesDrawer'
import { useRoutesStore } from '../store/routesStore'
import { useUiStore } from '../store/uiStore'
import { buildStopPages, pageIndexById } from '../lib/stopPages'

/**
 * The route working screen: map + controls, for the route named in the URL.
 *
 * Serves BOTH `/route/:routeId` and `/route/:routeId/stop/:stopId`, because
 * stop detail is a state of this screen rather than a screen of its own: the
 * map keeps panning behind it, the finish pill stays up, and the sheet holds
 * its height. See the note in routes.tsx for why one component serving two
 * paths is what keeps the map from being rebuilt on every stop.
 *
 * ── The URL is the source of truth ────────────────────────────────────────
 *
 * `selectedStopId` MIRRORS the URL and is never the other way round. That is
 * what makes a deep link, a tapped row, a tapped marker and the peek pill all
 * one code path — they navigate, and everything downstream follows. It also
 * means the map camera comes for free: MapComponent already flies to the
 * selected stop in 400ms, which is exactly the lockstep the carousel wants.
 */
export function RouteWorkScreen() {
  const params = useParams<{ routeId: string; stopId?: string }>()
  const routeId = params.routeId
  const pageId = params.stopId ?? null

  const [, navigate] = useLocation()
  // Keyed on the URL's id, not the active one: during a deep link the active
  // route is still the previous one for a frame, and pages built from it would
  // resolve this URL's stop against the wrong route.
  const route = useRoutesStore((s) => s.routes[routeId] ?? null)
  const exists = route !== null
  const activeRouteId = useRoutesStore((s) => s.activeRouteId)
  const setActiveRoute = useRoutesStore((s) => s.setActiveRoute)
  const setSelectedStopId = useUiStore((s) => s.setSelectedStopId)

  const pages = useMemo(() => (route ? buildStopPages(route) : []), [route])
  const pageIndex = pageIndexById(pages, pageId)
  const page = pageIndex === -1 ? null : pages[pageIndex]

  /**
   * Mirror the open page onto the selection.
   *
   * Only a real stop is a selection: the end page highlights no marker, so
   * writing "end" here would leave `contextualFab` promising to focus a stop
   * that does not exist. The end page moves the camera itself.
   */
  const selectedStopId = page?.kind === 'stop' ? page.id : null
  useEffect(() => {
    setSelectedStopId(selectedStopId)
  }, [selectedStopId, setSelectedStopId])

  // A stop that no longer exists — deleted since the link was shared, or since
  // the back button put it in history. Falling back to the route is better
  // than an empty carousel, and `replace` keeps the dead URL out of history so
  // Back does not walk straight into it again.
  useEffect(() => {
    if (exists && pageId !== null && pageIndex === -1) {
      navigate(`/route/${routeId}`, { replace: true })
    }
  }, [exists, pageId, pageIndex, routeId, navigate])

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

      {/*
        The route sheet — the phone's primary surface, persistent over the map
        at one of four detents. `md:hidden` on the sheet itself.

        Desktop keeps the M1 sidebar column, which is `hidden` below md. The
        two are alternatives, not layers: the sheet is the phone design and the
        sidebar is what desktop has until a milestone gives it its own. The
        legacy panels stay reachable on a phone through the sheet's overflow —
        see RouteSetupSheet.
      */}
      <RouteSheet />
      <Sidebar />
      <RouteSetupSheet />

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
