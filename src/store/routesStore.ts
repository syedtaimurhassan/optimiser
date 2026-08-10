import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Address,
  AddressDefault,
  AddressedStop,
  LatLng,
  Objective,
  OptimizedRoute,
  NewPendingChange,
  PendingChange,
  PendingChangeSet,
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
import { ROUTES_PERSIST_KEY, sweepOrphanPhotos } from '../lib/persistence/db'
import { bootPersistence } from '../lib/persistence/boot'
import { toISODate, weekdayName } from '../lib/routeGrouping'
import {
  addressKey,
  applyDefault,
  defaultsFromStop,
} from '../lib/addressDefaults'
import { presetFor, presetHex, retargetGroup } from '../lib/groups'
import type { NavApp } from '../lib/googleMaps'
import { dropChange, foldChange, splitPatch, stagedStop, stagedStops } from '../lib/staging'

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
   * Which app a Navigate tap opens, or null until the driver has been asked.
   *
   * A setting rather than transient UI, so it lives here and not in uiStore:
   * being asked which map to use once per session, forty-four stops into a
   * round, is the behaviour this field exists to prevent.
   */
  navApp: NavApp | null
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
  /** When the driver leaves, seconds from local midnight. Anchors every window. */
  setStartSec: (seconds: number) => void
  setTargetK: (k: number | null) => void
  setOptimized: (optimized: OptimizedRoute | null) => void
  /** Where the solve's cost matrix was cached. See lib/costMatrix.ts. */
  setMatrixCacheKey: (cacheKey: string | null) => void

  // ── Stop CRUD ──
  /**
   * Add stops. Returns the new stops' uuids, in order.
   *
   * On a route that has been optimised these are STAGED rather than appended —
   * see lib/staging.ts — so the returned ids name stops that live in the
   * change set and are not yet in `route.stops`. Callers that want to open
   * what they just made must use the return value; reaching into the stops
   * array for "the last one" no longer finds it.
   */
  addStops: (points: NewStopInput[]) => string[]
  insertStopNear: (nearStopId: string, point: LatLng) => string | null
  duplicateStop: (id: string) => string | null
  removeStop: (id: string) => void
  /** Remove without staging — for the bulk sheet, which confirms by name and count. */
  removeStopNow: (id: string) => void
  clearStops: () => void
  updateStop: (id: string, patch: Partial<AddressedStop>) => void
  resetStopIdsForActive: () => void
  setStopIdMode: (mode: StopIdMode) => void
  setNavApp: (app: NavApp) => void

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
  /** Pin a stop to a position without reoptimising. The model for M8's moves. */
  moveStop: (id: string, toIndex: number) => void
  /** Drop one staged change — the review screen's per-row undo. */
  dropPendingChange: (changeId: string) => void
  /**
   * Publish a freshly computed preview, plus the labels the added stops earned
   * from where they landed. One action rather than two so a row can never
   * render a D7.1 that the provisional route does not place next to D7.
   */
  setProvisional: (
    provisional: OptimizedRoute | null,
    labels?: Record<string, { stopId: string; originalPosition: number }>,
  ) => void
  /** Commit the staged set: new stops, new plan, empty change set, one write. */
  applyStagedChanges: (result: { stops: AddressedStop[]; optimized: OptimizedRoute }) => void
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

// ────────────────────────────────────────────────────────────── staging

/**
 * Is this route in a state where an edit has to be reviewed first?
 *
 * The line is `optimized`, and it is the only defensible one. A route that has
 * never been solved has no sequence to protect and no parcels sorted against
 * it — staging there would put a review screen in front of the ordinary act of
 * building a round, which is most of what M6 is for. A solved route is the
 * opposite: the order on screen is the order in the van.
 */
const staging = (route: Route): boolean => Boolean(route.optimized)

/** Fold new changes into the route's set, dropping the now-stale preview. */
function stage(route: Route, changes: readonly NewPendingChange[]): PendingChangeSet {
  const at = Date.now()
  let folded = route.pending?.changes ?? []
  for (const change of changes) {
    folded = foldChange(folded, { ...change, id: newId(), at } as PendingChange)
  }
  // The preview described the previous set and is now a lie. Clearing it here
  // rather than letting it linger is what stops the review screen showing ETAs
  // for a change the driver has already taken back.
  return { changes: folded }
}

