import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LatLng, OptimizedRoute } from '../types'
import { planSelectiveRoute } from '../lib/planRoute'
import { warmUpSolver } from '../lib/solver'

interface RouteState {
  // --- Persisted (the user's work) ---
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LatLng[]
  targetK: number | null
  optimizedRoute: OptimizedRoute | null

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
  calculateRoute: () => Promise<void>
  resetAll: () => void
  warmUp: () => void
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      startLocation: null,
      endLocation: null,
      waypoints: [],
      targetK: null,
      optimizedRoute: null,

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

      resetAll: () =>
        set({
          startLocation: null,
          endLocation: null,
          waypoints: [],
          targetK: null,
          optimizedRoute: null,
          routeError: null,
        }),

      // Preload the OR-Tools WASM in the background (idempotent). If the browser
      // never became cross-origin isolated, surface a clear warning instead.
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

      // The full pipeline lives here (event-driven), not in a component.
      calculateRoute: async () => {
        const { startLocation, endLocation, waypoints, targetK } = get()
        if (!startLocation || !endLocation) return
        set({ isCalculating: true, routeError: null, calcStatus: null })
        try {
          const k = targetK ?? waypoints.length
          const route = await planSelectiveRoute(
            startLocation,
            waypoints,
            endLocation,
            k,
            (msg) => set({ calcStatus: msg }),
          )
          set({ optimizedRoute: route, solverReady: true })
        } catch (e) {
          set({ optimizedRoute: null, routeError: (e as Error).message })
        } finally {
          set({ isCalculating: false, calcStatus: null })
        }
      },
    }),
    {
      name: 'route-optimiser:v2',
      // Persist only the user's work — never transient UI status.
      partialize: (s) => ({
        startLocation: s.startLocation,
        endLocation: s.endLocation,
        waypoints: s.waypoints,
        targetK: s.targetK,
        optimizedRoute: s.optimizedRoute,
      }),
    },
  ),
)
