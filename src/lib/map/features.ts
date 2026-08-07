import type { Feature, FeatureCollection, Point } from 'geojson'
import type { AddressedStop, OptimizedRoute, Route, StopGroup } from '../../types'
import { chipSpecFor, type ChipSpec, type StagedKind } from './chipSpec.ts'
import { formatLatLng } from '../coordinates.ts'

/**
 * Stops → GeoJSON, ready for a MapLibre symbol layer.
 *
 * Everything the layer needs is precomputed into feature properties, because
 * a style expression that has to look things up is a style expression that
 * runs per feature per frame. The chip image itself is referenced by key —
 * `chipImage.ts` registers the actual bitmap under that name.
 */

export interface StopFeatureProps {
  /** The stop's internal uuid. What a click handler joins on. */
  id: string
  /** The immutable display label. Useful for debugging and tests. */
  stopId: string
  /** `icon-image` — the key `chipImage` registered the bitmap under. */
  chipKey: string
  /** `symbol-sort-key`. Lower wins collisions. */
  sortKey: number
  /**
   * The two label lines, kept apart rather than joined with a `\n`.
   *
   * The layer renders them in different fonts and sizes — the address in
   * bold, the ETA lighter beneath — which a single joined string cannot
   * express. An empty `line2` means the stop has no ETA yet, and the layer
   * drops the line break rather than leaving the block hanging off-centre.
   */
  line1: string
  line2: string
  [key: string]: string | number
}

export type StopFeature = Feature<Point, StopFeatureProps>

export interface StopFeatureInput {
  stops: AddressedStop[]
  groups: StopGroup[]
  selectedStopId: string | null
  nextStopId: string | null
  /** Staged edits by stop uuid. Absent means nothing is staged. */
  staged?: Record<string, StagedKind>
}

const EMPTY: FeatureCollection<Point, StopFeatureProps> = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * The address line, then the ETA — the two-line block that sits beside the
 * chip. A coordinate-only stop (which is what imported CSVs produce until M6
 * geocodes them) shows its coordinates rather than an empty line, so the
 * marker never renders as a chip with a mysterious blank beside it.
 */
export function labelLinesFor(stop: AddressedStop): string[] {
  const first = stop.address?.title?.trim() || formatLatLng({ lat: stop.lat, lng: stop.lng })
  const eta = formatEta(stop.etaSec)
  return eta ? [first, eta] : [first]
}

/** Seconds from route start → "09:42". Undefined until the pipeline computes arrivals. */
export function formatEta(etaSec: number | undefined): string | null {
  if (etaSec === undefined || !Number.isFinite(etaSec) || etaSec < 0) return null
  const total = Math.round(etaSec / 60)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function buildStopFeatures(
  input: StopFeatureInput,
): FeatureCollection<Point, StopFeatureProps> {
  const { stops, groups, selectedStopId, nextStopId, staged } = input
  if (stops.length === 0) return EMPTY

  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => {
      const spec: ChipSpec = chipSpecFor({
        stop,
        groups,
        selectedStopId,
        nextStopId,
        staged: staged?.[stop.id] ?? 'none',
      })
      const [line1, line2 = ''] = labelLinesFor(stop)
      return {
        type: 'Feature',
        // A top-level numeric/string id is what lets MapLibre do feature
        // lookups; the uuid also rides in properties for click handling.
        id: stop.id,
        geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
        properties: {
          id: stop.id,
          stopId: stop.stopId,
          chipKey: spec.key,
          sortKey: spec.sortKey,
          line1,
          line2,
        },
      }
    }),
  }
}

/**
 * Every distinct chip that needs a bitmap, deduplicated.
 *
 * 300 stops do not mean 300 draws — only 300 distinct (label, colour, state)
 * tuples do, and in practice a round collapses to far fewer.
 */
export function collectChipSpecs(input: StopFeatureInput): Map<string, ChipSpec> {
  const out = new Map<string, ChipSpec>()
  for (const stop of input.stops) {
    const spec = chipSpecFor({
      stop,
      groups: input.groups,
      selectedStopId: input.selectedStopId,
      nextStopId: input.nextStopId,
      staged: input.staged?.[stop.id] ?? 'none',
    })
    if (!out.has(spec.key)) out.set(spec.key, spec)
  }
  return out
}

/**
 * Which stop the driver is heading to.
 *
 * Route order first, because after an optimisation that is the order the day
 * actually happens in; falls back to entry order for a route that has never
 * been solved. A stop is "next" if it is the first one still pending —
 * failures are skipped, because a failed stop is finished with, not upcoming.
 */
export function nextStopId(route: Pick<Route, 'stops' | 'optimized'>): string | null {
  const byId = new Map(route.stops.map((s) => [s.id, s]))
  const ordered = orderedStops(route.optimized, byId)
  const source = ordered.length > 0 ? ordered : route.stops
  return source.find((s) => s.status === 'pending')?.id ?? null
}

/** The stops in solved order, skipping endpoints and anything since deleted. */
function orderedStops(
  optimized: OptimizedRoute | undefined,
  byId: Map<string, AddressedStop>,
): AddressedStop[] {
  if (!optimized) return []
  const out: AddressedStop[] = []
  for (const id of optimized.orderedStopIds) {
    if (id === null) continue
    const stop = byId.get(id)
    if (stop) out.push(stop)
  }
  return out
}

/**
 * The last stop the driver has already dealt with — delivered OR failed.
 *
 * This is where the grey "done" polyline ends and the blue "remaining" one
 * begins. Failed counts as dealt with: the van has been there and left.
 */
export function lastHandledStop(
  route: Pick<Route, 'stops' | 'optimized'>,
): AddressedStop | null {
  const byId = new Map(route.stops.map((s) => [s.id, s]))
  const ordered = orderedStops(route.optimized, byId)
  const source = ordered.length > 0 ? ordered : route.stops
  let last: AddressedStop | null = null
  for (const stop of source) {
    if (stop.status !== 'pending') last = stop
  }
  return last
}
