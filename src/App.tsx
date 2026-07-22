import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { MapComponent } from './components/MapComponent'
import { CalculatingOverlay } from './components/CalculatingOverlay'
import { CalculateFab } from './components/CalculateFab'
import { useRouteStore } from './store/routeStore'

/**
 * Responsive layout shell. Subscribes to no reactive state (only the stable
 * warm-up action), so it renders once. On phones the map fills the screen and
 * the sidebar is a draggable bottom sheet with a Calculate FAB; on md+ it's the
 * classic side-by-side with the sidebar's pinned Calculate footer.
 */
function App() {
  const warmUp = useRouteStore((s) => s.warmUp)

  useEffect(() => {
    const id = setTimeout(() => warmUp(), 3000)
    return () => clearTimeout(id)
  }, [warmUp])

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100 md:flex-row">
      {/* Map — full-screen on mobile (sheet floats over it); right column on desktop */}
      <main className="relative h-[100dvh] w-full shrink-0 md:order-2 md:h-auto md:w-auto md:flex-1">
        <MapComponent />
        <CalculatingOverlay />
      </main>

      {/* Sidebar: draggable bottom sheet on mobile, left column on desktop */}
      <Sidebar />

      {/* Calculate FAB — mobile only */}
      <CalculateFab />
    </div>
  )
}

export default App
