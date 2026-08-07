import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection, LineString, Point } from 'geojson'
import type { LatLng } from '../../types'
import { BASEMAPS, FALLBACK_STYLE, type BasemapId } from './basemap.ts'
import { renderChip, type ChipBitmap } from './chipImage.ts'
import type { ChipSpec } from './chipSpec.ts'
import type { StopFeatureProps } from './features.ts'
import type { LegProps } from './splitRoute.ts'
import {
  CAMERA_DURATION_MS,
  FIT_PADDING,
  FOCUS_ZOOM,
  boundsOf,
  centerOf,
  isDegenerate,
  nextRecenterPhase,
  type BoundsTuple,
  type RecenterPhase,
} from './camera.ts'
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  LAYER_CLUSTERS,
  LAYER_STOPS,
  SOURCE_ROUTE,
  SOURCE_STOPS,
  orderedLayers,
} from './layers.ts'
import { MAP_COLORS, ROUTE_COLORS } from './palette.ts'

/**
 * The map, as an imperative object.
 *
 * React owns *when* this is told things; it owns *how* they are drawn. The
 * split matters because MapLibre is a retained-mode renderer with its own
 * lifecycle — trying to express "add a layer" as a render output means
 * fighting it on every reconcile.
 *
 * Nothing here imports React or the store, so it stays inside lib/.
 */

const EMPTY_STOPS: FeatureCollection<Point, StopFeatureProps> = {
  type: 'FeatureCollection',
  features: [],
}
const EMPTY_ROUTE: FeatureCollection<LineString, LegProps> = {
  type: 'FeatureCollection',
  features: [],
}

const USER_SOURCE = 'user-position'
const USER_DOT = 'user-dot'
const USER_CONE = 'user-cone'
const USER_CONE_IMAGE = 'user-cone-image'

/**
 * Texture density for the chip bitmaps.
 *
 * Capped at 2 deliberately: a 3x phone would triple every marker's texture
 * memory, and at 30dp a chip is already past the point where more pixels are
 * visible. 300 markers is where that arithmetic stops being academic.
 */
const chipPixelRatio = (): number => Math.min(Math.ceil(globalThis.devicePixelRatio || 1), 2)

export interface MapControllerOptions {
  container: HTMLElement
  basemap: BasemapId
  /** A stop marker was tapped. */
  onStopClick: (stopId: string) => void
  /** The map itself was tapped, away from any marker. */
  onMapClick: (point: LatLng) => void
  /** The basemap failed to load and the fallback was swapped in. */
  onStyleFallback?: (basemap: BasemapId) => void
}

export interface RecenterContext {
  selectedStop: LatLng | null
  stops: LatLng[]
  routeBounds: BoundsTuple | null
}

export class MapController {
  readonly map: MapLibreMap

  #basemap: BasemapId
  #usingFallback = false
  #destroyed = false
  #ready = false

