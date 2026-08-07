import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AddressedStop,
  LatLng,
  Objective,
  OptimizedRoute,
  PendingChange,
  PendingChangeKind,
  Route,
  RouteBreak,
  StopGroup,
  StopStatus,
  Favorite,
  EndpointMode,
} from '../types'
import {
  allocateAppendedStopId,
  allocateInsertedStopId,
  resetStopIds,
  stopIdForPosition,
  type StopIdMode,
} from '../lib/stopIds'
import { indexedDbStorage } from '../lib/persistence/zustandStorage'
import { ROUTES_PERSIST_KEY } from '../lib/persistence/db'
import { bootPersistence } from '../lib/persistence/boot'

export const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const todayISO = (): string => new Date().toISOString().slice(0, 10)

/** Search tiers, in seconds — the model stores seconds, the solver wants ms. */
export const SEARCH_TIERS_SEC = [1, 3, 5] as const

interface RoutesState {
  // ── Persisted ──
  routes: Record<string, Route>
  activeRouteId: string | null
  favorites: Favorite[]
  /** Letter-block ("D7") or plain numeric ("37") stop labels. */
  stopIdMode: StopIdMode

  // ── Route CRUD ──
  createRoute: (init?: Partial<Pick<Route, 'name' | 'dateISO'>>) => string
  deleteRoute: (routeId: string) => void
  setActiveRoute: (routeId: string | null) => void
  renameRoute: (routeId: string, name: string) => void
  setRouteStatus: (routeId: string, status: Route['status']) => void
  listRoutes: () => Route[]
  listRoutesByDate: (dateISO: string) => Route[]

  // ── Route settings ──
  setStart: (value: LatLng | null) => void
  setEnd: (value: LatLng | null) => void
  setEndpointMode: (mode: EndpointMode) => void
  setObjective: (objective: Objective) => void
  setSearchTierSec: (seconds: number) => void
  setTargetK: (k: number | null) => void
  setOptimized: (optimized: OptimizedRoute | null) => void

  // ── Stop CRUD ──
  addStops: (points: LatLng[]) => void
  insertStopNear: (nearStopId: string, point: LatLng) => string | null
  removeStop: (id: string) => void
  clearStops: () => void
  updateStop: (id: string, patch: Partial<AddressedStop>) => void
  resetStopIdsForActive: () => void
  setStopIdMode: (mode: StopIdMode) => void

  // ── Status transitions (reversible, timestamped) ──
  setStopStatus: (id: string, status: StopStatus) => void
  undoStopStatus: (id: string) => void
  restoreAllStops: () => void

  // ── Groups & breaks ──
  addGroup: (name: string, colorHex: string) => string
  removeGroup: (groupId: string) => void
  addBreak: (b: Omit<RouteBreak, 'id'>) => string
  removeBreak: (breakId: string) => void

  // ── Staged changes ──
  stageChange: (kind: PendingChangeKind, stopId?: string, payload?: unknown) => void
  clearPending: () => void

  // ── Favorites ──
  saveFavorite: (name: string) => void
  loadFavorite: (id: string) => void
  deleteFavorite: (id: string) => void

  resetActiveRoute: () => void
}

