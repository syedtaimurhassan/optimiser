/**
 * Where the basemap comes from.
 *
 * ── Why OpenFreeMap ───────────────────────────────────────────────────────
 *
 * This app has no backend and never will, so the basemap has to come from
 * somewhere that needs no server of ours and no secret in the bundle.
 * OpenFreeMap serves style, glyphs, sprites and tiles from one origin with
 * `access-control-allow-origin: *`, no key, no registration and no request
 * cap, and permits commercial use. Nothing to restrict by referrer because
 * there is nothing to steal.
 *
 * Its one real risk is governance: a single maintainer, donation-funded, with
 * an explicit "no SLA". That is what FALLBACK_STYLE is for.
 *
 * ── The fallback ──────────────────────────────────────────────────────────
 *
 * Stadia Maps authenticates browser traffic on the `Origin`/`Referer` header
 * against a domain registered in their dashboard — so it too needs no key in
 * the bundle. Two caveats, both load-bearing:
 *
 *   1. `syedtaimurhassan.github.io` must be added under Manage Properties, or
 *      every tile 401s. Until that is done the fallback is decorative.
 *   2. Domain auth dies under a `no-referrer` policy. Do not add a
 *      `Referrer-Policy` meta tag to index.html without re-checking this.
 *
 * Their free tier also forbids commercial use, which is fine for a personal
 * project and would not be if this ever shipped for money.
 */

/** A basemap the layers FAB can switch between. */
export type BasemapId = 'streets' | 'light'

/**
 * The two basemaps, and why these two rather than streets/satellite.
 *
 * Satellite has no clean keyless free source, so it is deliberately out of
 * scope here rather than half-wired to a provider nobody chose. `light`
 * (Positron) earns its place on merit anyway: it desaturates the basemap so a
 * dense route of coloured chips stays readable, which is the actual problem a
 * driver has when 40 stops sit on one street.
 */
export const BASEMAPS: Record<BasemapId, { label: string; url: string }> = {
  streets: { label: 'Streets', url: 'https://tiles.openfreemap.org/styles/liberty' },
  light: { label: 'Light', url: 'https://tiles.openfreemap.org/styles/positron' },
}

/** Stadia equivalents, used only when OpenFreeMap fails to load. */
export const FALLBACK_STYLE: Record<BasemapId, string> = {
  streets: 'https://tiles.stadiamaps.com/styles/osm_bright.json',
  light: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
}

export const DEFAULT_BASEMAP: BasemapId = 'streets'

/**
 * ── Attribution ───────────────────────────────────────────────────────────
 *
 * There is no constant here on purpose. MapLibre reads the credit off the
 * style's own sources and renders it in the AttributionControl, and
 * OpenFreeMap's style already declares "© OpenMapTiles Data from
 * OpenStreetMap". Passing the same string as `customAttribution` renders it
 * twice — which it did, until a browser check caught it.
 *
 * What matters is that the AttributionControl is never removed to tidy the
 * UI. OpenStreetMap's ODbL requires the credit, and it is the licence, not a
 * style choice.
 */
