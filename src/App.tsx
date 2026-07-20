import { useState } from 'react'
import type { LatLng, OptimizedRoute } from './types'
import { CoordinateForm } from './components/CoordinateForm'
import { FileUploader } from './components/FileUploader'
import { WaypointList } from './components/WaypointList'
import { RouteSummary } from './components/RouteSummary'
import { Itinerary } from './components/Itinerary'
import { MapComponent } from './components/MapComponent'
import { optimizeRoute } from './lib/optimize'

function App() {
  // --- Core route state (lifted here so every panel and the future map share it) ---
  const [startLocation, setStartLocation] = useState<LatLng | null>(null)
  const [endLocation, setEndLocation] = useState<LatLng | null>(null)
  const [waypoints, setWaypoints] = useState<LatLng[]>([])

  // --- Computed route state ---
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const addWaypoints = (points: LatLng[]) =>
    setWaypoints((prev) => [...prev, ...points])
  const removeWaypoint = (index: number) =>
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  const clearWaypoints = () => setWaypoints([])

  const canCalculate = Boolean(startLocation && endLocation)

  // Optimization runs entirely in the browser (see lib/optimize.ts) — instant,
  // no network, no server. `estimated` distances; real roads via Google Maps.
  function handleCalculateRoute() {
    if (!startLocation || !endLocation) return
    setRouteError(null)
    try {
      setOptimizedRoute(optimizeRoute(startLocation, waypoints, endLocation))
    } catch (e) {
      setOptimizedRoute(null)
      setRouteError((e as Error).message)
    }
  }

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

        <section className="space-y-2">
          <button
            onClick={handleCalculateRoute}
            disabled={!canCalculate}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Calculate Route
          </button>
          {!startLocation || !endLocation ? (
            <p className="text-xs text-slate-400">
              Set both a start and an end location to calculate.
            </p>
          ) : null}
          {routeError && <p className="text-xs text-red-500">{routeError}</p>}
          {optimizedRoute && (
            <>
              <RouteSummary route={optimizedRoute} />
              <Itinerary route={optimizedRoute} />
            </>
          )}
        </section>
      </aside>

      {/* ---------------- Interactive Leaflet map ---------------- */}
      <main className="relative flex-1">
        <MapComponent
          startLocation={startLocation}
          endLocation={endLocation}
          waypoints={waypoints}
          optimizedRoute={optimizedRoute}
        />
      </main>
    </div>
  )
}

export default App
