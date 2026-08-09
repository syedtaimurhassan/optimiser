import { useRoutesStore, hydrateRoutesStore, SEARCH_TIERS_SEC } from './routesStore'
import { useSolverStore } from './solverStore'
import { useUiStore } from './uiStore'
import type { AddressedStop, LatLng, Objective, OptimizedRoute, Favorite } from '../types'
import { joinOrderedStopIds, matrixLayout, planSelectiveRoute } from '../lib/planRoute'
import { DEFAULT_DEPART_SEC } from '../lib/compute/solverPort'
import { warmUpSolver } from '../lib/solver'
import { activeSelection } from '../lib/compute/active'
import { describeSelection } from '../lib/compute/registry'
import { cumulativeArrivals, serviceSecFor } from '../lib/arrivals'
import {
  loadMatrix,
  matrixCacheKey,
  matrixKeysFor,
  saveMatrix,
  seedFromCache,
  toCachedMatrixFlat,
} from '../lib/costMatrix'

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

  /*
    Warm up the engine the registry picked.

    What used to be here: a `window.crossOriginIsolated` gate that, when false,
    set a warning telling the driver to go and find Chrome. That was true of
    OR-Tools — its WASM was built with pthreads and would not initialise without
    SharedArrayBuffer — and it meant the app refused to optimise at all on iOS
    Safari and Firefox. No engine in the production bundle needs isolation any
    more, so the gate is gone rather than merely relaxed.
  */
  warmUp: () => {
    const solver = useSolverStore.getState()
    const selection = activeSelection()
    solver.setEngine({ id: selection.engine.id, label: describeSelection(selection) })
    warmUpSolver()
      .then(() => solver.setReady(true))
      .catch((e: unknown) => solver.setWarning((e as Error).message))
  },

  calculateRoute: async () => {
    const solver = useSolverStore.getState()
    const state = routes()
    const route = state.activeRouteId ? state.routes[state.activeRouteId] : null
    if (!route) return

    solver.begin()
    const controller = new AbortController()
    solver.setAbortController(controller)
    try {
      const pending = route.stops.filter((s) => s.status === 'pending')

      /*
        What we already paid for, before deciding what to buy.

        The keys have to be computed BEFORE the solve now, not after it: the
        cached grid is an input. `matrixLayout` is the planner's own
        de-duplication rule, exported so both ends agree on what row 7 is by
        construction rather than by implementing the same rule twice.

        A failed cache read is a slower solve, never a wrong one — the seed is
        just an empty grid, and everything gets fetched.
      */
      const cacheKey = matrixCacheKey(route.id, route.optimizeBy)
      const layout = matrixLayout({
        startLocation: route.start,
        endLocation: route.end,
        waypoints: pending,
      })
      const matrixKeys = matrixKeysFor(
        layout.matrixWaypointIndex,
        pending.map((s) => s.id),
        Boolean(route.start),
      )
      const cached = await loadMatrix(cacheKey).catch(() => null)
      const seed = seedFromCache(cached, matrixKeys, route.optimizeBy)

      const result = await planSelectiveRoute({
        startLocation: route.start,
        endLocation: route.end,
        waypoints: pending,
        seed,
        targetK: route.targetK,
        objective: route.optimizeBy,
        timeBudgetMs: route.searchTierSec * 1000,
        // Everything the edit form can express, as a parallel array. The planner
        // never learns what a stop is; it is handed positions.
        stopConstraints: pending.map((stop) => ({
          serviceTimeSec: serviceSecFor(stop),
          twOpenSec: stop.twOpenSec,
          twCloseSec: stop.twCloseSec,
          order: stop.order,
        })),
        // A break already taken is not one to plan for.
        breaks: route.breaks
          .filter((rest) => !rest.taken)
          .map((rest) => ({
            earliestSec: rest.earliestSec,
            latestSec: rest.latestSec,
            durationSec: rest.durationSec,
          })),
        departAtSec: route.startSec ?? DEFAULT_DEPART_SEC,
        onStatus: (msg) => solver.setStatus(msg),
        signal: controller.signal,
        // The search reports its own progress now, so "Optimizing route…" can
        // say how it is getting on rather than only that it started.
        onProgress: ({ elapsedMs }) =>
          solver.setStatus(`Optimizing route… ${(elapsedMs / 1000).toFixed(1)}s`),
      })

      // Backfill the M2 fields the planner doesn't know about. `joinOrderedStopIds`
      // lives beside the planner because M8's commit path needs the identical
      // join, and two hand-rolled copies of it drift: this one used to keep only
      // the FIRST stop at a shared coordinate, which silently dropped the second
      // delivery to a building from the itinerary altogether.
      const orderedStopIds = joinOrderedStopIds(result.orderedWaypoints, pending)

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

      /*
        The grid fields are stripped here rather than spread into the route.
        `optimized` is persisted, and a Uint8Array mask in the Zustand blob
        would be re-serialised on every keystroke for the benefit of nobody who
        reads it — the cache is where the grid lives.
      */
      const {
        matrix,
        matrixN,
        matrixKnown,
        matrixWaypointIndex: _index,
        estimatedArcs: _estimated,
        matrixRequests: _requests,
        ...planned
      } = result
      const optimized: OptimizedRoute = {
        ...planned,
        orderedStopIds,
        arrivalSec: cumulativeArrivals({
          legSeconds: result.legSeconds,
          serviceSeconds,
          breaks: result.breaks,
        }),
      }

      /*
        Keep the grid we just paid for.

        M8's whole "Update route" model rests on this: inserting a stop into a
        solved round costs one row and one column, but only if the other 1,936
        cells are still lying around. The keys come from the planner's
        positional index list, so a matrix row is labelled with the stop's
        uuid rather than with where it happened to sit in this solve.

        Best effort, deliberately: a failed cache write must not fail the
        optimisation the driver actually asked for. The consequence of losing
        it is a slower insert later, not a wrong one.
      */
      await saveMatrix(
        cacheKey,
        toCachedMatrixFlat(matrix, matrixN, matrixKeys, route.optimizeBy, matrixKnown),
      ).catch((e: unknown) => console.warn('[routes] could not cache the cost matrix', e))

      state.setOptimized(optimized)
      state.setMatrixCacheKey(cacheKey)
      state.clearPending()
      solver.succeed()
    } catch (e) {
      // A cancelled solve leaves the previous route exactly where it was. Only
      // a genuine failure clears it, because a driver who cancels still needs
      // the itinerary they were driving.
      if ((e as Error).name === 'AbortError') {
        solver.cancelled()
        return
      }
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
