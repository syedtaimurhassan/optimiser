import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LatLng, OptimizedRoute, Favorite, Stop } from '../types'
import type { Objective } from '../lib/routingService'
import { planSelectiveRoute } from '../lib/planRoute'
import { warmUpSolver } from '../lib/solver'

interface RouteState {
  // --- Persisted (the user's work) ---
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: Stop[]
  targetK: number | null
  objective: Objective
  optimizedRoute: OptimizedRoute | null
  favorites: Favorite[]
  /** Whether the user wants fixed endpoints or an open (optimizer-chosen) route. */
  routeMode: 'fixed' | 'open'

  // --- Transient (never persisted) ---
  isCalculating: boolean
  calcStatus: string | null
  routeError: string | null
  solverReady: boolean
  solverWarning: string | null
  /** UI-only: which stop is hovered, to sync highlight between list ↔ map. */
  hoveredStopId: string | null
  /** UI-only: when set, the next map click places the start/end anchor. */
  mapPlacementMode: 'start' | 'end' | null

  // --- Events (actions) ---
  setStart: (value: LatLng | null) => void
  setEnd: (value: LatLng | null) => void
  addWaypoints: (points: LatLng[]) => void
  removeWaypoint: (id: string) => void
  clearWaypoints: () => void
  markDelivered: (id: string) => void
  markDeliveredByCoord: (lat: number, lng: number) => void
  restoreStop: (id: string) => void
  restoreAll: () => void
  setTargetK: (k: number | null) => void
  setObjective: (objective: Objective) => void
  setHoveredStopId: (id: string | null) => void
  setRouteMode: (mode: 'fixed' | 'open') => void
  setMapPlacementMode: (mode: 'start' | 'end' | null) => void
  calculateRoute: () => Promise<void>
  resetAll: () => void
  warmUp: () => void
  saveFavorite: (name: string) => void
  loadFavorite: (id: string) => void
  deleteFavorite: (id: string) => void
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2)

/** Fresh stops numbered 1..N (used when loading a favorite / migrating). */
const toStops = (points: LatLng[]): Stop[] =>
  points.map((p, i) => ({
    id: newId(),
    num: i + 1,
    lat: p.lat,
    lng: p.lng,
    delivered: false,
  }))

