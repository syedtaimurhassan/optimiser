import { useEffect } from 'react'
import { HeaderPanel } from './components/HeaderPanel'
import { CoordinateForm } from './components/CoordinateForm'
import { FileUploader } from './components/FileUploader'
import { WaypointsPanel } from './components/WaypointsPanel'
import { TargetKInput } from './components/TargetKInput'
import { CalculatePanel } from './components/CalculatePanel'
import { ResultsPanel } from './components/ResultsPanel'
import { MapComponent } from './components/MapComponent'
import { useRouteStore } from './store/routeStore'

/**
 * Pure layout shell. It subscribes to no reactive state (only the stable warm-up
 * action), so it renders once and never re-renders — every update happens inside
 * the individual store-connected panels below.
 */
function App() {
  const warmUp = useRouteStore((s) => s.warmUp)

  // Preload the OR-Tools WASM shortly after load, once the coi service worker
  // has had time to make the page cross-origin isolated.
  useEffect(() => {
    const id = setTimeout(() => warmUp(), 3000)
    return () => clearTimeout(id)
  }, [warmUp])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* ---------------- Sidebar: inputs + lists ---------------- */}
      <aside className="flex w-96 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-5">
        <HeaderPanel />

        <section className="space-y-4">
          <CoordinateForm field="start" label="Start" accentClass="bg-emerald-600" />
          <CoordinateForm field="end" label="End" accentClass="bg-rose-600" />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Upload waypoints</h2>
          <FileUploader />
        </section>

        <WaypointsPanel />

        <section className="space-y-2">
          <TargetKInput />
        </section>

        <CalculatePanel />
        <ResultsPanel />
      </aside>

      {/* ---------------- Interactive Leaflet map ---------------- */}
      <main className="relative flex-1">
        <MapComponent />
      </main>
    </div>
  )
}

export default App
