import type { LineString } from 'geojson'

/** A geographic coordinate pair. The core data shape used across the app. */
export interface LatLng {
  lat: number
  lng: number
}

/** Result of parsing an uploaded file into waypoints, plus any per-row issues. */
export interface ParseResult {
  waypoints: LatLng[]
  errors: string[]
}

// ─────────────────────────────────────────────────────────────── stops

export type StopStatus = 'pending' | 'delivered' | 'failed'
export type StopKind = 'delivery' | 'pickup'

/** Whether the optimiser may move a stop, or must pin it to an end of the route. */
export type OrderConstraint = 'auto' | 'first' | 'last'

/** Where an address came from — geocoded, typed by hand, or reverse-geocoded. */
export type AddressSource = 'geocoder' | 'manual' | 'reverse' | 'import'

/**
 * A postal address, split the way a route row renders it:
 *
 *   title     "Løvfrøvej 6"
 *   subtitle  "Bagsværd, 2880"
 *
 * The split is stored rather than derived because only the geocoder knows which
 * part is the street line for a given country, and re-deriving it from
 * `formatted` would mean parsing addresses — which is the problem geocoders
 * exist to solve.
 */
export interface Address {
  title: string
  subtitle: string
  /** Full single-line form, when the provider gives one. */
  formatted?: string
  street?: string
  area?: string
  postcode?: string
  country?: string
  /** Provider's own id, for re-lookup without re-geocoding. */
  providerPlaceId?: string
  source: AddressSource
}

/** One transition in a stop's lifecycle. Drives Undo and the "Marked as delivered 16:13" line. */
export interface StatusChange {
  status: StopStatus
  atMs: number
}

/**
 * A stop on a route.
 *
 * Two identity fields, and the distinction is the point:
 *
 *   `id`      internal uuid — what code joins on. Never shown.
 *   `stopId`  the IMMUTABLE display label ("D7"). Assigned once from
 *             `originalPosition` and never recomputed, so a driver can write it
 *             on a parcel and it still means that parcel after three
 *             reoptimisations. See lib/stopIds.ts.
 *
 * A stop's position in the current route is deliberately NOT stored here — it
 * is a property of the route's ordering, not of the stop.
 */
export interface AddressedStop extends LatLng {
  id: string
  stopId: string
  /** 1-based position at creation. Set once, never changed except by an explicit "Reset Stop IDs". */
  originalPosition: number

  /** Optional: coordinate-only stops remain legal, which is what M1 data migrates to. */
  address?: Address

  recipient?: string
  notes?: string
  accessCodes?: string
  /** Free text to help find the parcel in the van, e.g. "back left, red crate". */
  packageFinder?: string
  parcelCount?: number

  kind: StopKind
  groupId?: string

  /** Time window, seconds from local midnight. */
  twOpenSec?: number
  twCloseSec?: number
  /** How long the driver spends at this stop. */
  serviceTimeSec?: number

  order: OrderConstraint

  /** Keys into the IndexedDB photos store. Never inline blobs — see lib/persistence/db.ts. */
  photoRefs?: string[]

  /**
   * Barcode payloads the driver has linked to this stop.
   *
   * A carrier's tracking barcode means nothing to us on its own — it is not an
   * address, an id, or anything we can look up. Linking one makes it mean this
   * stop, and thereafter scanning the box lands on this card. Which is the
   * whole point of `stopId` being immutable: the link survives every
   * reoptimisation, because neither end of it is a position.
   *
   * An array because one delivery can be several parcels, and a driver holding
   * the third box should get the same card as the first.
   */
  barcodes?: string[]

  status: StopStatus
  statusHistory: StatusChange[]

  /**
   * Why a delivery failed — a short reason from a picklist, plus free text.
   *
   * OUR INVENTION. Spoke's screenshots show the failed state but never the
   * capture, so the flow is designed rather than copied: the tap marks the
   * stop immediately and the reason is a skippable follow-up. Cleared whenever
   * the stop leaves the failed state, so a stop can never display a reason for
   * a failure that has been undone.
   */
  failureReason?: string
  failureNote?: string