/** A blank route for `dateISO`. */
function makeRoute(init?: Partial<Pick<Route, 'name' | 'dateISO'>>): Route {
  const now = Date.now()
  return {
    id: newId(),
    name: init?.name ?? 'Untitled route',
    dateISO: init?.dateISO ?? todayISO(),
    status: 'draft',
    start: null,
    end: null,
    endpointMode: 'fixed',
    stops: [],
    groups: [],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Apply `mutate` to the active route.
 *
 * Every write goes through here so `updatedAt` can't be forgotten, and so an
 * action fired with no active route is a no-op rather than a crash. Returns a
 * partial state, or `{}` when there's nothing to change — which also means
 * Zustand skips the notification and nothing re-renders.
 */
function withActiveRoute(
  state: RoutesState,
  mutate: (route: Route) => Route | null,
): Partial<RoutesState> {
  const id = state.activeRouteId
  if (!id) return {}
  const current = state.routes[id]
  if (!current) return {}
  const next = mutate(current)
  if (!next || next === current) return {}
  return { routes: { ...state.routes, [id]: { ...next, updatedAt: Date.now() } } }
}

/** Highest original position used so far — appends continue from here. */
const highestOriginalPosition = (stops: AddressedStop[]): number =>
  stops.reduce((max, s) => Math.max(max, s.originalPosition), 0)

/** A new stop with sensible defaults. */
function makeStop(
  point: LatLng,
  stopId: string,
  originalPosition: number,
): AddressedStop {
  return {
    id: newId(),
    stopId,
    originalPosition,
    lat: point.lat,
    lng: point.lng,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
  }
}

export const useRoutesStore = create<RoutesState>()(
  persist(
    (set, get) => ({
      routes: {},
      activeRouteId: null,
      favorites: [],
      stopIdMode: 'letterBlock',

      // ── Route CRUD ──

      createRoute: (init) => {
        const route = makeRoute(init)
        set((s) => ({ routes: { ...s.routes, [route.id]: route }, activeRouteId: route.id }))
        return route.id
      },

      deleteRoute: (routeId) =>
        set((s) => {
          const routes = { ...s.routes }
          delete routes[routeId]
          const activeRouteId =
            s.activeRouteId === routeId ? (Object.keys(routes)[0] ?? null) : s.activeRouteId
          return { routes, activeRouteId }
        }),

      setActiveRoute: (routeId) => set({ activeRouteId: routeId }),

      renameRoute: (routeId, name) =>
        set((s) => {
          const route = s.routes[routeId]
          if (!route) return {}
          return { routes: { ...s.routes, [routeId]: { ...route, name, updatedAt: Date.now() } } }
        }),

      setRouteStatus: (routeId, status) =>
        set((s) => {
          const route = s.routes[routeId]
          if (!route) return {}
          return { routes: { ...s.routes, [routeId]: { ...route, status, updatedAt: Date.now() } } }
        }),

      listRoutes: () =>
        Object.values(get().routes).sort(
          (a, b) => b.dateISO.localeCompare(a.dateISO) || b.updatedAt - a.updatedAt,
        ),

      listRoutesByDate: (dateISO) =>
        Object.values(get().routes)
          .filter((r) => r.dateISO === dateISO)
          .sort((a, b) => b.updatedAt - a.updatedAt),

      // ── Route settings ──

      setStart: (value) => set((s) => withActiveRoute(s, (r) => ({ ...r, start: value }))),
      setEnd: (value) => set((s) => withActiveRoute(s, (r) => ({ ...r, end: value }))),

      setEndpointMode: (mode) =>
        set((s) =>
          withActiveRoute(s, (r) =>
            mode === 'open'
              ? { ...r, endpointMode: 'open', start: null, end: null }
              : { ...r, endpointMode: 'fixed' },
          ),
        ),

      setObjective: (objective) => set((s) => withActiveRoute(s, (r) => ({ ...r, optimizeBy: objective }))),
      setSearchTierSec: (seconds) => set((s) => withActiveRoute(s, (r) => ({ ...r, searchTierSec: seconds }))),
      setTargetK: (k) => set((s) => withActiveRoute(s, (r) => ({ ...r, targetK: k }))),
      setOptimized: (optimized) =>
        set((s) => withActiveRoute(s, (r) => ({ ...r, optimized: optimized ?? undefined }))),

      // ── Stop CRUD ──

      addStops: (points) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            if (points.length === 0) return null
            const taken = new Set(r.stops.map((st) => st.stopId))
            let highest = highestOriginalPosition(r.stops)
            const added = points.map((p) => {
              const { stopId, originalPosition } = allocateAppendedStopId(highest, taken, s.stopIdMode)
              taken.add(stopId)
              highest = originalPosition
              return makeStop(p, stopId, originalPosition)
            })
            return { ...r, stops: [...r.stops, ...added] }
          }),
        ),

      /**
       * Insert a stop beside an existing one. The new stop takes a decimal
       * suffix off its neighbour (D7 → D7.1) so nothing else is renumbered —
       * every label already written on a parcel stays valid.
       */
      insertStopNear: (nearStopId, point) => {
        let created: string | null = null
        set((s) =>
          withActiveRoute(s, (r) => {
            const index = r.stops.findIndex((st) => st.stopId === nearStopId)
            if (index === -1) return null
            const stopId = allocateInsertedStopId(nearStopId, r.stops.map((st) => st.stopId))
            // Inherits the neighbour's original position: it belongs to that
            // part of the original round, which is what "Originally 37th" means.
            const stop = makeStop(point, stopId, r.stops[index].originalPosition)
            created = stop.id
            const stops = [...r.stops]
            stops.splice(index + 1, 0, stop)
            return { ...r, stops }
          }),
        )
        return created
      },

      removeStop: (id) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            const stop = r.stops.find((st) => st.id === id)
            if (!stop) return null
            const sameCoord = (p: LatLng | null) => !!p && p.lat === stop.lat && p.lng === stop.lng
            return {
              ...r,
              stops: r.stops.filter((st) => st.id !== id),
              // Removing the stop that was an endpoint releases that anchor.
              start: sameCoord(r.start) ? null : r.start,
              end: sameCoord(r.end) ? null : r.end,
            }
          }),
        ),

      clearStops: () => set((s) => withActiveRoute(s, (r) => ({ ...r, stops: [] }))),

      updateStop: (id, patch) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            const index = r.stops.findIndex((st) => st.id === id)
            if (index === -1) return null
            const stops = [...r.stops]
            // stopId and originalPosition are immutable by design: the only way
            // to change them is an explicit "Reset Stop IDs".
            const { stopId: _s, originalPosition: _o, id: _i, ...safe } = patch
            stops[index] = { ...stops[index], ...safe }
            return { ...r, stops }
          }),
        ),

      /**
       * "Reset Stop IDs" — relabel every stop from its CURRENT position.
       *
       * Deliberately destructive: it invalidates every label already written on
       * a parcel, which is why it is only ever an explicit user action.
       */
      resetStopIdsForActive: () =>
        set((s) =>
          withActiveRoute(s, (r) => {
            const identities = resetStopIds(r.stops.length, s.stopIdMode)
            return {
              ...r,
              stops: r.stops.map((st, i) => ({ ...st, ...identities[i] })),
            }
          }),
        ),

      setStopIdMode: (mode) => set({ stopIdMode: mode }),

      // ── Status transitions ──

      /**
       * Record a status change with its timestamp. History is append-only, which
       * is what makes both Undo and the "Marked as delivered 16:13" line possible.
       */
      setStopStatus: (id, status) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            const index = r.stops.findIndex((st) => st.id === id)
            if (index === -1) return null
            const stop = r.stops[index]
            if (stop.status === status) return null
            const stops = [...r.stops]
            stops[index] = {
              ...stop,
              status,
              statusHistory: [...stop.statusHistory, { status, atMs: Date.now() }],
            }
            return { ...r, stops }
          }),
        ),

      /** Step back one transition — delivered/failed → whatever preceded it. */
      undoStopStatus: (id) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            const index = r.stops.findIndex((st) => st.id === id)
            if (index === -1) return null
            const stop = r.stops[index]
            if (stop.statusHistory.length === 0 && stop.status === 'pending') return null
            const history = stop.statusHistory.slice(0, -1)
            const stops = [...r.stops]
            stops[index] = {
              ...stop,
              // Falling back to 'pending' is correct: an empty history means the
              // stop has never left its initial state.
              status: history[history.length - 1]?.status ?? 'pending',
              statusHistory: history,
            }
            return { ...r, stops }
          }),
        ),

      restoreAllStops: () =>
        set((s) =>
          withActiveRoute(s, (r) => ({
            ...r,
            stops: r.stops.map((st) =>
              st.status === 'pending'
                ? st
                : { ...st, status: 'pending' as const, statusHistory: [...st.statusHistory, { status: 'pending' as const, atMs: Date.now() }] },
            ),
          })),
        ),

      // ── Groups & breaks ──

      addGroup: (name, colorHex) => {
        const group: StopGroup = { id: newId(), name, colorHex }
        set((s) => withActiveRoute(s, (r) => ({ ...r, groups: [...r.groups, group] })))
        return group.id
      },

      removeGroup: (groupId) =>
        set((s) =>
          withActiveRoute(s, (r) => ({
            ...r,
            groups: r.groups.filter((g) => g.id !== groupId),
            // Don't leave stops pointing at a group that no longer exists.
            stops: r.stops.map((st) => (st.groupId === groupId ? { ...st, groupId: undefined } : st)),
          })),
        ),

      addBreak: (b) => {
        const entry: RouteBreak = { ...b, id: newId() }
        set((s) => withActiveRoute(s, (r) => ({ ...r, breaks: [...r.breaks, entry] })))
        return entry.id
      },

      removeBreak: (breakId) =>
        set((s) => withActiveRoute(s, (r) => ({ ...r, breaks: r.breaks.filter((x) => x.id !== breakId) }))),

      // ── Staged changes ──

      stageChange: (kind, stopId, payload) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            const change: PendingChange = { id: newId(), kind, stopId, payload }
            return {
              ...r,
              pending: { changes: [...(r.pending?.changes ?? []), change], provisional: r.pending?.provisional },
            }
          }),
        ),

      clearPending: () => set((s) => withActiveRoute(s, (r) => ({ ...r, pending: undefined }))),

      // ── Favorites ──

      saveFavorite: (name) =>
        set((s) => {
          const route = s.activeRouteId ? s.routes[s.activeRouteId] : null
          if (!route) return {}
          return {
            favorites: [
              ...s.favorites,
              {
                id: newId(),
                name: name.trim() || `Route ${s.favorites.length + 1}`,
                startLocation: route.start,
                endLocation: route.end,
                waypoints: route.stops.map((st) => ({ lat: st.lat, lng: st.lng })),
              },
            ],
          }
        }),

      loadFavorite: (id) =>
        set((s) => {
          const fav = s.favorites.find((f) => f.id === id)
          if (!fav) return {}
          return withActiveRoute(s, (r) => ({
            ...r,
            start: fav.startLocation,
            end: fav.endLocation,
            stops: fav.waypoints.map((p, i) =>
              makeStop(p, stopIdForPosition(i + 1, s.stopIdMode), i + 1),
            ),
            optimized: undefined,
            pending: undefined,
          }))
        }),

      deleteFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      resetActiveRoute: () =>
        set((s) =>
          withActiveRoute(s, (r) => ({
            ...r,
            start: null,
            end: null,
            stops: [],
            targetK: null,
            optimized: undefined,
            pending: undefined,
          })),
        ),
    }),
    {
      name: ROUTES_PERSIST_KEY,
      version: 4,
      storage: createJSONStorage(() => indexedDbStorage),
      // Rehydration must not start before the 3 → 4 migration has written the
      // blob it reads. See lib/persistence/boot.ts.
      skipHydration: true,
      partialize: (s) => ({
        routes: s.routes,
        activeRouteId: s.activeRouteId,
        favorites: s.favorites,
        stopIdMode: s.stopIdMode,
      }),
    },
  ),
)

