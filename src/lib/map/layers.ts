import type { LayerSpecification } from 'maplibre-gl'
import { CHIP_CENTER_ABOVE_ANCHOR, CHIP_RIGHT_EXTENT } from './chipImage.ts'
import { DEFAULT_GROUP_COLOR, MAP_COLORS, ROUTE_COLORS } from './palette.ts'

/**
 * The MapLibre layer definitions.
 *
 * Framework-free and data-free: these are the *shapes*, and the component
 * feeds them sources. Keeping them here means the decision that actually
 * matters — how symbols collide — is written down in one legible place rather
 * than scattered through imperative `addLayer` calls.
 */

export const SOURCE_STOPS = 'stops'
export const SOURCE_ROUTE = 'route'

export const LAYER_ROUTE_VISITED = 'route-visited'
export const LAYER_ROUTE_REMAINING = 'route-remaining'
export const LAYER_CLUSTERS = 'stop-clusters'
export const LAYER_CLUSTER_COUNT = 'stop-cluster-count'
export const LAYER_STOPS = 'stops'

/** Label type size, in px. The text offsets below are derived from it. */
export const TEXT_SIZE = 12

/** Gap between the badge's outer edge and the start of the label block. */
const LABEL_GAP = 5

/**
 * `text-offset` is in ems, so it has to be derived from TEXT_SIZE rather than
 * written as a magic pair — change the type size and the label would
 * otherwise drift into the chip.
 */
export const TEXT_OFFSET_EM: [number, number] = [
  (CHIP_RIGHT_EXTENT + LABEL_GAP) / TEXT_SIZE,
  -CHIP_CENTER_ABOVE_ANCHOR / TEXT_SIZE,
]

/**
 * Below this zoom, stops collapse into counts.
 *
 * Set at 11 rather than lower because the point of clustering here is not
 * decluttering — symbol collision already handles that — it is that a
 * country-level view of 300 individual chips is 300 textures rendered to
 * describe something a single number says better.
 */
export const CLUSTER_MAX_ZOOM = 11

export const CLUSTER_RADIUS = 48

/**
 * The stop markers.
 *
 * ── The one property that matters most ────────────────────────────────────
 *
 * `icon-optional` and `text-optional` are both false, which is what makes the
 * chip and its label a SINGLE collision unit. With either set true, MapLibre
 * will happily place a chip whose label didn't fit, or — worse — a label
 * beside a chip it dropped. False on both means "show both or show neither",
 * which is the behaviour that stops labels clipping mid-word.
 *
 * `symbol-sort-key` is ascending: LOWER is placed FIRST and therefore wins
 * the collision. chipSpec gives the selected stop 0.
 */
export const stopsLayer = (): LayerSpecification => ({
  id: LAYER_STOPS,
  type: 'symbol',
  source: SOURCE_STOPS,
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['get', 'chipKey'],
    'icon-anchor': 'bottom',
    'icon-allow-overlap': false,
    'icon-optional': false,
    'icon-padding': 2,
    'symbol-sort-key': ['get', 'sortKey'],
    // Placement is decided by sort key, not by proximity to the viewport
    // centre, so the selected stop wins wherever it happens to be on screen.
    'symbol-z-order': 'source',
    'text-field': [
      'case',
      ['==', ['get', 'line2'], ''],
      ['format', ['get', 'line1'], { 'text-font': ['literal', ['Noto Sans Bold']] }],
      [
        'format',
        ['get', 'line1'],
        { 'text-font': ['literal', ['Noto Sans Bold']] },
        '\n',
        {},
        ['get', 'line2'],
        { 'text-font': ['literal', ['Noto Sans Regular']], 'font-scale': 0.92 },
      ],
    ],
    'text-font': ['Noto Sans Regular'],
    'text-size': TEXT_SIZE,
    'text-anchor': 'left',
    'text-offset': TEXT_OFFSET_EM,
    'text-justify': 'left',
    // Wrapping is what stops "Elmekrogen 10" clipping to "Elmekro… 10".
    'text-max-width': 9,
    'text-allow-overlap': false,
    'text-optional': false,
    'text-padding': 2,
  },
  paint: {
    'text-color': MAP_COLORS.onSurface,
    // A halo rather than a plate: the label has to stay readable over a
    // motorway, a park and a satellite tile without carrying a background
    // that would fight the chip for attention.
    'text-halo-color': MAP_COLORS.surface,
    'text-halo-width': 1.6,
    'text-halo-blur': 0.2,
  },
})

export const clusterLayer = (): LayerSpecification => ({
  id: LAYER_CLUSTERS,
  type: 'circle',
  source: SOURCE_STOPS,
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': DEFAULT_GROUP_COLOR,
    'circle-opacity': 0.92,
    'circle-stroke-width': 2,
    'circle-stroke-color': MAP_COLORS.surface,
    'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
  },
})

export const clusterCountLayer = (): LayerSpecification => ({
  id: LAYER_CLUSTER_COUNT,
  type: 'symbol',
  source: SOURCE_STOPS,
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 13,
    'text-allow-overlap': true,
  },
  paint: { 'text-color': MAP_COLORS.onPrimary },
})

/**
 * The two route lines.
 *
 * Weight and colour do all the work: thin and desaturated for the road
 * already driven, thick and saturated for what is left. No legend, because a
 * driver glancing at a phone in a van does not read legends.
 */
export const routeVisitedLayer = (): LayerSpecification => ({
  id: LAYER_ROUTE_VISITED,
  type: 'line',
  source: SOURCE_ROUTE,
  filter: ['==', ['get', 'leg'], 'visited'],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': ROUTE_COLORS.visited,
    'line-opacity': 0.85,
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 4, 18, 5],
  },
})

export const routeRemainingLayer = (): LayerSpecification => ({
  id: LAYER_ROUTE_REMAINING,
  type: 'line',
  source: SOURCE_ROUTE,
  filter: ['==', ['get', 'leg'], 'remaining'],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': ROUTE_COLORS.remaining,
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 7, 18, 9],
  },
})

/**
 * Layers in draw order, bottom first.
 *
 * The remaining line goes above the visited one so the join reads as one
 * continuous road rather than two lines meeting; the markers go above both.
 */
export const orderedLayers = (): LayerSpecification[] => [
  routeVisitedLayer(),
  routeRemainingLayer(),
  clusterLayer(),
  clusterCountLayer(),
  stopsLayer(),
]
