import { useState, useEffect, useMemo } from 'react'
import type { LatLng, OptimizedRoute } from './types'
import { CoordinateForm } from './components/CoordinateForm'
import { FileUploader } from './components/FileUploader'
import { WaypointList } from './components/WaypointList'
import { TargetKInput } from './components/TargetKInput'
import { RouteSummary } from './components/RouteSummary'
import { Itinerary } from './components/Itinerary'
import { MapComponent } from './components/MapComponent'
import { planSelectiveRoute } from './lib/planRoute'
import { warmUpSolver } from './lib/solver'
import { loadState, saveState, clearState } from './lib/storage'

function App() {
  // Restore any session saved on this device (once, on mount).
  const saved = useMemo(() => loadState(), [])

  // --- Core route state (lifted here so every panel and the map share it) ---
  const [startLocation, setStartLocation] = useState<LatLng | null>(
    saved.startLocation ?? null,
  )
  const [endLocation, setEndLocation] = useState<LatLng | null>(
    saved.endLocation ?? null,
  )
  const [waypoints, setWaypoints] = useState<LatLng[]>(saved.waypoints ?? [])

  // --- Selective-TSP target: how many of the waypoints to actually visit ---
  const [targetK, setTargetK] = useState<number | null>(saved.targetK ?? null)

  // --- Computed route state (route is persisted too, so the map restores) ---
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(
    saved.optimizedRoute ?? null,
  )
  const [routeError, setRouteError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calcStatus, setCalcStatus] = useState<string | null>(null)
  const [solverReady, setSolverReady] = useState(false)
  const [solverWarning, setSolverWarning] = useState<string | null>(null)

  // Preload the ~16 MB OR-Tools WASM in the background so the first "Calculate"
  // isn't stuck waiting on the download. It needs cross-origin isolation
  // (provided by the coi service worker, which reloads the page once on first
  // visit). We wait a few seconds for that, then either warm up or, if the
  // browser never isolated (e.g. lacks COEP credentialless), warn clearly.
  useEffect(() => {
    const id = setTimeout(() => {
      if (window.crossOriginIsolated) {
        warmUpSolver()
          .then(() => setSolverReady(true))
          .catch((e) => setSolverWarning((e as Error).message))
      } else {
        setSolverWarning(
          'This browser did not enable the isolation the optimizer needs ' +
            '(SharedArrayBuffer). Please use the latest Chrome or Edge.',
        )
      }
    }, 3000)
    return () => clearTimeout(id)
  }, [])

  // Persist the session to this device whenever any saved field changes.
  // When there's nothing meaningful to keep, clear storage instead of writing
  // an empty record (so "Start over" fully wipes the saved session).
  useEffect(() => {
    const isEmpty =
      !startLocation && !endLocation && waypoints.length === 0 && !optimizedRoute
    if (isEmpty) {
      clearState()
    } else {
      saveState({ startLocation, endLocation, waypoints, targetK, optimizedRoute })
    }
  }, [startLocation, endLocation, waypoints, targetK, optimizedRoute])

  const addWaypoints = (points: LatLng[]) =>
    setWaypoints((prev) => [...prev, ...points])
  const removeWaypoint = (index: number) =>
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  const clearWaypoints = () => setWaypoints([])

  function handleResetAll() {
    // The persistence effect clears storage once state becomes empty.
    setStartLocation(null)
    setEndLocation(null)
    setWaypoints([])
    setTargetK(null)
    setOptimizedRoute(null)
    setRouteError(null)
  }

  const hasSession = Boolean(
    startLocation || endLocation || waypoints.length > 0 || optimizedRoute,
  )
  const canCalculate = Boolean(startLocation && endLocation) && !isCalculating

  // Full pipeline: OSRM Table matrix -> OR-Tools WASM Selective-TSP -> OSRM road
  // geometry. K defaults to "visit all waypoints" when left blank.
  async function handleCalculateRoute() {
    if (!startLocation || !endLocation) return
    setIsCalculating(true)
    setRouteError(null)
    setCalcStatus(null)
    try {
      const k = targetK ?? waypoints.length
      const route = await planSelectiveRoute(
        startLocation,
        waypoints,
        endLocation,
        k,
        setCalcStatus,
      )
      setOptimizedRoute(route)
      setSolverReady(true)
    } catch (e) {
      setOptimizedRoute(null)
      setRouteError((e as Error).message)
    } finally {
      setIsCalculating(false)
      setCalcStatus(null)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* ---------------- Sidebar: inputs + lists ---------------- */}
      <aside className="flex w-96 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-5">
        <header>
          <div className="flex items-start justify-between">
            <h1 className="text-xl font-bold text-slate-800">Route Optimiser</h1>
            {hasSession && (
              <button
                onClick={handleResetAll}
                className="mt-1 text-xs text-slate-400 hover:text-red-500"
              >
                Start over
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Set a start &amp; end, then add intermediate stops.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Auto-saved on this device — safe to close &amp; reopen.
          </p>
        </header>

        {solverWarning && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700">
            ⚠️ {solverWarning}
          </div>
        )}

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
          <TargetKInput
            value={targetK}
            max={waypoints.length}
            onChange={setTargetK}
          />
        </section>

        <section className="space-y-2">
          <button
            onClick={handleCalculateRoute}
            disabled={!canCalculate}
            className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${
              isCalculating
                ? 'animate-pulse bg-blue-500'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
            }`}
          >
            {isCalculating ? (calcStatus ?? 'Calculating…') : 'Calculate Route'}
          </button>
          {!startLocation || !endLocation ? (
            <p className="text-xs text-slate-400">
              Set both a start and an end location to calculate.
            </p>
          ) : !isCalculating && !solverReady ? (
            <p className="text-xs text-slate-400">
              Preparing optimizer (one-time download)…
            </p>
          ) : null}
          {routeError && <p className="text-xs text-red-500">{routeError}</p>}
          {optimizedRoute && (
            <>
              <p className="text-xs text-slate-500">
                Visiting {optimizedRoute.orderedWaypoints.length - 2} of{' '}
                {waypoints.length} candidate stop
                {waypoints.length === 1 ? '' : 's'}.
              </p>
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
