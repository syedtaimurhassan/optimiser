import { useEffect } from 'react'
import { HeaderPanel } from './components/HeaderPanel'
import { StopsPanel } from './components/StopsPanel'
import { DeliveredPanel } from './components/DeliveredPanel'
import { RouteSetupPanel } from './components/RouteSetupPanel'
import { CalculatePanel } from './components/CalculatePanel'
import { ResultsPanel } from './components/ResultsPanel'
import { FavoritesPanel } from './components/FavoritesPanel'
import { MapComponent } from './components/MapComponent'
import { useRouteStore } from './store/routeStore'

/**
 * Responsive layout shell. Subscribes to no reactive state (only the stable
 * warm-up action), so it renders once. On phones it stacks (map on top, sidebar
 * below); on md+ it's side-by-side. The Calculate bar is pinned to the bottom of
 * the sidebar so it's always reachable no matter how long the list gets.
 */
function App() {
  const warmUp = useRouteStore((s) => s.warmUp)

  useEffect(() => {
    const id = setTimeout(() => warmUp(), 3000)
    return () => clearTimeout(id)
  }, [warmUp])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 md:flex-row">
      {/* Map — top on mobile (fixed height), right and full-height on desktop */}
      <main className="relative h-[40vh] w-full shrink-0 md:order-2 md:h-auto md:w-auto md:flex-1">
        <MapComponent />
      </main>

      {/* Sidebar — below on mobile (scrolls), left on desktop */}
      <aside className="flex min-h-0 w-full flex-1 flex-col border-t border-slate-200 bg-white md:order-1 md:w-96 md:flex-none md:border-r md:border-t-0">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <HeaderPanel />
          <StopsPanel />
          <DeliveredPanel />
          <RouteSetupPanel />
          <ResultsPanel />
          <FavoritesPanel />
        </div>

        {/* Pinned action bar — always visible */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
          <CalculatePanel />
        </div>
      </aside>
    </div>
  )
}

export default App
