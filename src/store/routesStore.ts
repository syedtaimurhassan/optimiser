import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Address,
  AddressDefault,
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
import { toISODate, weekdayName } from '../lib/routeGrouping'
import {
  addressKey,
  applyDefault,
  defaultsFromStop,
} from '../lib/addressDefaults'
import { presetFor, presetHex, retargetGroup } from '../lib/groups'

export const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Today, in the device's own timezone.
 *
 * This used to be `new Date().toISOString().slice(0, 10)`, which is UTC: east
 * of Greenwich every route created after ~22:00 was dated tomorrow. Harmless
 * while nothing displayed the date; not harmless now that the drawer files
 * routes into dated sections and the create flow offers "Today".
 */
export const todayISO = (): string => toISODate(new Date())

/** Search tiers, in seconds — the model stores seconds, the solver wants ms. */
export const SEARCH_TIERS_SEC = [1, 3, 5] as const

interface RoutesState {
  // ── Persisted ──
  routes: Record<string, Route>
  activeRouteId: string | null
  favorites: Favorite[]
  /** Letter-block ("D7") or plain numeric ("37") stop labels. */
  stopIdMode: StopIdMode
  /**
   * Per-ADDRESS settings, remembered across routes and across days.
   *
   * Global rather than route-scoped on purpose — see lib/addressDefaults.ts.
   * Keyed by `addressKey`, which folds Danish characters so a geocoded address
   * and the same address typed from an ASCII keyboard are one door.
   */
  addressDefaults: Record<string, AddressDefault>

  // ── Route CRUD ──
  createRoute: (init?: Partial<Pick<Route, 'name' | 'dateISO'>>) => string
  duplicateRoute: (routeId: string) => string | null
  deleteRoute: (routeId: string) => void
  setActiveRoute: (routeId: string | null) => void
  renameRoute: (routeId: string, name: string) => void
  updateRouteMeta: (routeId: string, patch: Partial<Pick<Route, 'name' | 'dateISO'>>) => void
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
  addStops: (points: NewStopInput[]) => void
  insertStopNear: (nearStopId: string, point: LatLng) => string | null
  duplicateStop: (id: string) => string | null
  removeStop: (id: string) => void
  clearStops: () => void
  updateStop: (id: string, patch: Partial<AddressedStop>) => void
  resetStopIdsForActive: () => void
  setStopIdMode: (mode: StopIdMode) => void

  // ── Sticky per-address settings ──
  /** Remember this stop's settings for its address. Returns the key, or null. */
  saveAddressDefault: (stopId: string) => string | null
  /** Forget them. The star goes hollow and nothing is applied next time. */
  clearAddressDefault: (key: string) => void