const sameCoord = (a: LatLng | null, lat: number, lng: number) =>
  !!a && a.lat === lat && a.lng === lng

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      startLocation: null,
      endLocation: null,
      waypoints: [],
      targetK: null,
      objective: 'duration',
      optimizedRoute: null,
      favorites: [],
      routeMode: 'fixed',

      isCalculating: false,
      calcStatus: null,
      routeError: null,
      solverReady: false,
      solverWarning: null,
      hoveredStopId: null,
      mapPlacementMode: null,

      setStart: (value) => set({ startLocation: value }),
      setEnd: (value) => set({ endLocation: value }),
      addWaypoints: (points) =>
        set((s) => {
          // Continue numbering from the highest so far — numbers are stable
          // identities and are never reused/shifted when stops are removed.
          const base = s.waypoints.reduce((m, w) => Math.max(m, w.num), 0)
          const added: Stop[] = points.map((p, i) => ({
            id: newId(),
            num: base + i + 1,
            lat: p.lat,
            lng: p.lng,
            delivered: false,
          }))
          return { waypoints: [...s.waypoints, ...added] }
        }),
      removeWaypoint: (id) =>
        set((s) => {
          const stop = s.waypoints.find((w) => w.id === id)
          return {
            waypoints: s.waypoints.filter((w) => w.id !== id),
            // Removing a stop that was the start/end also releases that anchor.
            startLocation:
              stop && sameCoord(s.startLocation, stop.lat, stop.lng)
                ? null
                : s.startLocation,
            endLocation:
              stop && sameCoord(s.endLocation, stop.lat, stop.lng)
                ? null
                : s.endLocation,
          }
        }),
      clearWaypoints: () => set({ waypoints: [] }),
      markDelivered: (id) =>
        set((s) => ({
          waypoints: s.waypoints.map((w) =>
            w.id === id ? { ...w, delivered: true } : w,
          ),
        })),
      markDeliveredByCoord: (lat, lng) =>
        set((s) => {
          const match = (p: LatLng | null) => !!p && p.lat === lat && p.lng === lng
          return {
            waypoints: s.waypoints.map((w) =>
              w.lat === lat && w.lng === lng ? { ...w, delivered: true } : w,
            ),
            // Completing the stop that was the start/end releases that anchor.
            startLocation: match(s.startLocation) ? null : s.startLocation,
            endLocation: match(s.endLocation) ? null : s.endLocation,
          }
        }),
      restoreStop: (id) =>
        set((s) => ({
          waypoints: s.waypoints.map((w) =>
            w.id === id ? { ...w, delivered: false } : w,
          ),
        })),
      restoreAll: () =>
        set((s) => ({
          waypoints: s.waypoints.map((w) =>
            w.delivered ? { ...w, delivered: false } : w,
          ),
        })),
      setTargetK: (k) => set({ targetK: k }),
      setObjective: (objective) => set({ objective }),
      setHoveredStopId: (id) => set({ hoveredStopId: id }),
      // Switching to an open route releases the fixed anchors (and cancels any
      // pending map placement); switching back just reveals the inputs again.
      setRouteMode: (mode) =>
        set(
          mode === 'open'
            ? { routeMode: 'open', startLocation: null, endLocation: null, mapPlacementMode: null }
            : { routeMode: 'fixed' },
        ),
      setMapPlacementMode: (mode) => set({ mapPlacementMode: mode }),

      resetAll: () =>
        set({
          startLocation: null,
          endLocation: null,
          waypoints: [],
          targetK: null,
          optimizedRoute: null,
          routeError: null,
        }),

      warmUp: () => {
        if (typeof window !== 'undefined' && window.crossOriginIsolated) {
          warmUpSolver()
            .then(() => set({ solverReady: true }))
            .catch((e) => set({ solverWarning: (e as Error).message }))
        } else {
          set({
            solverWarning:
              'This browser did not enable the isolation the optimizer needs ' +
              '(SharedArrayBuffer). Please use the latest Chrome or Edge.',
          })
        }
      },

      calculateRoute: async () => {
        const { startLocation, endLocation, waypoints, targetK, objective } = get()
        set({ isCalculating: true, routeError: null, calcStatus: null })
        try {
          const route = await planSelectiveRoute({
            startLocation,
            endLocation,
            // Delivered stops are done — never route to them.
            waypoints: waypoints.filter((w) => !w.delivered),
            targetK,
            objective,
            onStatus: (msg) => set({ calcStatus: msg }),
          })
          set({ optimizedRoute: route, solverReady: true })
        } catch (e) {
          set({ optimizedRoute: null, routeError: (e as Error).message })
        } finally {
          set({ isCalculating: false, calcStatus: null })
        }
      },

      saveFavorite: (name) =>
        set((s) => ({
          favorites: [
            ...s.favorites,
            {
              id: newId(),
              name: name.trim() || `Route ${s.favorites.length + 1}`,
              startLocation: s.startLocation,
              endLocation: s.endLocation,
              // Store plain coordinates; loading creates a fresh (all-active) list.
              waypoints: s.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
            },
          ],
        })),
      loadFavorite: (id) =>
        set((s) => {
          const fav = s.favorites.find((f) => f.id === id)
          if (!fav) return {}
          return {
            startLocation: fav.startLocation,
            endLocation: fav.endLocation,
            waypoints: toStops(fav.waypoints),
            optimizedRoute: null,
            routeError: null,
          }
        }),
      deleteFavorite: (id) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
    }),
    {
      name: 'route-optimiser:v2',
      version: 2,
      // Migrate old sessions: waypoints used to be plain {lat,lng}[], then Stops
      // without a stable `num`.
      migrate: (persisted, version) => {
        const s = persisted as { waypoints?: Array<LatLng & Partial<Stop>> }
        if (version < 2 && Array.isArray(s.waypoints)) {
          s.waypoints = s.waypoints.map((w, i) => ({
            id: w.id ?? newId(),
            num: w.num ?? i + 1,
            lat: w.lat,
            lng: w.lng,
            delivered: w.delivered ?? false,
          }))
        }
        return persisted as RouteState
      },
      partialize: (s) => ({
        startLocation: s.startLocation,
        endLocation: s.endLocation,
        waypoints: s.waypoints,
        targetK: s.targetK,
        objective: s.objective,
        optimizedRoute: s.optimizedRoute,
        favorites: s.favorites,
        routeMode: s.routeMode,
      }),
    },
  ),
)