  /** Derived from the last optimisation. Recomputed, never authoritative. */
  etaSec?: number
}

/**
 * What a driver has told us about an ADDRESS, rather than about one delivery.
 *
 * Saved by "Set Default ☆" and applied whenever a stop is created at the same
 * address on any route, on any day — which is the whole point, and why it is a
 * global slice rather than something on a route. See lib/addressDefaults.ts
 * for what is deliberately excluded (groups, notes, recipients).
 */
export interface AddressDefault {
  kind: StopKind
  order: OrderConstraint
  parcelCount?: number
  serviceTimeSec?: number
  accessCodes?: string
  packageFinder?: string
  twOpenSec?: number
  twCloseSec?: number
  updatedAt: number
}

/** A colour-coded grouping, e.g. a building, a customer, or a run. */
export interface StopGroup {
  id: string
  name: string
  colorHex: string
}

/** A rest break the optimiser must fit into the day. */
export interface RouteBreak {
  id: string
  earliestSec: number
  latestSec: number
  durationSec: number
  taken?: boolean
}

// ─────────────────────────────────────────────────────── staged changes

export type PendingChangeKind = 'add' | 'remove' | 'move' | 'edit'

interface PendingChangeBase {
  id: string
  /**
   * The stop's UUID — its `id`, never its `stopId` display label.
   *
   * The field name is M2's and is kept for continuity, but the meaning is
   * fixed here: two stops can share a label after a "Reset Stop IDs", and
   * joining on one is the identity bug M2 spent a milestone removing.
   */
  stopId: string
  /** When it was staged. Orders the review screen's sections stably. */
  at: number
}

/**
 * One staged edit.
 *
 * An `add` carries the WHOLE stop rather than a reference to one, because a
 * staged stop does not exist on the route yet. That is what makes Discard a
 * single assignment — drop the change set and there is nothing to unwind, no
 * stop to delete, no label to release, no removal to resurrect. The
 * alternative, writing the stop in and flagging it, turns Discard into an
 * unwind, and an unwind is where the bugs live.
 */
export type PendingChange =
  | (PendingChangeBase & { kind: 'add'; stop: AddressedStop })
  | (PendingChangeBase & { kind: 'remove' })
  | (PendingChangeBase & { kind: 'move'; toIndex: number })
  | (PendingChangeBase & { kind: 'edit'; patch: Partial<AddressedStop> })

/**
 * A change as a caller supplies it — the store assigns `id` and `at`.
 *
 * Written as a distributive conditional rather than a plain `Omit`, which over
 * a union keeps only the keys every member shares and would silently reduce
 * this to "kind and stopId".
 */
export type NewPendingChange =
  PendingChange extends infer C ? (C extends PendingChange ? Omit<C, 'id' | 'at'> : never) : never

/**
 * Edits made since the last optimisation, held back so the driver can review
 * "2 changes" before the route rearranges itself under a parcel they are
 * already holding.
 *
 * The driver has PHYSICALLY SORTED the van to match the sequence on screen. An
 * app that silently reoptimises destroys that; one that silently appends
 * produces a stupid route. So nothing moves until they say so, and when they
 * do it is a choice between two models — see `lib/insertStops.ts`.
 */
export interface PendingChangeSet {
  changes: PendingChange[]
  /**
   * A preview route computed from the staged changes, not yet committed.
   *
   * Follows the "Update route" model, because that is the one the review
   * screen is previewing the consequences of: the other model's whole promise
   * is that everything moves, which no per-row ETA can usefully show in
   * advance.
   */
  provisional?: OptimizedRoute
}

// ─────────────────────────────────────────────────────────────── routes

export type RouteStatus = 'draft' | 'active' | 'completed'

/** What the optimiser minimises. */
export type Objective = 'duration' | 'distance'

/** Whether endpoints are pinned or chosen by the optimiser. */
export type EndpointMode = 'fixed' | 'open'

export interface Route {
  id: string
  name: string
  /** Calendar day, ISO yyyy-mm-dd. Indexed in IndexedDB — this is how routes are listed. */
  dateISO: string
  status: RouteStatus

