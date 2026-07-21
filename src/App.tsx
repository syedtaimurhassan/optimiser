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
 * Pure layout shell. It subscribes to no reactive state (only the stable warm-up
 * action), so it renders once and never re-renders — every update happens inside
 * the individual store-connected panels below.
 */
function App() {
  const warmUp = useRouteStore((s) => s.warmUp)

  useEffect(() => {
    const id = setTimeout(() => warmUp(), 3000)
    return () => clearTimeout(id)
  }, [warmUp])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* ---------------- Sidebar: collapsible sections ---------------- */}
      <aside className="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-white p-4">
        <HeaderPanel />
        <StopsPanel />
        <DeliveredPanel />
        <RouteSetupPanel />
        <CalculatePanel />
        <ResultsPanel />
        <FavoritesPanel />
      </aside>

      {/* ---------------- Interactive Leaflet map ---------------- */}
      <main className="relative flex-1">
        <MapComponent />
      </main>
    </div>
  )
}

export default App
