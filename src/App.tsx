import { useState } from 'react'
import type { LatLng } from './types'
import { CoordinateForm } from './components/CoordinateForm'
import { FileUploader } from './components/FileUploader'
import { WaypointList } from './components/WaypointList'

function App() {
  // --- Core route state (lifted here so every panel and the future map share it) ---
  const [startLocation, setStartLocation] = useState<LatLng | null>(null)
  const [endLocation, setEndLocation] = useState<LatLng | null>(null)
  const [waypoints, setWaypoints] = useState<LatLng[]>([])

  const addWaypoints = (points: LatLng[]) =>
    setWaypoints((prev) => [...prev, ...points])
  const removeWaypoint = (index: number) =>
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  const clearWaypoints = () => setWaypoints([])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* ---------------- Sidebar: inputs + lists ---------------- */}
      <aside className="flex w-96 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-5">
        <header>
          <h1 className="text-xl font-bold text-slate-800">Route Optimiser</h1>
          <p className="text-sm text-slate-500">
            Set a start &amp; end, then add intermediate stops.
          </p>
        </header>

        <section className="space-y-4">
          <CoordinateForm
            label="Start"
            value={startLocation}
            onChange={setStartLocation}
            accentClass="bg-emerald-600"
          />
          <CoordinateForm
            label="End"
            value={endLocation}
            onChange={setEndLocation}
            accentClass="bg-rose-600"
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Upload waypoints
          </h2>
          <FileUploader onWaypointsParsed={addWaypoints} />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Waypoints ({waypoints.length})
            </h2>
            {waypoints.length > 0 && (
              <button
                onClick={clearWaypoints}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                clear all
              </button>
            )}
          </div>
          <WaypointList waypoints={waypoints} onRemove={removeWaypoint} />
        </section>
      </aside>

      {/* ---------------- Map placeholder (Leaflet mounts here in M3) ---------------- */}
      <main className="relative flex-1">
        <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
          <div className="text-center">
            <p className="text-lg font-medium">Map goes here</p>
            <p className="text-sm">Milestone 3 will mount the Leaflet map.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