  start: LatLng | null
  end: LatLng | null
  /** `open` means the optimiser picks both endpoints; `start`/`end` are then null. */
  endpointMode: EndpointMode

  stops: AddressedStop[]
  groups: StopGroup[]
  breaks: RouteBreak[]

  optimizeBy: Objective
  /**
   * When the driver leaves, seconds from local midnight.
   *
   * Time windows are absolute times of day, so they mean nothing without one.
   * Undefined on every route created before M11 and read through
   * `DEFAULT_DEPART_SEC` (08:00), which is why there is no migration: the
   * default IS the old behaviour, since the old behaviour had no windows.
   *
   * Deliberately not "whenever you tapped Calculate". A route solved at 08:00
   * and re-solved at 14:00 must produce the same plan — one whose shape depends
   * on when you asked is not a plan.
   */
  startSec?: number
  /** Search-effort ceiling in SECONDS (1 / 3 / 5). Stored in seconds, not ms, per the model. */
  searchTierSec: number
  /** Max stops to visit, or null for "all". */
  targetK: number | null

  optimized?: OptimizedRoute
  pending?: PendingChangeSet
  /** Key into the IndexedDB matrices store, so a reoptimise can skip the OSRM fetch. */
  matrixCacheKey?: string

  createdAt: number
  updatedAt: number
}

// ────────────────────────────────────────────────────────────── results

/** The optimised route. */
export interface OptimizedRoute {
  /**
   * The full stop sequence in visiting order, as coordinates.
   * Retained so existing map/itinerary code keeps working unchanged.
   */
  orderedWaypoints: LatLng[]
  /**
   * The same sequence as stop `id`s — the authoritative one.
   *
   * Coordinates cannot identify a stop: two deliveries to one building share a
   * coordinate exactly, and every lookup keyed on `lat,lng` silently merges
   * them. Fixed properly in M2; `orderedWaypoints` survives only for
   * compatibility and should be treated as derived.
   *
   * Endpoints that are not themselves stops contribute a `null`.
   */
  orderedStopIds: (string | null)[]
  /**
   * Arrival time per entry of `orderedStopIds`, seconds from ROUTE START.
   *
   * Relative, not a wall clock, and deliberately so: a route solved at 08:00
   * and opened at 14:00 has not changed shape, only when it is happening. The
   * clock is computed at render time by `lib/arrivals.ts`, which anchors the
   * plan to where the driver actually is.
   */
  arrivalSec: number[]

  /**
   * Per-leg driving seconds and metres for the ordered point list.
   *
   * Length is `orderedStopIds.length - 1` — one entry per consecutive pair.
   * OSRM returns these on every route response and M2's pipeline threw them
   * away; they are what makes an arrival time real rather than a share of a
   * total. Optional because a route solved before M7 has neither.
   */
  legSeconds?: number[]
  legMeters?: number[]

  /** GeoJSON LineString of the driving route geometry ([lng, lat] pairs). */
  geometry: LineString
  distanceMeters: number
  durationSeconds: number
  /** How many candidate stops the route visits (excludes fixed start/end). */
  candidatesVisited: number
  candidatesTotal: number
  /** True when distance/duration are straight-line estimates (no road router). */
  estimated?: boolean

  /**
   * False when the plan misses at least one time window.
   *
   * Undefined on any route solved before M11, which is why every reader treats
   * undefined as "nothing to report" rather than as false — an old route did not
   * fail its windows, it was never asked about them.
   */
  feasible?: boolean
  /** Total lateness in seconds across the whole route. */
  timeWarpSec?: number
  /**
   * How late each entry of `orderedStopIds` is against its own closing time.
   *
   * Per stop rather than a single total, because "this route is 38 minutes late"
   * is not something a driver can act on and "D7 closes at 14:00, you arrive
   * 14:38" is.
   */
  lateBySec?: number[]
  /** Rest breaks, and where they landed. Seconds from route start. */
  breaks?: { afterIndex: number; durationSec: number; startSec: number }[]
}

// ──────────────────────────────────────────────────────────── favorites

/** A saved, named scenario the user can reload later. */
export interface Favorite {
  id: string
  name: string
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LatLng[]
}