const stagedAddIds = (route: Route): Set<string> =>
  new Set((route.pending?.changes ?? []).filter((c) => c.kind === 'add').map((c) => c.stopId))

/**
 * Purple follows pickups, teal follows multi-parcel stops.
 *
 * Lives in the store rather than in the edit form so that EVERY caller gets it
 * — the form, an importer, a future bulk edit — and so the rule cannot be
 * half-implemented in one of them. `retargetGroup` decides; this performs,
 * because creating a group is a store write and lib/ never touches the store.
 *
 * A group the driver chose deliberately is never overwritten; see lib/groups.ts.
 */
function autoGroup(
  route: Route,
  updated: AddressedStop,
  applied: Partial<AddressedStop>,
): { patch: Partial<AddressedStop>; groups: StopGroup[] } {
  const unchanged = { patch: {}, groups: route.groups }
  const changesAuto = 'kind' in applied || 'parcelCount' in applied
  // An explicit groupId in the patch IS the deliberate choice, and must not be
  // second-guessed by the rule in the same breath.
  if (!changesAuto || 'groupId' in applied) return unchanged

  const retarget = retargetGroup(updated, route.groups)
  if (retarget === null) return unchanged
  if ('clear' in retarget) return { patch: { groupId: undefined }, groups: route.groups }

  const preset = presetFor(retarget.auto)
  const hex = presetHex(preset)
  const existing = route.groups.find((g) => g.name === preset.name && g.colorHex === hex)
  const group: StopGroup = existing ?? { id: newId(), name: preset.name, colorHex: hex }
  return {
    patch: { groupId: group.id },
    groups: existing ? route.groups : [...route.groups, group],
  }
}

