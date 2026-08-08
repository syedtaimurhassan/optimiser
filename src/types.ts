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

export interface PendingChange {
  id: string
  kind: PendingChangeKind
  stopId?: string
  payload?: unknown
}

/**
 * Edits made since the last optimisation, held back so the driver can see
 * "3 changes — reoptimise?" rather than having the route silently rearrange
 * itself while they are holding a parcel.
 */
export interface PendingChangeSet {
  changes: PendingChange[]
  /** A preview route computed from the staged changes, not yet committed. */
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
  /** Arrival time per entry of `orderedStopIds`, seconds from route start. */
  arrivalSec: number[]

  /** GeoJSON LineString of the driving route geometry ([lng, lat] pairs). */
  geometry: LineString
  distanceMeters: number
  durationSeconds: number
  /** How many candidate stops the route visits (excludes fixed start/end). */
  candidatesVisited: number
  candidatesTotal: number
  /** True when distance/duration are straight-line estimates (no road router). */
  estimated?: boolean
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
