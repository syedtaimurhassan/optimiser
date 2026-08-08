import { useRoutesStore, hydrateRoutesStore, SEARCH_TIERS_SEC } from './routesStore'
import { useSolverStore } from './solverStore'
import { useUiStore } from './uiStore'
import type { AddressedStop, LatLng, Objective, OptimizedRoute, Favorite } from '../types'
import { planSelectiveRoute } from '../lib/planRoute'
import { warmUpSolver } from '../lib/solver'
import { cumulativeArrivals, serviceSecFor } from '../lib/arrivals'

/**
 * Compatibility facade over the M2 stores.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * M2 replaces the single-session model with many dated routes, but M3–M8
 * replace every one of these components anyway. Rewriting ~20 components onto
 * the new stores now would be throwaway work with real regression risk, so the
 * shape they already expect is projected over the new model instead.
 *
 * The alternative — rewriting the components — was rejected on cost, not
 * principle. This layer is scaffolding and should shrink to nothing by M8; if
 * it is still here afterwards, something went wrong.
 *
 * ── The referential-stability problem ─────────────────────────────────────
 *
 * Zustand re-renders when a selector's RESULT changes by identity. A facade
 * that rebuilt its view object on every call would hand back fresh arrays and
 * fresh closures each time, so every selector would look "changed" and every
 * component would re-render on every store write — quietly destroying the
 * narrow-selector discipline this codebase depends on, right before M4 makes
 * the map much more expensive.
 *
 * Two devices keep it honest:
 *   - actions are module-level constants, so their identity never changes;
 *   - the legacy stop projection is memoised against the underlying `stops`
 *     array by WeakMap, so it stays reference-stable until the stops actually
 *     change.
 */

/** The legacy stop shape: an AddressedStop plus the two fields old components read. */
export interface LegacyStop extends AddressedStop {
  /** Was the stable display number. Now the original position. */
  num: number
  delivered: boolean
}

/**
 * Memoised legacy projection.
 *
 * Keyed on the `stops` array identity, which routesStore only replaces when the
 * stops genuinely change — so `useRouteStore((s) => s.waypoints)` returns the
 * same array reference across unrelated updates and does not re-render.
 */
const projectionCache = new WeakMap<AddressedStop[], LegacyStop[]>()
const EMPTY_STOPS: AddressedStop[] = []
const EMPTY_LEGACY: LegacyStop[] = []

function legacyStops(stops: AddressedStop[]): LegacyStop[] {
  if (stops.length === 0) return EMPTY_LEGACY
  const cached = projectionCache.get(stops)
  if (cached) return cached
  const projected = stops.map((s) => ({
    ...s,
    num: s.originalPosition,
    delivered: s.status === 'delivered',
  }))
  projectionCache.set(stops, projected)
  return projected
}

// ─────────────────────────────────────────────────────────────── actions

const routes = () => useRoutesStore.getState()

/**
 * Stable action identities. Defined once at module scope so a selector picking
 * an action always gets the same function back.
 */
