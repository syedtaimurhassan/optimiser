import type { LatLng } from '../types'
import { detectPlatform, type Platform } from './device/capabilities.ts'

/**
 * Hand-off to a navigation app.
 *
 * We do not navigate. We hand the driver's ordered route to something that
 * does, by URL, and the whole job is producing links the target app will not
 * quietly truncate.
 *
 * ── The three-waypoint trap ───────────────────────────────────────────────
 *
 * This file used to export `MAX_WAYPOINTS_PER_URL = 9` and call it "the
 * conservative, documented value". It is not the documented value for the only
 * device this app runs on. Google's Maps URLs documentation:
 *
 *   "The number of waypoints allowed varies by the platform where the link
 *    opens, with up to three waypoints supported on mobile browsers, and a
 *    maximum of nine waypoints supported otherwise."
 *   — https://developers.google.com/maps/documentation/urls/get-started
 *
 * A PWA *is* a mobile browser. So every hand-off this app has ever produced
 * from a route with more than three intermediate stops has been handed to
 * Google over its limit. The cap is now a property of the platform, and the
 * default is the mobile one — an over-chunked route costs a driver one extra
 * tap, an under-chunked one silently loses stops.
 *
 * ── Waze and Apple Maps are worse, and it is not our fault ────────────────
 *
 * Neither supports intermediate stops in a URL at all:
 *
 *   Waze  — parameters are `ll`, `q`, `navigate`, `z`, `favorite` and the
 *           avoidance flags. There is no waypoint parameter.
 *           https://developers.google.com/waze/deeplinks
 *   Apple — `saddr`, `daddr`, `dirflg`. Only `daddr` is required, and no
 *           multi-stop parameter is documented.
 *           https://developer.apple.com/library/archive/featuredarticles/
 *             iPhoneURLScheme_Reference/MapLinks/MapLinks.html
 *
 * That is a cap of ZERO intermediate waypoints, not a different feature — and
 * because the batching rule is "origin + cap waypoints + destination, sharing
 * one boundary point with the next batch", a cap of zero falls out of the same
 * chunker as one link per hop. So all three apps go through one code path and
 * differ only in their cap and their URL shape.
 */

export type NavApp = 'google' | 'waze' | 'apple'

const MAPS_BASE = 'https://www.google.com/maps'
const WAZE_BASE = 'https://waze.com/ul'
const APPLE_BASE = 'https://maps.apple.com/'

/** Google's documented ceiling when the link opens in a mobile browser. */
export const GOOGLE_WAYPOINTS_MOBILE = 3
/** Google's documented ceiling everywhere else. */
export const GOOGLE_WAYPOINTS_DESKTOP = 9

/**
 * How many intermediate waypoints Google will accept from THIS device.
 *
 * `unknown` is treated as mobile deliberately: the failure modes are not
 * symmetric. Guessing mobile on a desktop produces more links than necessary;
 * guessing desktop on a phone produces links that drop stops.
 */
export function googleWaypointCap(platform: Platform = detectPlatform()): number {
  return platform === 'desktop' ? GOOGLE_WAYPOINTS_DESKTOP : GOOGLE_WAYPOINTS_MOBILE
}

/** Google Maps expects "lat,lng" (note: the reverse of OSRM's "lng,lat"). */
function coord(p: LatLng): string {
  return `${p.lat},${p.lng}`
}

// ------------------------------------------------------------------ single

/** A "search" link that drops a pin on a single coordinate. */
export function googleMapsSearchUrl(point: LatLng): string {
  const params = new URLSearchParams({ api: '1', query: coord(point) })
  return `${MAPS_BASE}/search/?${params.toString()}`
}

/**
 * Waze, straight into turn-by-turn.
 *
 * `navigate=yes` is what separates "show me this place" from "take me there";
 * without it Waze opens the map and waits for another tap, which is the tap we
 * are trying to save.
 */
export function wazeNavigateUrl(point: LatLng): string {
  const params = new URLSearchParams({ ll: coord(point), navigate: 'yes' })
  return `${WAZE_BASE}?${params.toString()}`
}

