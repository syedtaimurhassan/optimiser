import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { useShallow } from 'zustand/react/shallow'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LatLng } from '../types'
import { MapController } from '../lib/map/controller'
import { buildStopFeatures, collectChipSpecs, lastHandledStop, nextStopId } from '../lib/map/features'
import { buildStopPages, pageIndexById } from '../lib/stopPages'
import type { StagedKind } from '../lib/map/chipSpec'
import { splitRouteGeometry } from '../lib/map/splitRoute'
import { selectActiveRoute, useRoutesStore } from '../store/routesStore'
import { useUiStore } from '../store/uiStore'
import { MapControllerContext } from './map/MapControllerContext'
import { MapChrome } from './map/MapChrome'
import { AddByPin } from './search/AddByPin'

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
  const { placementMode, setPlacementMode } = useUiStore(
    useShallow((s) => ({
      placementMode: s.mapPlacementMode,
      setPlacementMode: s.setMapPlacementMode,
    })),
  )
  const addByPinOpen = useUiStore((s) => s.addByPinOpen)
  const setAddByPinOpen = useUiStore((s) => s.setAddByPinOpen)
  const addStops = useRoutesStore((s) => s.addStops)
  const cameraIntent = useUiStore((s) => s.cameraIntent)
  const clearCameraIntent = useUiStore((s) => s.clearCameraIntent)

  // Placement mode goes through a ref so the map's click handler — registered
  // once, for the life of the map — sees the current value without the
  // controller being torn down and rebuilt every time it changes.
  //
  // Written in an effect rather than during render: assigning to a ref while
  // rendering is not safe under StrictMode's double invocation, and a click
  // cannot physically arrive between the render and the effect anyway.
  const placementRef = useRef(placementMode)
  useEffect(() => {
    placementRef.current = placementMode
  }, [placementMode])

  /**
   * Navigation, behind the same ref trick, and for the same reason.
   *
   * A tap on a marker OPENS that stop — it does not just tint it — because the
   * URL is what decides which carousel page is showing. The controller's click
   * handler is registered once for the life of the map, so it reads `navigate`
   * and the current route id from refs rather than closing over them.
   */
  const params = useParams<{ routeId: string; stopId?: string }>()
  const [, navigate] = useLocation()
  const navRef = useRef({ navigate, routeId: params.routeId, onStopPage: Boolean(params.stopId) })
  useEffect(() => {
    navRef.current = { navigate, routeId: params.routeId, onStopPage: Boolean(params.stopId) }
  }, [navigate, params.routeId, params.stopId])

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return
    const instance = new MapController({
      container: containerRef.current,
      basemap: useUiStore.getState().basemap,
      onStopClick: (stopId) => {
        // Tapping the marker of the stop already open closes its card, which
        // is the only way back to the route overview without hunting for empty
        // map. Both directions are a navigation: the URL owns which stop is
        // open, and writing the selection here instead would immediately be
        // overwritten by the mirror in RouteWorkScreen.
        const { navigate, routeId } = navRef.current
        const current = useUiStore.getState().selectedStopId
        navigate(current === stopId ? `/route/${routeId}` : `/route/${routeId}/stop/${stopId}`)
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
        // With a card open the selection belongs to the URL, and clearing it
        // here would un-highlight the marker of the stop still on screen.
        // Dismissing is what the card's own X is for.
        if (navRef.current.onStopPage) return
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

  /**
   * The carousel's pages, again.
   *
   * RouteWorkScreen builds these too, and this is a deliberate second pass
   * rather than a prop. MapComponent is prop-less by design — it reads the
   * active route straight from the store — and threading a page array through
   * would put the map's data in the screen's hands for the benefit of one
   * pill. `buildStopPages` is a single O(n) map over the stops.
   */
  const pages = useMemo(() => (route ? buildStopPages(route) : []), [route])
  const pageIndex = pageIndexById(pages, params.stopId ?? null)
  const currentPage = pageIndex === -1 ? null : pages[pageIndex]
  const previousPage = pageIndex > 0 ? pages[pageIndex - 1] : null

  /**
   * Edits staged since the last optimisation, as marker states.
   *
   * ⚠️ `PendingChange.stopId` is read here as the stop's `id` (the uuid), NOT
   * as its display label. The field name says otherwise and nothing else in
   * the codebase writes it yet, so this is the first decision on the matter:
   * joining on the label is precisely the coordinate-as-identity bug class M2
   * spent a milestone removing, and two stops can share a label after a
   * "Reset Stop IDs". M6 owns staged edits — it should rename the field.
   */
  const staged = useMemo(() => {
    const changes = route?.pending?.changes ?? []
    if (changes.length === 0) return undefined
    const byStop: Record<string, StagedKind> = {}
    for (const change of changes) {
      if (!change.stopId) continue
      if (change.kind === 'add') byStop[change.stopId] = 'add'
      else if (change.kind === 'remove') byStop[change.stopId] = 'remove'
    }
    return byStop
  }, [route])

  const featureInput = useMemo(
    () => ({ stops, groups, selectedStopId, nextStopId: nextId, staged }),
    [stops, groups, selectedStopId, nextId, staged],
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
    controller.focusStop(stop.id)
  }, [controller, selectedStopId, stops])

  /**
   * The end page's camera.
   *
   * Every other page moves the camera through `selectedStopId`, which the map
   * already follows. The end location is not a stop and highlights no marker,
   * so it is the one page that has to ask — and it asks with the same 400ms
   * ease as the rest, so the lockstep is unbroken at the end of the round.
   */
  useEffect(() => {
    if (!controller || currentPage?.kind !== 'end') return
    controller.resetRecenterCycle()
    controller.focusPoint(currentPage.point)
  }, [controller, currentPage])

  // Camera requests from outside the map — the itinerary, search results.
  // The map consumes the intent and clears it, so a repeat request to the
  // same place still fires (the nonce is what makes that work).
  useEffect(() => {
    if (!controller || !cameraIntent) return
    if (cameraIntent.fitPoints?.length) controller.fitPoints(cameraIntent.fitPoints)
    else if (cameraIntent.center) controller.focusPoint(cameraIntent.center)
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
          selectedStopId={selectedStopId}
          previousPage={previousPage}
          onPreviousPage={() => {
            if (previousPage) {
              navigate(`/route/${params.routeId}/stop/${previousPage.id}`, { replace: true })
            }
          }}
          optimized={optimized}
        />

        {/*
          Add-by-pin renders INSIDE this provider because the pin is a property
          of the camera: it reads the centre and follows every `moveend`. The
          tile that opens it lives in the sheet, which is outside the map
          entirely — hence the store flag rather than a prop.
        */}
        {addByPinOpen && (
          <AddByPin
            onAdd={(point, address) => {
              addStops([{ ...point, address: address ?? undefined }])
              setAddByPinOpen(false)
            }}
            onAddAndEdit={(point, address) => {
              // The id comes back from the action rather than being fished out
              // of the stops array: on an optimised route the stop is STAGED
              // and never lands in `stops` at all, so "the last appended one"
              // finds the wrong stop, or none.
              const [created] = addStops([{ ...point, address: address ?? undefined }])
              setAddByPinOpen(false)
              // Open its card AND its edit form: "add and edit" promised the
              // form, and landing on the card behind it means dismissing the
              // form leaves the driver looking at the stop they just made.
              if (created) {
                navigate(`/route/${params.routeId}/stop/${created}`)
                useUiStore.getState().setStopEditorId(created)
              }
            }}
            onCancel={() => setAddByPinOpen(false)}
          />
        )}
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