const ACTIONS = {
  setStart: (value: LatLng | null) => routes().setStart(value),
  setEnd: (value: LatLng | null) => routes().setEnd(value),
  addWaypoints: (points: LatLng[]) => routes().addStops(points),
  removeWaypoint: (id: string) => routes().removeStop(id),
  clearWaypoints: () => routes().clearStops(),
  markDelivered: (id: string) => routes().setStopStatus(id, 'delivered'),
  restoreStop: (id: string) => routes().undoStopStatus(id),
  restoreAll: () => routes().restoreAllStops(),
  setTargetK: (k: number | null) => routes().setTargetK(k),
  setObjective: (objective: Objective) => routes().setObjective(objective),
  setRouteMode: (mode: 'fixed' | 'open') => routes().setEndpointMode(mode),
  setSearchQuality: (quality: SearchQuality) => routes().setSearchTierSec(SEARCH_BUDGET_SEC[quality]),
  saveFavorite: (name: string) => routes().saveFavorite(name),
  loadFavorite: (id: string) => routes().loadFavorite(id),
  deleteFavorite: (id: string) => routes().deleteFavorite(id),
  resetAll: () => routes().resetActiveRoute(),

  setHoveredStopId: (id: string | null) => useUiStore.getState().setHoveredStopId(id),
  setMapPlacementMode: (mode: 'start' | 'end' | null) =>
    useUiStore.getState().setMapPlacementMode(mode),

  /**
   * Mark delivered by coordinate.
   *
   * Retained only because old components call it. It is the exact ambiguity M2
   * exists to remove — two deliveries to one building share a coordinate — so
   * it now resolves to the FIRST pending match rather than silently marking
   * every stop at that location. Callers should move to `markDelivered(id)`.
   */
  markDeliveredByCoord: (lat: number, lng: number) => {
    const route = routes().routes[routes().activeRouteId ?? '']
    if (!route) return
    const match =
      route.stops.find((s) => s.lat === lat && s.lng === lng && s.status === 'pending') ??
      route.stops.find((s) => s.lat === lat && s.lng === lng)
    if (match) routes().setStopStatus(match.id, 'delivered')
  },

  warmUp: () => {
    const solver = useSolverStore.getState()
    if (typeof window !== 'undefined' && window.crossOriginIsolated) {
      warmUpSolver()
        .then(() => solver.setReady(true))
        .catch((e: unknown) => solver.setWarning((e as Error).message))
    } else {
      solver.setWarning(
        'This browser did not enable the isolation the optimizer needs ' +
          '(SharedArrayBuffer). Please use the latest Chrome or Edge.',
      )
    }
  },

  calculateRoute: async () => {
    const solver = useSolverStore.getState()
    const state = routes()
    const route = state.activeRouteId ? state.routes[state.activeRouteId] : null
    if (!route) return

    solver.begin()
    try {
      const pending = route.stops.filter((s) => s.status === 'pending')
      const result = await planSelectiveRoute({
        startLocation: route.start,
        endLocation: route.end,
        waypoints: pending,
        targetK: route.targetK,
        objective: route.optimizeBy,
        timeBudgetMs: route.searchTierSec * 1000,
        onStatus: (msg) => solver.setStatus(msg),
      })

      // Backfill the M2 fields the planner doesn't know about yet. Coordinate
      // lookup is the only join available until the planner is updated (M7);
      // it is recorded as derived data, never relied on for identity.
      const byCoord = new Map<string, string>()
      for (const s of pending) {
        const key = `${s.lat},${s.lng}`
        if (!byCoord.has(key)) byCoord.set(key, s.id)
      }
      const orderedStopIds = result.orderedWaypoints.map(
        (p) => byCoord.get(`${p.lat},${p.lng}`) ?? null,
      )

      /*
        Arrival times, at last.

        The pipeline knows the drive between each pair of points; only the
        caller knows how long the driver stands at each one, because service
        time is a property of a STOP and the pipeline never sees stops. So the
        join happens here: `orderedStopIds` maps each ordered point back to its
        stop, and an endpoint that is not a stop costs nothing.
      */
      const byId = new Map(pending.map((s) => [s.id, s]))
      const serviceSeconds = orderedStopIds.map((id) => {
        const stop = id ? byId.get(id) : undefined
        return stop ? serviceSecFor(stop) : 0
      })

      const optimized: OptimizedRoute = {
        ...result,
        orderedStopIds,
        arrivalSec: cumulativeArrivals({ legSeconds: result.legSeconds, serviceSeconds }),
      }

      state.setOptimized(optimized)
      state.clearPending()
      solver.succeed()
    } catch (e) {
      routes().setOptimized(null)
      solver.fail((e as Error).message)
    }
  },
} as const

// ───────────────────────────────────────────────────────── legacy tiers

export type SearchQuality = 'fast' | 'deep' | 'maximum'

/** The old names, in seconds. The model stores seconds; the solver wants ms. */
export const SEARCH_BUDGET_SEC: Record<SearchQuality, number> = {
  fast: SEARCH_TIERS_SEC[0],
  deep: SEARCH_TIERS_SEC[1],
  maximum: SEARCH_TIERS_SEC[2],
}

const qualityForSeconds = (sec: number): SearchQuality =>
  sec <= 1 ? 'fast' : sec >= 5 ? 'maximum' : 'deep'

// ──────────────────────────────────────────────────────────── the view

export interface LegacyRouteView {
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LegacyStop[]
  targetK: number | null
  objective: Objective
  optimizedRoute: OptimizedRoute | null
  favorites: Favorite[]
  routeMode: 'fixed' | 'open'
  searchQuality: SearchQuality
}

export type LegacyStoreView = LegacyRouteView & typeof ACTIONS

function legacyView(s: ReturnType<typeof useRoutesStore.getState>): LegacyStoreView {
  const route = s.activeRouteId ? s.routes[s.activeRouteId] : null
  return {
    startLocation: route?.start ?? null,
    endLocation: route?.end ?? null,
    waypoints: legacyStops(route?.stops ?? EMPTY_STOPS),
    targetK: route?.targetK ?? null,
    objective: route?.optimizeBy ?? 'duration',
    optimizedRoute: route?.optimized ?? null,
    favorites: s.favorites,
    routeMode: route?.endpointMode ?? 'fixed',
    searchQuality: qualityForSeconds(route?.searchTierSec ?? 3),
    ...ACTIONS,
  }
}

/**
 * Drop-in replacement for the old `useRouteStore`.
 *
 * Only reads route state. Solver and UI slices moved to `useSolverStore` and
 * `useUiStore`; keeping them here would mean every solver status tick woke up
 * every component reading a route field.
 */
export function useRouteStore<T>(selector: (state: LegacyStoreView) => T): T {
  return useRoutesStore((s) => selector(legacyView(s)))
}

/** Non-reactive read, mirroring `useRouteStore.getState()`. */
useRouteStore.getState = (): LegacyStoreView => legacyView(useRoutesStore.getState())

export { hydrateRoutesStore as hydrateRouteStore }
