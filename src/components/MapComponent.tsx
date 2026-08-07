import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LatLng } from '../types'
import { MapController } from '../lib/map/controller'
import { buildStopFeatures, collectChipSpecs, lastHandledStop, nextStopId } from '../lib/map/features'
import { splitRouteGeometry } from '../lib/map/splitRoute'
import { boundsOf } from '../lib/map/camera'
import { selectActiveRoute, useRoutesStore } from '../store/routesStore'
import { useUiStore } from '../store/uiStore'
import { MapControllerContext } from './map/MapControllerContext'
import { MapChrome } from './map/MapChrome'

/**
 * The map.
 *
 * Prop-less by design — it reads the active route straight from the store, so
 * the screen that hosts it stays a one-liner and nothing has to thread route
 * data through the tree just to reach the map.
 *
 * ── The division of labour ────────────────────────────────────────────────
 *
 * React decides WHAT should be on the map; `MapController` decides HOW to get
 * it there. Everything below is therefore effects pushing derived data into an
 * imperative object, and deliberately renders no map DOM of its own beyond the
 * container: MapLibre owns those pixels and React must not reconcile them.
 */
export function MapComponent() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [controller, setController] = useState<MapController | null>(null)

  const route = useRoutesStore(selectActiveRoute)
  const { stops, groups, optimized } = useMemo(
    () => ({
      stops: route?.stops ?? [],
      groups: route?.groups ?? [],
      optimized: route?.optimized,
    }),
    [route],
  )

  const selectedStopId = useUiStore((s) => s.selectedStopId)
  const basemap = useUiStore((s) => s.basemap)
  const setSelectedStopId = useUiStore((s) => s.setSelectedStopId)
  const { placementMode, setPlacementMode } = useUiStore(
    useShallow((s) => ({
      placementMode: s.mapPlacementMode,
      setPlacementMode: s.setMapPlacementMode,
    })),
  )
  const cameraIntent = useUiStore((s) => s.cameraIntent)
  const clearCameraIntent = useUiStore((s) => s.clearCameraIntent)

  // Placement writes go through refs so the map's click handler — registered
  // once, for the life of the map — always sees current values without the
  // controller being torn down and rebuilt every time one of them changes.
  const placementRef = useRef(placementMode)
  placementRef.current = placementMode

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return
    const instance = new MapController({
      container: containerRef.current,
      basemap: useUiStore.getState().basemap,
      onStopClick: (stopId) => {
        // Tapping the selected stop again clears it, which is the only way
        // back to the route overview without hunting for empty map.
        const current = useUiStore.getState().selectedStopId
        useUiStore.getState().setSelectedStopId(current === stopId ? null : stopId)
      },
      onMapClick: (point) => {
        const mode = placementRef.current
        if (mode) {
          const routes = useRoutesStore.getState()
          if (mode === 'start') routes.setStart(point)
          else routes.setEnd(point)
          useUiStore.getState().setMapPlacementMode(null)
          return
        }
        useUiStore.getState().setSelectedStopId(null)
      },
    })
    setController(instance)
    return () => {
      setController(null)
      instance.destroy()
    }
  }, [])

  // ── Data ───────────────────────────────────────────────────────────────

  const nextId = useMemo(
    () => (route ? nextStopId({ stops: route.stops, optimized: route.optimized }) : null),
    [route],
  )

  const featureInput = useMemo(
    () => ({ stops, groups, selectedStopId, nextStopId: nextId }),
    [stops, groups, selectedStopId, nextId],
  )

  useEffect(() => {
    if (!controller) return
    controller.setStops(buildStopFeatures(featureInput), collectChipSpecs(featureInput))
  }, [controller, featureInput])

  useEffect(() => {
    if (!controller) return
    const splitAt = route ? lastHandledStop({ stops: route.stops, optimized: route.optimized }) : null
    controller.setRoute(
      splitRouteGeometry(optimized?.geometry ?? null, splitAt ? toLatLng(splitAt) : null),
    )
  }, [controller, optimized, route])

  useEffect(() => {
    controller?.setBasemap(basemap)
  }, [controller, basemap])

  // ── Camera ─────────────────────────────────────────────────────────────

  // The first time a route has anything to show, frame it. Keyed on the route
  // id so opening a different route reframes, while ticking a stop delivered
  // does not yank the camera away from where the driver left it.
  const framedRouteId = useRef<string | null>(null)
  useEffect(() => {
    if (!controller || !route) return
    if (framedRouteId.current === route.id) return
    const points = anchorPoints(route.start, route.end, stops)
    if (points.length === 0) return
    framedRouteId.current = route.id
    controller.fitPoints(points)
  }, [controller, route, stops])

  // Selecting a stop moves the camera to it, and restarts the recenter cycle
  // so the next tap of the FAB widens out rather than resuming mid-cycle.
  useEffect(() => {
    if (!controller || !selectedStopId) return
    const stop = stops.find((s) => s.id === selectedStopId)
    if (!stop) return
    controller.resetRecenterCycle()
    controller.focusStop(toLatLng(stop))
  }, [controller, selectedStopId, stops])

  const routeBounds = useMemo(
    () => boundsOf(routeGeometryPoints(optimized?.geometry?.coordinates)),
    [optimized],
  )

  // Camera requests from outside the map — the itinerary, search results.
  // The map consumes the intent and clears it, so a repeat request to the
  // same place still fires (the nonce is what makes that work).
  useEffect(() => {
    if (!controller || !cameraIntent) return
    if (cameraIntent.fitPoints?.length) controller.fitPoints(cameraIntent.fitPoints)
    else if (cameraIntent.center) controller.focusStop(cameraIntent.center)
    clearCameraIntent()
  }, [controller, cameraIntent, clearCameraIntent])

  return (
    <MapControllerContext.Provider value={controller}>
      <div className={`relative h-full w-full ${placementMode ? 'ro-placing' : ''}`}>
        <div ref={containerRef} className="h-full w-full" data-testid="map-canvas" />

        {placementMode && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3">
            <div className="pointer-events-auto flex items-center gap-3 rounded-pill border border-outline bg-surface px-4 py-2 shadow-md">
              <span className="text-body font-medium text-on-surface">
                Tap the map to set the {placementMode === 'start' ? 'start' : 'end'}
              </span>
              <button
                type="button"
                onClick={() => setPlacementMode(null)}
                className="inline-flex min-h-touch items-center rounded-pill px-3 text-label font-semibold text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <MapChrome
          stops={stops}
          start={route?.start ?? null}
          end={route?.end ?? null}
          selectedStopId={selectedStopId}
          onSelectStop={setSelectedStopId}
          routeBounds={routeBounds}
          durationSeconds={optimized?.durationSeconds}
        />
      </div>
    </MapControllerContext.Provider>
  )
}

const toLatLng = (p: LatLng): LatLng => ({ lat: p.lat, lng: p.lng })

/** Every point worth framing: the stops plus whichever endpoints are pinned. */
function anchorPoints(start: LatLng | null, end: LatLng | null, stops: LatLng[]): LatLng[] {
  const points: LatLng[] = stops.map(toLatLng)
  if (start) points.push(toLatLng(start))
  if (end) points.push(toLatLng(end))
  return points
}

function routeGeometryPoints(coordinates: number[][] | undefined): LatLng[] {
  if (!coordinates) return []
  return coordinates.map(([lng, lat]) => ({ lat, lng }))
}