  /** Rendered chip bitmaps, kept so a basemap switch does not redraw them. */
  #chips = new Map<string, ChipBitmap>()
  #stopData: FeatureCollection<Point, StopFeatureProps> = EMPTY_STOPS
  #routeData: FeatureCollection<LineString, LegProps> = EMPTY_ROUTE
  #userData: FeatureCollection<Point, { heading: number }> = {
    type: 'FeatureCollection',
    features: [],
  }

  #recenterPhase: RecenterPhase | null = null
  #onStyleFallback?: (basemap: BasemapId) => void

  constructor(options: MapControllerOptions) {
    this.#basemap = options.basemap
    this.#onStyleFallback = options.onStyleFallback

    this.map = new maplibregl.Map({
      container: options.container,
      style: BASEMAPS[options.basemap].url,
      center: [12.5683, 55.6761],
      zoom: 2,
      attributionControl: false,
      // The whole point of moving off Leaflet is hundreds of markers staying
      // smooth; a fade on every placement change makes that work visible.
      fadeDuration: 120,
    })

    // No `customAttribution`. MapLibre reads the credit off the style's own
    // sources, and OpenFreeMap declares exactly the string we would pass —
    // supplying it again renders it twice, which is what a browser check
    // showed. The control itself is a licence requirement: never remove it.
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    // `styledata` fires for the initial load AND after every setStyle, which
    // is what makes a basemap switch re-establish our sources, layers and
    // images instead of silently losing them. `load` is belt and braces for
    // the first one.
    this.map.on('styledata', () => this.#ensureStyleAssets())
    this.map.on('load', () => this.#ensureStyleAssets())

    this.map.on('error', (event) => this.#handleError(event?.error))

    this.map.on('click', LAYER_STOPS, (event) => {
      const id = event.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        // Stop the map-click handler from also firing and clearing the
        // selection this tap just made.
        event.preventDefault()
        options.onStopClick(id)
      }
    })

    this.map.on('click', LAYER_CLUSTERS, (event) => {
      event.preventDefault()
      void this.#expandCluster([event.point.x, event.point.y])
    })

    this.map.on('click', (event) => {
      if (event.defaultPrevented) return
      options.onMapClick({
        lat: Number(event.lngLat.lat.toFixed(6)),
        lng: Number(event.lngLat.lng.toFixed(6)),
      })
    })

    this.#exposeForTests()

    for (const layer of [LAYER_STOPS, LAYER_CLUSTERS]) {
      this.map.on('mouseenter', layer, () => {
        this.map.getCanvas().style.cursor = 'pointer'
      })
      this.map.on('mouseleave', layer, () => {
        this.map.getCanvas().style.cursor = ''
      })
    }
  }

  /**
   * Expose the controller for the acceptance tests.
   *
   * `__DEV_ROUTES__` is a build-time `define`, so this whole branch — and the
   * property name with it — is folded away in a production build. It exists
   * because the only honest way to assert "the marker actually rendered" is
   * to ask MapLibre what it placed; a screenshot cannot tell a missing chip
   * from a chip the collision detector correctly hid.
   */
  #exposeForTests(): void {
    if (!__DEV_ROUTES__) return
    ;(globalThis as unknown as { __mapController?: MapController }).__mapController = this
  }

  get ready(): boolean {
    return this.#ready
  }

  get basemap(): BasemapId {
    return this.#basemap
  }

  destroy(): void {
    this.#destroyed = true
    this.#chips.clear()
    this.map.remove()
  }

  // ───────────────────────────────────────────────────────────── style

  /**
   * A style that will not load leaves a blank grey rectangle where the map
   * should be, which looks exactly like a bug in this app. Swap to the
   * fallback provider once, then stop trying — retrying a dead CDN in a loop
   * would just burn the driver's battery.
   */
  #handleError(error: unknown): void {
    if (this.#destroyed || this.#usingFallback) return

    // Only a genuinely FAILED FETCH against the basemap host triggers the
    // swap. Sniffing the message text is a trap that already bit once:
    // MapLibre's ordinary runtime errors say things like "does not exist in
    // the map's style", which matched /style/ and silently switched provider
    // because a test queried a layer before it existed. MapLibre's AJAXError
    // carries the URL it failed on, and that is the only honest signal.
    const url = (error as { url?: unknown } | null | undefined)?.url
    if (typeof url !== 'string' || !url.includes('openfreemap.org')) return

    this.#usingFallback = true
    console.warn('[map] basemap failed to load; falling back to Stadia Maps', error)
    this.map.setStyle(FALLBACK_STYLE[this.#basemap])
    this.#onStyleFallback?.(this.#basemap)
  }

  setBasemap(basemap: BasemapId): void {
    if (basemap === this.#basemap) return
    this.#basemap = basemap
    this.map.setStyle(
      this.#usingFallback ? FALLBACK_STYLE[basemap] : BASEMAPS[basemap].url,
    )
  }

  /**
   * Re-establish everything a `setStyle` wipes.
   *
   * MapLibre throws away custom sources, layers and images when the style
   * changes, so this runs on every `styledata` and is written to be
   * idempotent — it is called far more often than the style actually changes.
   */
  #ensureStyleAssets(): void {
    if (this.#destroyed) return

    // Deliberately NOT gated on `map.isStyleLoaded()`.
    //
    // That predicate is true only once the style is parsed AND every source
    // in it has finished loading — and sources finish on `sourcedata`, not
    // `styledata`. Gating on it meant the gate never opened on the same tick
    // an event fired, so no source, layer or image was ever added and the map
    // rendered a perfect basemap with nothing on it.
    //
    // What actually matters is whether the style JSON is parsed, and the only
    // honest test for that is to try: `addSource` throws "Style is not done
    // loading" if it isn't, and the next `styledata` brings us straight back.
    try {
      const ratio = chipPixelRatio()
      for (const [key, bitmap] of this.#chips) {
        if (!this.map.hasImage(key)) this.map.addImage(key, bitmap, { pixelRatio: ratio })
      }
      if (!this.map.hasImage(USER_CONE_IMAGE)) {
        this.map.addImage(USER_CONE_IMAGE, renderHeadingCone(ratio), { pixelRatio: ratio })
      }

      if (!this.map.getSource(SOURCE_ROUTE)) {
        this.map.addSource(SOURCE_ROUTE, { type: 'geojson', data: this.#routeData })
      }
      if (!this.map.getSource(SOURCE_STOPS)) {
        this.map.addSource(SOURCE_STOPS, {
          type: 'geojson',
          data: this.#stopData,
          cluster: true,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
          clusterRadius: CLUSTER_RADIUS,
        })
      }
      if (!this.map.getSource(USER_SOURCE)) {
        this.map.addSource(USER_SOURCE, { type: 'geojson', data: this.#userData })
      }

      for (const layer of orderedLayers()) {
        if (!this.map.getLayer(layer.id)) this.map.addLayer(layer)
      }
      this.#ensureUserLayers()

      this.#ready = true
    } catch {
      // Style not parsed yet. Harmless: `styledata` fires repeatedly during
      // load, and every add above is idempotent, so the next one succeeds.
      this.#ready = false
    }
  }

  #ensureUserLayers(): void {
    if (!this.map.getLayer(USER_CONE)) {
      this.map.addLayer({
        id: USER_CONE,
        type: 'symbol',
        source: USER_SOURCE,
        // A heading of -1 means the device did not report one; hide the cone
        // rather than pointing it north and inventing a direction.
        filter: ['>=', ['get', 'heading'], 0],
        layout: {
          'icon-image': USER_CONE_IMAGE,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })
    }
    if (!this.map.getLayer(USER_DOT)) {
      this.map.addLayer({
        id: USER_DOT,
        type: 'circle',
        source: USER_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': ROUTE_COLORS.remaining,
          'circle-stroke-width': 3,
          'circle-stroke-color': MAP_COLORS.surface,
        },
      })
    }
  }

  // ────────────────────────────────────────────────────────────── data

  /**
   * Push a new set of markers.
   *
   * Images are registered before the data that references them — the other
   * order logs "image not found" and renders text with no chip. Bitmaps for
   * chips nobody uses any more are dropped, which is what keeps 300 markers
   * being reordered all day from growing the texture atlas without bound.
   */
  setStops(data: FeatureCollection<Point, StopFeatureProps>, specs: Map<string, ChipSpec>): void {
    if (this.#destroyed) return
    this.#stopData = data

    const ratio = chipPixelRatio()
    for (const [key, spec] of specs) {
      if (this.#chips.has(key)) continue
      const bitmap = renderChip(spec, ratio)
      this.#chips.set(key, bitmap)
      // Before the style is up, caching is enough — `#ensureStyleAssets`
      // registers everything in `#chips` the moment it can.
      if (this.#ready && !this.map.hasImage(key)) {
        this.map.addImage(key, bitmap, { pixelRatio: ratio })
      }
    }

    // Snapshot the keys: the loop deletes from the map it is walking.
    for (const key of Array.from(this.#chips.keys())) {
      if (specs.has(key)) continue
      this.#chips.delete(key)
      if (this.map.hasImage(key)) this.map.removeImage(key)
    }

    this.#source<GeoJSONSource>(SOURCE_STOPS)?.setData(data)
  }

  setRoute(data: FeatureCollection<LineString, LegProps>): void {
    if (this.#destroyed) return
    this.#routeData = data
    this.#source<GeoJSONSource>(SOURCE_ROUTE)?.setData(data)
  }

  /** @param heading degrees clockwise from north, or null if unknown. */
  setUserPosition(point: LatLng | null, heading: number | null): void {
    if (this.#destroyed) return
    this.#userData = {
      type: 'FeatureCollection',
      features: point
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
              properties: { heading: heading ?? -1 },
            },
          ]
        : [],
    }
    this.#source<GeoJSONSource>(USER_SOURCE)?.setData(this.#userData)
  }

  #source<T>(id: string): T | null {
    if (!this.map.getStyle()) return null
    return (this.map.getSource(id) as T | undefined) ?? null
  }

  async #expandCluster(pixel: [number, number]): Promise<void> {
    const features = this.map.queryRenderedFeatures(pixel, { layers: [LAYER_CLUSTERS] })
    const clusterId = features[0]?.properties?.cluster_id
    if (clusterId === undefined) return
    const source = this.#source<GeoJSONSource>(SOURCE_STOPS)
    if (!source) return
    try {
      const zoom = await source.getClusterExpansionZoom(clusterId)
      const geometry = features[0].geometry
      if (geometry.type !== 'Point') return
      this.map.easeTo({
        center: geometry.coordinates as [number, number],
        zoom,
        duration: CAMERA_DURATION_MS,
      })
    } catch {
      // A cluster that vanished between the tap and the lookup is not an
      // error worth surfacing — the data simply moved on.
    }
  }

  // ──────────────────────────────────────────────────────────── camera
  //
  // The public camera API takes IDs and no arguments, not coordinates. The
  // controller already holds the stop features, the route geometry and the
  // last user fix, so making callers look those up and hand them back would
  // be asking them to know things this object knows better.

  /** Frame one stop by its uuid. Returns false if it is not on the map. */
  focusStop(stopId: string): boolean {
    const point = this.#stopPoint(stopId)
    if (!point) return false
    this.#recenterPhase = 'stop'
    this.focusPoint(point)
    return true
  }

  /** Frame the whole driven route, falling back to the stops on an unsolved one. */
  fitRoute(): boolean {
    const points = this.#routePoints()
    if (points.length === 0) return false
    this.fitPoints(points)
    return true
  }

  /** Recentre on the last known device position. */
  followUser(): boolean {
    const point = this.#userPoint()
    if (!point) return false
    this.map.easeTo({
      center: [point.lng, point.lat],
      zoom: Math.max(this.map.getZoom(), FOCUS_ZOOM - 1),
      duration: CAMERA_DURATION_MS,
    })
    return true
  }

  /** The coordinate primitive behind focusStop, also used by camera intents. */
  focusPoint(point: LatLng): void {
    this.map.easeTo({
      center: [point.lng, point.lat],
      zoom: Math.max(this.map.getZoom(), FOCUS_ZOOM),
      duration: CAMERA_DURATION_MS,
    })
  }

  #stopPoint(stopId: string): LatLng | null {
    const feature = this.#stopData.features.find((f) => f.properties.id === stopId)
    if (!feature) return null
    const [lng, lat] = feature.geometry.coordinates
    return { lat, lng }
  }

  #userPoint(): LatLng | null {
    const feature = this.#userData.features[0]
    if (!feature) return null
    const [lng, lat] = feature.geometry.coordinates
    return { lat, lng }
  }

  /** Every point worth framing: the driven line if solved, else the stops. */
  #routePoints(): LatLng[] {
    const line = this.#routeData.features.flatMap((f) => f.geometry.coordinates)
    if (line.length > 0) return line.map(([lng, lat]) => ({ lat, lng }))
    return this.#stopData.features.map((f) => {
      const [lng, lat] = f.geometry.coordinates
      return { lat, lng }
    })
  }

  #stopPoints(): LatLng[] {
    return this.#stopData.features.map((f) => {
      const [lng, lat] = f.geometry.coordinates
      return { lat, lng }
    })
  }

  /** Frame a set of points. A single point centres rather than zooming to max. */
  fitPoints(points: LatLng[]): void {
    const bounds = boundsOf(points)
    if (!bounds) return
    if (isDegenerate(bounds)) {
      const center = centerOf(bounds)
      this.map.easeTo({
        center: [center.lng, center.lat],
        zoom: Math.max(this.map.getZoom(), FOCUS_ZOOM - 2),
        duration: CAMERA_DURATION_MS,
      })
      return
    }
    this.map.fitBounds(bounds, { padding: FIT_PADDING, duration: CAMERA_DURATION_MS })
  }

  fitBounds(bounds: BoundsTuple): void {
    this.map.fitBounds(bounds, { padding: FIT_PADDING, duration: CAMERA_DURATION_MS })
  }

  /**
   * One button, three answers: this stop → every stop → the whole drive.
   *
   * Takes only the selected stop id, because that is the single thing the
   * controller cannot know — selection lives in the UI store. Everything else
   * it derives from the data it was already given. Phases with nothing to
   * show are skipped, so a tap never appears to do nothing.
   */
  recenter(selectedStopId: string | null): RecenterPhase | null {
    const selected = selectedStopId ? this.#stopPoint(selectedStopId) : null
    const stops = this.#stopPoints()
    const hasRoute = this.#routeData.features.length > 0

    const phase = nextRecenterPhase(this.#recenterPhase, {
      stop: selected !== null,
      stops: stops.length > 0,
      route: hasRoute,
    })
    if (!phase) return null
    this.#recenterPhase = phase

    if (phase === 'stop' && selected) this.focusPoint(selected)
    else if (phase === 'stops') this.fitPoints(stops)
    else if (phase === 'route') this.fitPoints(this.#routePoints())
    return phase
  }

  /** Drop the cycle back to the start — used when the selection changes. */
  resetRecenterCycle(): void {
    this.#recenterPhase = null
  }
}

/**
 * The heading cone: a soft blue wedge that fades outward, anchored so its
 * point sits under the position dot.
 */
function renderHeadingCone(pixelRatio: number): ChipBitmap {
  const size = 46
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(size * pixelRatio)
  canvas.height = Math.ceil(size * pixelRatio)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[map] 2D canvas context unavailable; cannot draw the heading cone')

  ctx.scale(pixelRatio, pixelRatio)
  const apexX = size / 2
  const apexY = size

  const gradient = ctx.createRadialGradient(apexX, apexY, 0, apexX, apexY, size)
  gradient.addColorStop(0, 'rgba(26, 95, 212, 0.55)')
  gradient.addColorStop(1, 'rgba(26, 95, 212, 0)')

  ctx.beginPath()
  ctx.moveTo(apexX, apexY)
  ctx.arc(apexX, apexY, size * 0.95, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  return {
    width: canvas.width,
    height: canvas.height,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  }
}
