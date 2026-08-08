import { create } from 'zustand'
import { DEFAULT_BASEMAP, type BasemapId } from '../lib/map/basemap'
import type { SheetSnap } from '../lib/sheetSnap'

/**
 * Transient UI state. Never persisted — reopening the app should not restore a
 * half-dragged sheet or a stale map camera.
 *
 * Kept separate from routesStore so that hovering a row or dragging the sheet
 * cannot possibly invalidate a route selector, and vice versa.
 */

/**
 * Bottom-sheet detents. Defined in `lib/sheetSnap.ts` alongside the maths that
 * decides which one a gesture lands on, and re-exported here because the store
 * is where components reach for it.
 */
export type { SheetSnap }

/** A request for the map to move. The map consumes it and clears it — state
 *  describes intent, not the camera's actual position, which MapLibre owns.
 *
 *  For callers INSIDE the map's subtree there is a better route: read the
 *  MapController off its context and call it directly. This exists for the
 *  ones outside it — the itinerary, search — which have no such access. */
export interface CameraIntent {
  center?: { lat: number; lng: number }
  zoom?: number
  /** Fit these points into view instead of centring. */
  fitPoints?: { lat: number; lng: number }[]
  /** Changes on every request so repeat intents to the same place still fire. */
  nonce: number
}

/**
 * What the route editor modal is doing.
 *
 * One modal serves both jobs because they edit exactly the same two fields;
 * a separate "Set name and date" screen would be the same form with a
 * different title and a second copy of the date logic to keep in step.
 */
export type RouteEditorTarget = { mode: 'create' } | { mode: 'edit'; routeId: string }

interface UiState {
  sheetSnap: SheetSnap
  selectedStopId: string | null
  hoveredStopId: string | null
  /** When set, the next map tap places this anchor. */
  mapPlacementMode: 'start' | 'end' | null
  cameraIntent: CameraIntent | null
  searchQuery: string
  searchOpen: boolean
  /**
   * Which basemap the layers FAB has selected.
   *
   * Not persisted, like everything else here — but note the asymmetry with
   * the rest of this store: a basemap preference is arguably a SETTING rather
   * than transient UI, and if it ever wants to survive a reload it belongs in
   * routesStore's persisted slice, not here.
   */
  basemap: BasemapId

  // ── The routes drawer and its overlays ──
  /** The left side sheet listing every route. */
  drawerOpen: boolean
  routeEditor: RouteEditorTarget | null
  /** The route whose 3-dot overflow sheet is open. */
  overflowRouteId: string | null
  /** The route awaiting a delete confirmation. */
  confirmDeleteRouteId: string | null

  /**
   * The "Route setup" modal — the M1 control panels, reached from the sheet's
   * overflow.
   *
   * Transitional by design. M5 replaces the mobile screen with the sheet, and
   * the legacy panels are the only way to upload a file, set the endpoints or
   * press Calculate until M6–M8 rebuild them. Parking them behind the overflow
   * keeps every existing capability reachable without wiring any of it into the
   * new design. When the last panel is replaced, this flag and the modal go.
   */
  setupOpen: boolean

  setDrawerOpen: (open: boolean) => void
  openRouteEditor: (target: RouteEditorTarget) => void
  closeRouteEditor: () => void
  setOverflowRouteId: (routeId: string | null) => void
  setConfirmDeleteRouteId: (routeId: string | null) => void
  setSetupOpen: (open: boolean) => void

  setSheetSnap: (snap: SheetSnap) => void
  setSelectedStopId: (id: string | null) => void
  setHoveredStopId: (id: string | null) => void
  setMapPlacementMode: (mode: 'start' | 'end' | null) => void
  requestCamera: (intent: Omit<CameraIntent, 'nonce'>) => void
  clearCameraIntent: () => void
  setSearchQuery: (q: string) => void
  setSearchOpen: (open: boolean) => void
  setBasemap: (basemap: BasemapId) => void
}

let cameraNonce = 0

export const useUiStore = create<UiState>()((set) => ({
  sheetSnap: 'collapsed',
  selectedStopId: null,
  hoveredStopId: null,
  mapPlacementMode: null,
  cameraIntent: null,
  searchQuery: '',
  searchOpen: false,
  basemap: DEFAULT_BASEMAP,

  drawerOpen: false,
  routeEditor: null,
  overflowRouteId: null,
  confirmDeleteRouteId: null,
  setupOpen: false,

  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  // Opening the editor closes the overflow sheet it was launched from —
  // leaving both up would stack two modals over the same route.
  openRouteEditor: (routeEditor) => set({ routeEditor, overflowRouteId: null }),
  closeRouteEditor: () => set({ routeEditor: null }),
  setOverflowRouteId: (overflowRouteId) => set({ overflowRouteId }),
  setConfirmDeleteRouteId: (confirmDeleteRouteId) => set({ confirmDeleteRouteId, overflowRouteId: null }),
  setSetupOpen: (setupOpen) => set({ setupOpen }),

  setSheetSnap: (sheetSnap) => set({ sheetSnap }),
  setSelectedStopId: (selectedStopId) => set({ selectedStopId }),
  setHoveredStopId: (hoveredStopId) => set({ hoveredStopId }),
  setMapPlacementMode: (mapPlacementMode) => set({ mapPlacementMode }),
  requestCamera: (intent) => set({ cameraIntent: { ...intent, nonce: ++cameraNonce } }),
  clearCameraIntent: () => set({ cameraIntent: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setBasemap: (basemap) => set({ basemap }),
}))
