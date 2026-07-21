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

  // --- Transient (never persisted) ---
  isCalculating: boolean
  calcStatus: string | null
  routeError: string | null
  solverReady: boolean
  solverWarning: string | null

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

const toStops = (points: LatLng[]): Stop[] =>
  points.map((p) => ({ id: newId(), lat: p.lat, lng: p.lng, delivered: false }))

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

      isCalculating: false,
      calcStatus: null,
      routeError: null,
      solverReady: false,
      solverWarning: null,

      setStart: (value) => set({ startLocation: value }),
      setEnd: (value) => set({ endLocation: value }),
      addWaypoints: (points) =>
        set((s) => ({ waypoints: [...s.waypoints, ...toStops(points)] })),
      removeWaypoint: (id) =>
        set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),
      clearWaypoints: () => set({ waypoints: [] }),
      markDelivered: (id) =>
        set((s) => ({
          waypoints: s.waypoints.map((w) =>
            w.id === id ? { ...w, delivered: true } : w,
          ),
        })),
      markDeliveredByCoord: (lat, lng) =>
        set((s) => ({
          waypoints: s.waypoints.map((w) =>
            w.lat === lat && w.lng === lng ? { ...w, delivered: true } : w,
          ),
        })),
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
      version: 1,
      // Migrate pre-Stop sessions: waypoints used to be plain {lat,lng}[].
      migrate: (persisted, version) => {
        const s = persisted as { waypoints?: Array<LatLng & Partial<Stop>> }
        if (version < 1 && Array.isArray(s.waypoints)) {
          s.waypoints = s.waypoints.map((w) =>
            'id' in w && 'delivered' in w
              ? w
              : { id: newId(), lat: w.lat, lng: w.lng, delivered: false },
          )
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
      }),
    },
  ),
)