/** Boot persistence, then rehydrate. Idempotent; never rejects. */
let hydrationPromise: Promise<void> | null = null

export function hydrateRoutesStore(): Promise<void> {
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      await bootPersistence()
      await useRoutesStore.persist.rehydrate()
      // A first run has no routes at all; the app needs one to be usable.
      const state = useRoutesStore.getState()
      if (!state.activeRouteId || !state.routes[state.activeRouteId]) {
        const existing = Object.keys(state.routes)[0]
        if (existing) state.setActiveRoute(existing)
        else state.createRoute({ name: "Today's route" })
      }
    })().catch((e) => {
      console.error('[routes] hydration failed; continuing with an empty store', e)
    })
  }
  return hydrationPromise
}

// ───────────────────────────────────────────────────────────── selectors

/**
 * Narrow selectors, kept as module-level functions so their identity is stable
 * and a subscription re-renders only when its own slice changes. The map and
 * itinerary get far more expensive in M4 — this discipline is what keeps a
 * status tick from re-rendering them.
 */
export const selectActiveRoute = (s: RoutesState): Route | null =>
  s.activeRouteId ? (s.routes[s.activeRouteId] ?? null) : null

export const selectStops = (s: RoutesState): AddressedStop[] =>
  selectActiveRoute(s)?.stops ?? EMPTY_STOPS

export const selectPendingStops = (s: RoutesState): AddressedStop[] =>
  selectStops(s).filter((st) => st.status === 'pending')

/** Stable empty array — a fresh `[]` each call would defeat reference equality. */
const EMPTY_STOPS: AddressedStop[] = []
