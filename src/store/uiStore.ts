import { create } from 'zustand'

/**
 * Transient UI state. Never persisted — reopening the app should not restore a
 * half-dragged sheet or a stale map camera.
 *
 * Kept separate from routesStore so that hovering a row or dragging the sheet
 * cannot possibly invalidate a route selector, and vice versa.
 */

/** Bottom-sheet detents. */
export type SheetSnap = 'peek' | 'half' | 'full'

/** A request for the map to move. The map consumes it and clears it — state
 *  describes intent, not the camera's actual position, which Leaflet owns. */
export interface CameraIntent {
  center?: { lat: number; lng: number }
  zoom?: number
  /** Fit these points into view instead of centring. */
  fitPoints?: { lat: number; lng: number }[]
  /** Changes on every request so repeat intents to the same place still fire. */
  nonce: number
}

interface UiState {
  sheetSnap: SheetSnap
  selectedStopId: string | null
  hoveredStopId: string | null
  /** When set, the next map tap places this anchor. */
  mapPlacementMode: 'start' | 'end' | null
  cameraIntent: CameraIntent | null
  searchQuery: string
  searchOpen: boolean

  setSheetSnap: (snap: SheetSnap) => void
  setSelectedStopId: (id: string | null) => void
  setHoveredStopId: (id: string | null) => void
  setMapPlacementMode: (mode: 'start' | 'end' | null) => void
  requestCamera: (intent: Omit<CameraIntent, 'nonce'>) => void
  clearCameraIntent: () => void
  setSearchQuery: (q: string) => void
  setSearchOpen: (open: boolean) => void
}

let cameraNonce = 0

export const useUiStore = create<UiState>()((set) => ({
  sheetSnap: 'peek',
  selectedStopId: null,
  hoveredStopId: null,
  mapPlacementMode: null,
  cameraIntent: null,
  searchQuery: '',
  searchOpen: false,

  setSheetSnap: (sheetSnap) => set({ sheetSnap }),
  setSelectedStopId: (selectedStopId) => set({ selectedStopId }),
  setHoveredStopId: (hoveredStopId) => set({ hoveredStopId }),
  setMapPlacementMode: (mapPlacementMode) => set({ mapPlacementMode }),
  requestCamera: (intent) => set({ cameraIntent: { ...intent, nonce: ++cameraNonce } }),
  clearCameraIntent: () => set({ cameraIntent: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))