/** Take a stop off the route for real, releasing any endpoint it anchored. */
function removeStopFrom(route: Route, id: string): Route | null {
  const stop = route.stops.find((st) => st.id === id)
  if (!stop) return null
  const sameCoord = (p: LatLng | null) => !!p && p.lat === stop.lat && p.lng === stop.lng
  return {
    ...route,
    stops: route.stops.filter((st) => st.id !== id),
    // A change naming a stop that no longer exists would be an unreviewable
    // diff — and one that the review screen could not render a row for.
    pending: route.pending
      ? { changes: route.pending.changes.filter((c) => c.stopId !== id) }
      : undefined,
    // Removing the stop that was an endpoint releases that anchor.
    start: sameCoord(route.start) ? null : route.start,
    end: sameCoord(route.end) ? null : route.end,
  }
}

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
      navApp: null,
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
      setStartSec: (seconds) => set((s) => withActiveRoute(s, (r) => ({ ...r, startSec: seconds }))),
      setTargetK: (k) => set((s) => withActiveRoute(s, (r) => ({ ...r, targetK: k }))),
      setOptimized: (optimized) =>
        set((s) => withActiveRoute(s, (r) => ({ ...r, optimized: optimized ?? undefined }))),
      setMatrixCacheKey: (cacheKey) =>
        set((s) => withActiveRoute(s, (r) => ({ ...r, matrixCacheKey: cacheKey ?? undefined }))),

      // ── Stop CRUD ──

      addStops: (points) => {
        const created: string[] = []
        set((s) =>
          withActiveRoute(s, (r) => {
            if (points.length === 0) return null
            const taken = new Set(stagedStops(r).map((st) => st.stopId))
            let highest = highestOriginalPosition(stagedStops(r))
            const added = points.map((p) => {
              const { stopId, originalPosition } = allocateAppendedStopId(highest, taken, s.stopIdMode)
              taken.add(stopId)
              highest = originalPosition
              return makeStop(p, stopId, originalPosition, s.addressDefaults)
            })
            created.push(...added.map((st) => st.id))

            /*
              On an optimised route this STAGES rather than appends.

              The label allocated here is provisional: it continues the
              original numbering (E1, E2…) because that is all an appended stop
              can be told at this point. `setProvisional` relabels it to a
              decimal off whichever stop it actually lands beside once the
              preview knows where that is — see lib/insertStops.ts.
            */
            if (!staging(r)) return { ...r, stops: [...r.stops, ...added] }
            return {
              ...r,
              pending: stage(
                r,
                added.map((stop) => ({ kind: 'add' as const, stopId: stop.id, stop })),
              ),
            }
          }),
        )
        return created
      },

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
            const all = stagedStops(r)
            const index = all.findIndex((st) => st.id === id)
            if (index === -1) return null
            const source = all[index]
            const copy: AddressedStop = {
              ...source,
              id: newId(),
              stopId: allocateInsertedStopId(source.stopId, all.map((st) => st.stopId)),
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
            if (staging(r)) {
              return { ...r, pending: stage(r, [{ kind: 'add', stopId: copy.id, stop: copy }]) }
            }
            const stops = [...r.stops]
            stops.splice(index + 1, 0, copy)
            return { ...r, stops }
          }),
        )
        return created
      },

      /**
       * Remove a stop.
       *
       * On an optimised route this STAGES: the stop stays put, wearing a red
       * chip, keeping its sequence number and its ETA, until the driver
       * applies. That the number is retained is the point — a removal that
       * renumbered the rest of the round on the spot would invalidate the
       * order the parcels are sorted in, which is the thing this milestone
       * exists to protect.
       */
      removeStop: (id) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            if (!staging(r)) return removeStopFrom(r, id)
            const stop = stagedStops(r).find((st) => st.id === id)
            if (!stop) return null
            return { ...r, pending: stage(r, [{ kind: 'remove', stopId: id }]) }
          }),
        ),

      /**
       * Remove now, no staging.
       *
       * The bulk sheet's path. It already confirms by name and count, and
       * routing a confirmed destructive action through a second review is one
       * gate too many — the driver would learn to clear both without reading.
       */
      removeStopNow: (id) => set((s) => withActiveRoute(s, (r) => removeStopFrom(r, id))),

      clearStops: () => set((s) => withActiveRoute(s, (r) => ({ ...r, stops: [], pending: undefined }))),

      /**
       * Edit a stop.
       *
       * ── Not every edit is a change to the ROUTE ─────────────────────────
       *
       * The patch is split: fields the plan depends on — the coordinates, the
       * time window, the service time, the order constraint, the type — stage
       * for review, and everything else writes straight through as it always
       * has. `lib/staging.ts` owns which is which.
       *
       * A door code cannot move a stop or shift an ETA, and a review screen
       * that filled up with door codes would teach the driver to apply without
       * reading — which is the single behaviour this whole milestone exists to
       * prevent. The split is here rather than in the form so an importer or a
       * bulk edit gets it too, for the same reason `retargetGroup` is here.
       */
      updateStop: (id, patch) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            // stopId and originalPosition are immutable by design: the only way
            // to change them is an explicit "Reset Stop IDs".
            const { stopId: _s, originalPosition: _o, id: _i, ...all } = patch

            /*
              A stop that is ITSELF staged is edited in place inside its own
              `add`, whatever the field. There is no row in `stops` to write to
              and no diff worth showing: "added a stop, then set its door code"
              is one change to the route, not two.
            */
            if (stagedAddIds(r).has(id)) {
              const merged = { ...stagedStop(r, id)!, ...all }
              const auto = autoGroup(r, merged, all)
              return {
                ...r,
                groups: auto.groups,
                pending: stage(r, [
                  { kind: 'edit', stopId: id, patch: { ...all, ...auto.patch } },
                ]),
              }
            }

            const { planned, direct } = staging(r)
              ? splitPatch(all)
              : { planned: {}, direct: all }

            const index = r.stops.findIndex((st) => st.id === id)
            if (index === -1) return null

            const pending =
              Object.keys(planned).length > 0
                ? stage(r, [{ kind: 'edit', stopId: id, patch: planned }])
                : r.pending

            const stops = [...r.stops]
            const updated = { ...stops[index], ...direct }
            const auto = autoGroup(r, updated, direct)
            stops[index] = { ...updated, ...auto.patch }
            return { ...r, stops, groups: auto.groups, pending }
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
      setNavApp: (navApp) => set({ navApp }),

      // ── Sticky per-address settings ──

      saveAddressDefault: (stopId) => {
        const state = get()
        const route = state.activeRouteId ? state.routes[state.activeRouteId] : null
        /*
          The STAGED stop, not the committed one.

          "Set Default ☆" means "remember what I have just set". A driver who
          changes the time at this door to five minutes and then stars it is
          asking for five minutes to be remembered — and the change is sitting
          in the change set, so reading the committed stop would silently save
          the value they just replaced.
        */
        const stop = route ? stagedStop(route, stopId) : null
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
            /*
              A stop that is still staged can be delivered before it is applied
              — the driver added the door they were standing at, then knocked.
              The status folds into the add, because there is no row in `stops`
              to write it to and silently doing nothing would leave the card
              showing "pending" after a deliberate tap.
            */
            if (stagedAddIds(r).has(id)) {
              const stop = stagedStop(r, id)!
              if (stop.status === status) return null
              return {
                ...r,
                pending: stage(r, [
                  {
                    kind: 'edit',
                    stopId: id,
                    patch: {
                      status,
                      statusHistory: [...stop.statusHistory, { status, atMs: Date.now() }],
                      ...(status === 'failed'
                        ? null
                        : { failureReason: undefined, failureNote: undefined }),
                    },
                  },
                ]),
              }
            }

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

      /**
       * Pin a stop to a position.
       *
       * A move is a remove plus an insert at a pinned index — the optimiser is
       * not consulted and nothing else shifts until commit. The model is here
       * and both commit algorithms honour it; the drag gesture that would
       * produce one is deferred, because reordering by drag against a
       * dynamically-measured virtualiser is a milestone of its own.
       */
      moveStop: (id, toIndex) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            if (!staging(r)) return null
            if (!stagedStops(r).some((st) => st.id === id)) return null
            return { ...r, pending: stage(r, [{ kind: 'move', stopId: id, toIndex }]) }
          }),
        ),

      dropPendingChange: (changeId) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            if (!r.pending) return null
            const changes = dropChange(r.pending.changes, changeId)
            if (changes.length === r.pending.changes.length) return null
            // Down to nothing is out of staged mode entirely, not an empty set
            // — otherwise the review screen stays reachable with nothing in it.
            return { ...r, pending: changes.length === 0 ? undefined : { changes } }
          }),
        ),

      setProvisional: (provisional, labels) =>
        set((s) =>
          withActiveRoute(s, (r) => {
            if (!r.pending) return null
            const changes = labels
              ? r.pending.changes.map((c) =>
                  c.kind === 'add' && labels[c.stopId]
                    ? { ...c, stop: { ...c.stop, ...labels[c.stopId] } }
                    : c,
                )
              : r.pending.changes
            return { ...r, pending: { changes, provisional: provisional ?? undefined } }
          }),
        ),

      /**
       * Commit. One write, so the route is never momentarily a new plan over
       * old stops — which is exactly the frame in which every ETA is wrong.
       */
      applyStagedChanges: ({ stops, optimized }) =>
        set((s) => withActiveRoute(s, (r) => ({ ...r, stops, optimized, pending: undefined }))),

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
        // Additive too, and null until the driver picks — see stopIdMode's
        // precedent: a blob written before M13 simply has no `navApp` key.
        navApp: s.navApp,
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

      // Reclaim photos nothing points at any more. After hydration, because
      // "what is still referenced" is not knowable until the routes are in
      // memory — and fire-and-forget, because a driver opening the app must
      // never wait on housekeeping. See db.ts for why this is a sweep.
      void sweepOrphanPhotos(livePhotoRefs(useRoutesStore.getState().routes)).catch(() => {})
    })().catch((e) => {
      console.error('[routes] hydration failed; continuing with an empty store', e)
    })
  }
  return hydrationPromise
}

/**
 * Every photo ref any stop still holds, staged additions included.
 *
 * A staged add is a whole stop living in the change set rather than on the
 * route, so a photo taken on one is referenced by something `route.stops`
 * does not contain. Missing them here would delete a photo the driver took
 * ninety seconds ago.
 */
function livePhotoRefs(routes: Record<string, Route>): Set<string> {
  const refs = new Set<string>()
  for (const route of Object.values(routes)) {
    for (const stop of route.stops) for (const ref of stop.photoRefs ?? []) refs.add(ref)
    for (const change of route.pending?.changes ?? []) {
      if (change.kind === 'add') for (const ref of change.stop.photoRefs ?? []) refs.add(ref)
    }
  }
  return refs
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
