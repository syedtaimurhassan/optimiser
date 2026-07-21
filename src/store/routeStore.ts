import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LatLng, OptimizedRoute, Favorite } from '../types'
import type { Objective } from '../lib/routingService'
import { planSelectiveRoute } from '../lib/planRoute'
import { warmUpSolver } from '../lib/solver'

interface RouteState {
  // --- Persisted (the user's work) ---
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LatLng[]
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
  removeWaypoint: (index: number) => void
  clearWaypoints: () => void
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
        set((s) => ({ waypoints: [...s.waypoints, ...points] })),
      removeWaypoint: (index) =>
        set((s) => ({ waypoints: s.waypoints.filter((_, i) => i !== index) })),
      clearWaypoints: () => set({ waypoints: [] }),
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
            waypoints,
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
              waypoints: s.waypoints,
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
            waypoints: fav.waypoints,
            optimizedRoute: null,
            routeError: null,
          }
        }),
      deleteFavorite: (id) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
    }),
    {
      name: 'route-optimiser:v2',
      // Persist the user's work + favorites — never transient UI status.
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