  // ── Groups the driver picks, and the ones that pick themselves ──
  /** Find a group by name+colour on the active route, creating it if absent. */
  ensureGroup: (name: string, colorHex: string) => string | null

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

/**
 * A blank route for `dateISO`.
 *
 * An unnamed route is named after its weekday — "Wednesday". That is the
 * placeholder the create flow shows, and it is genuinely the most useful
 * default for someone who runs a round every day: it needs no typing and it
 * still distinguishes one route from the next.
 */
function makeRoute(init?: Partial<Pick<Route, 'name' | 'dateISO'>>): Route {
  const now = Date.now()
  const dateISO = init?.dateISO ?? todayISO()
  return {
    id: newId(),
    name: init?.name?.trim() || weekdayName(dateISO),
    dateISO,
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
/**
 * What it takes to create a stop: a coordinate, and optionally the address that
 * coordinate came from.
 *
 * A bare `LatLng` is still legal — that is what a file of coordinates and a
 * dropped pin both produce, and coordinate-only stops remain a supported shape
 * (see `AddressedStop.address`). The optional address is what M6 adds, so a
 * stop created from search arrives already knowing how to render itself rather
 * than being reverse-geocoded a second time to find out.
 */
export type NewStopInput = LatLng & { address?: Address }

function makeStop(
  point: NewStopInput,
  stopId: string,
  originalPosition: number,
  defaults: Record<string, AddressDefault> = {},
): AddressedStop {
  const base: AddressedStop = {
    id: newId(),
    stopId,
    originalPosition,
    lat: point.lat,
    lng: point.lng,
    address: point.address,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
  }

  /*
    Sticky settings are applied HERE, at creation, rather than looked up when
    the card renders. Two reasons, and the second is the important one:

     - a stop is a value the driver then edits, and a default that kept
       re-asserting itself would fight every edit;
     - the whole mechanic is worth having because a manifest of 44 addresses
       arrives already knowing the door codes. That only works if the defaults
       land as the stops are made.
  */
  const key = addressKey(point.address, point)
  // `kind` and `order` are already set above, so applyDefault's gap-filling
  // would never reach them. Clearing them first is what lets a saved "this
  // address is always a pickup" actually apply.
  const seeded = key
    ? applyDefault(
        { ...base, kind: undefined, order: undefined } as unknown as AddressedStop,
        defaults[key],
      )
    : base
  return { ...base, ...seeded, kind: seeded.kind ?? 'delivery', order: seeded.order ?? 'auto' }
}

export const useRoutesStore = create<RoutesState>()(
  persist(
    (set, get) => ({
      routes: {},
      activeRouteId: null,
      favorites: [],
      stopIdMode: 'letterBlock',
      addressDefaults: {},

      // ── Route CRUD ──

      createRoute: (init) => {
        const route = makeRoute(init)
        set((s) => ({ routes: { ...s.routes, [route.id]: route }, activeRouteId: route.id }))
        return route.id
      },

      /**
       * Copy a route as a fresh round for today.
       *
       * The point of duplicating is "same addresses, do it again", so what
       * carries over is everything about WHERE the driver goes and what the
       * stops are, and what does not carry over is everything about what
       * happened last time:
       *
       *  - statuses reset to pending, history cleared. A duplicate that
       *    arrived pre-delivered would be a lie, and an unfixable one.
       *  - photo refs dropped. They are proof of a specific delivery, and
       *    sharing the keys would let deleting one route destroy the other's
       *    evidence.
       *  - the optimisation, staged changes and matrix key are cleared: they
       *    describe a solve that hasn't been run for this route.
       *
       * Stop `id`s are new (they are internal join keys and must be unique),
       * but `stopId` LABELS are copied verbatim — D7 is D7 again, because it
       * is the same address in the same round and the label's whole value is
       * that it means one thing.
       *
       * Does not switch the active route: duplicating from the drawer should
       * not yank the driver out of the round they currently have open.
       */
      duplicateRoute: (routeId) => {
        const source = get().routes[routeId]
        if (!source) return null

        const now = Date.now()
        const copy: Route = {
          ...source,
          id: newId(),
          name: `${source.name} (copy)`,
          dateISO: todayISO(),
          status: 'draft',
          stops: source.stops.map((stop) => ({
            ...stop,
            id: newId(),
            status: 'pending',
            statusHistory: [],
            failureReason: undefined,
            failureNote: undefined,
            photoRefs: undefined,
            etaSec: undefined,
          })),
          // Group ids are route-scoped, so copying them verbatim keeps every
          // stop's groupId pointing at the right group in the new route.
          groups: source.groups.map((group) => ({ ...group })),
          breaks: source.breaks.map((brk) => ({ ...brk, taken: undefined })),
          optimized: undefined,
          pending: undefined,
          matrixCacheKey: undefined,
          createdAt: now,
          updatedAt: now,
        }

        set((s) => ({ routes: { ...s.routes, [copy.id]: copy } }))
        return copy.id
      },

      /**
       * Delete a route, leaving the app with something to show.
       *
       * Every screen assumes there is an active route, so deleting the active
       * one falls through to the newest remaining route — and deleting the
       * last one creates a blank route for today rather than leaving the app
       * pointing at nothing. Same invariant `hydrateRoutesStore` establishes
       * on a first run; it has to survive deletion too.
       */
      deleteRoute: (routeId) =>
        set((s) => {
          if (!s.routes[routeId]) return {}
          const routes = { ...s.routes }
          delete routes[routeId]

          if (s.activeRouteId !== routeId) return { routes, activeRouteId: s.activeRouteId }

          const newest = Object.values(routes).sort(
            (a, b) => b.dateISO.localeCompare(a.dateISO) || b.updatedAt - a.updatedAt,
          )[0]
          if (newest) return { routes, activeRouteId: newest.id }

          const replacement = makeRoute()
          return { routes: { [replacement.id]: replacement }, activeRouteId: replacement.id }
        }),

      setActiveRoute: (routeId) => set({ activeRouteId: routeId }),

      renameRoute: (routeId, name) =>
        set((s) => {
          const route = s.routes[routeId]
          if (!route) return {}
          return { routes: { ...s.routes, [routeId]: { ...route, name, updatedAt: Date.now() } } }
        }),

      /** Name and date together — the two fields "Set name and date" edits. */
      updateRouteMeta: (routeId, patch) =>
        set((s) => {
          const route = s.routes[routeId]
          if (!route) return {}
          const dateISO = patch.dateISO ?? route.dateISO
          // An omitted name leaves the name alone; a name the user CLEARED
          // falls back to the weekday of whatever date the route now has, so
          // a route is never nameless and the fallback tracks the date.
          const name =
            patch.name === undefined ? route.name : patch.name.trim() || weekdayName(dateISO)
          return {
            routes: {
              ...s.routes,
              [routeId]: { ...route, name, dateISO, updatedAt: Date.now() },
            },
          }
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
              return makeStop(p, stopId, originalPosition, s.addressDefaults)
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
            const stop = makeStop(point, stopId, r.stops[index].originalPosition, s.addressDefaults)
            created = stop.id
            const stops = [...r.stops]
            stops.splice(index + 1, 0, stop)
            return { ...r, stops }
          }),
        )
        return created
      },

      /**
       * "Duplicate stop" — a second parcel to the same address.
       *
       * Everything about WHERE and WHAT carries over; nothing about what
       * happened carries over. The copy is pending with an empty history, and
       * takes a decimal suffix off its source (D7 → D7.1) so no label already
       * written on a parcel is invalidated. It lands immediately after the
       * stop it came from, which is where a driver expects a second drop to
       * the same door to be.
       */
      duplicateStop: (id) => {
        let created: string | null = null
        set((s) =>
          withActiveRoute(s, (r) => {
            const index = r.stops.findIndex((st) => st.id === id)
            if (index === -1) return null
            const source = r.stops[index]
            const copy: AddressedStop = {
              ...source,
              id: newId(),
              stopId: allocateInsertedStopId(source.stopId, r.stops.map((st) => st.stopId)),
              status: 'pending',
              statusHistory: [],
              failureReason: undefined,
              failureNote: undefined,
              // Proof of a specific delivery. Sharing the keys would let
              // deleting one copy destroy the other's evidence.
              photoRefs: undefined,
              etaSec: undefined,
            }
            created = copy.id
            const stops = [...r.stops]
            stops.splice(index + 1, 0, copy)
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
            const updated = { ...stops[index], ...safe }
            stops[index] = updated

            /*
              Purple follows pickups, teal follows multi-parcel stops.

              Applied here rather than in the edit form so that EVERY caller
              gets it — the form, an importer, a future bulk edit — and so the
              rule cannot be half-implemented in one of them. `retargetGroup`
              decides; this performs, because creating a group is a store
              write and lib/ never touches the store.

              A group the driver chose deliberately is never overwritten; see
              lib/groups.ts.
            */
            const changesAuto = 'kind' in safe || 'parcelCount' in safe
            // An explicit groupId in the patch IS the deliberate choice, and
            // must not be second-guessed by the rule in the same breath.
            if (!changesAuto || 'groupId' in safe) return { ...r, stops }

            const retarget = retargetGroup(updated, r.groups)
            if (retarget === null) return { ...r, stops }
            if ('clear' in retarget) {
              stops[index] = { ...updated, groupId: undefined }
              return { ...r, stops }
            }

            const preset = presetFor(retarget.auto)
            const hex = presetHex(preset)
            const existing = r.groups.find((g) => g.name === preset.name && g.colorHex === hex)
            const group: StopGroup = existing ?? { id: newId(), name: preset.name, colorHex: hex }
            stops[index] = { ...updated, groupId: group.id }
            return { ...r, stops, groups: existing ? r.groups : [...r.groups, group] }
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

      // ── Sticky per-address settings ──

      saveAddressDefault: (stopId) => {
        const state = get()
        const route = state.activeRouteId ? state.routes[state.activeRouteId] : null
        const stop = route?.stops.find((st) => st.id === stopId)
        if (!stop) return null
        const key = addressKey(stop.address, stop)
        if (!key) return null
        set((s) => ({
          addressDefaults: { ...s.addressDefaults, [key]: defaultsFromStop(stop, Date.now()) },
        }))
        return key
      },

      clearAddressDefault: (key) =>
        set((s) => {
          if (!(key in s.addressDefaults)) return {}
          const next = { ...s.addressDefaults }
          delete next[key]
          return { addressDefaults: next }
        }),

      /**
       * Get-or-create, by NAME AND COLOUR.
       *
       * `addGroup` appends unconditionally, which is right for "the driver
       * made a group" and wrong for the automatic ones: retargeting a pickup
       * would otherwise add a second "Afternoon Pickup" to the route every
       * time a stop qualified.
       */
      ensureGroup: (name, colorHex) => {
        const state = get()
        const route = state.activeRouteId ? state.routes[state.activeRouteId] : null
        if (!route) return null
        const existing = route.groups.find((g) => g.name === name && g.colorHex === colorHex)
        if (existing) return existing.id
        const group: StopGroup = { id: newId(), name, colorHex }
        set((s) => withActiveRoute(s, (r) => ({ ...r, groups: [...r.groups, group] })))
        return group.id
      },

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
              // A reason belongs to a failure, not to a stop. Leaving it
              // behind would let a delivered stop display why it failed.
              ...(status === 'failed' ? null : { failureReason: undefined, failureNote: undefined }),
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
            // Falling back to 'pending' is correct: an empty history means the
            // stop has never left its initial state.
            const status = history[history.length - 1]?.status ?? 'pending'
            stops[index] = {
              ...stop,
              status,
              statusHistory: history,
              ...(status === 'failed' ? null : { failureReason: undefined, failureNote: undefined }),
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
                : {
                    ...st,
                    status: 'pending' as const,
                    statusHistory: [...st.statusHistory, { status: 'pending' as const, atMs: Date.now() }],
                    failureReason: undefined,
                    failureNote: undefined,
                  },
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
              makeStop(p, stopIdForPosition(i + 1, s.stopIdMode), i + 1, s.addressDefaults),
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
        // Additive, so no version bump: a blob written before M7 simply has no
        // `addressDefaults` key, and zustand's shallow merge leaves the initial
        // {} in place.
        addressDefaults: s.addressDefaults,
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
        // Unnamed: makeRoute names it after its weekday, which is the same
        // default the create-route flow offers.
        else state.createRoute()
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
