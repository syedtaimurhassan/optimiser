import { Sidebar } from '../components/Sidebar'
import { MapComponent } from '../components/MapComponent'
import { CalculatingOverlay } from '../components/CalculatingOverlay'
import { CalculateFab } from '../components/CalculateFab'
import { ErrorBoundary } from '../components/ErrorBoundary'

/**
 * The route working screen: map + controls.
 *
 * This is the app's existing single-screen layout, moved here verbatim as part
 * of introducing the router. Behaviour is unchanged — the only addition is the
 * error boundary around the map subtree.
 */
export function RouteWorkScreen() {
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100 md:flex-row">
      {/* Map — full-screen on mobile (sheet floats over it); right column on desktop */}
      <main className="relative h-[100dvh] w-full shrink-0 md:order-2 md:h-auto md:w-auto md:flex-1">
        {/*
          The map gets its own boundary because Leaflet fails in ways React
          can't see coming — a malformed geometry or a 0×0 container throws from
          inside an imperative callback. Without this, one bad polyline would
          take down the sidebar too, removing the very controls the user needs
          to correct the input that caused it.
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
    </div>
  )
}