/**
 * Apple Maps, driving directions.
 *
 * `saddr` is omitted rather than sent empty when we have no origin — an empty
 * `saddr` is not the same request as an absent one, and the absent form is the
 * one that means "from wherever I am".
 */
export function appleMapsDirectionsUrl(destination: LatLng, origin?: LatLng | null): string {
  const params = new URLSearchParams()
  if (origin) params.set('saddr', coord(origin))
  params.set('daddr', coord(destination))
  params.set('dirflg', 'd')
  return `${APPLE_BASE}?${params.toString()}`
}

/** Open one place in the driver's chosen app. */
export function navPlaceUrl(app: NavApp, point: LatLng, origin?: LatLng | null): string {
  switch (app) {
    case 'waze':
      return wazeNavigateUrl(point)
    case 'apple':
      return appleMapsDirectionsUrl(point, origin)
    default:
      return googleMapsSearchUrl(point)
  }
}

// ----------------------------------------------------------------- batches

export interface DirectionsBatch {
  url: string
  /** 0-based index (in the ordered sequence) of this batch's origin. */
  fromIndex: number
  /** 0-based index of this batch's destination. */
  toIndex: number
}

interface BatchSpec {
  /** Intermediate waypoints this app accepts per URL. Zero is legal. */
  cap: number
  url(origin: LatLng, destination: LatLng, waypoints: LatLng[]): string
}

/**
 * Split an ordered stop sequence (start first, end last) into chained legs.
 *
 * Each batch's destination is the next batch's origin, so following them in
 * order traverses the whole route without gaps — which is the property the
 * tests assert, because it is the one a driver would notice being wrong only
 * after driving past a stop.
 */
function batchesFor(ordered: LatLng[], spec: BatchSpec): DirectionsBatch[] {
  if (ordered.length < 2) return []

  // Points consumed per batch. We advance by (cap + 1) so consecutive batches
  // share exactly one boundary point (prev destination === next origin).
  const step = spec.cap + 1
  const batches: DirectionsBatch[] = []

  for (let i = 0; i < ordered.length - 1; i += step) {
    const segment = ordered.slice(i, i + step + 1) // origin + up to cap wp + destination
    const origin = segment[0]
    const destination = segment[segment.length - 1]
    const waypoints = segment.slice(1, -1)

    batches.push({
      url: spec.url(origin, destination, waypoints),
      fromIndex: i,
      toIndex: i + segment.length - 1,
    })
  }

  return batches
}

function googleLegUrl(origin: LatLng, destination: LatLng, waypoints: LatLng[]): string {
  const params = new URLSearchParams({
    api: '1',
    origin: coord(origin),
    destination: coord(destination),
    travelmode: 'driving',
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(coord).join('|'))
  }
  return `${MAPS_BASE}/dir/?${params.toString()}`
}

function specFor(app: NavApp, platform: Platform): BatchSpec {
  switch (app) {
    case 'waze':
      // Waze cannot be told where you are starting from, only where to go.
      return { cap: 0, url: (_origin, destination) => wazeNavigateUrl(destination) }
    case 'apple':
      return { cap: 0, url: (origin, destination) => appleMapsDirectionsUrl(destination, origin) }
    default:
      return { cap: googleWaypointCap(platform), url: googleLegUrl }
  }
}

/**
 * Google Maps Directions URLs for an ordered sequence.
 *
 * The cap is injectable so tests can state a platform instead of inheriting
 * whatever the test runner's user agent happens to be.
 */
export function googleMapsDirectionsBatches(
  ordered: LatLng[],
  cap: number = googleWaypointCap(),
): DirectionsBatch[] {
  return batchesFor(ordered, { cap, url: googleLegUrl })
}

/** The same, for whichever app the driver picked. */
export function navDirectionsBatches(
  app: NavApp,
  ordered: LatLng[],
  platform: Platform = detectPlatform(),
): DirectionsBatch[] {
  return batchesFor(ordered, specFor(app, platform))
}
