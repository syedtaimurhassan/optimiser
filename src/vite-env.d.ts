/// <reference types="vite/client" />

/**
 * Compile-time flag for dev/bench-only routes, injected by `define` in
 * vite.config.ts. Always replaced with a literal `true` or `false`, so any
 * branch guarded by it is statically dead in production and gets tree-shaken.
 */
declare const __DEV_ROUTES__: boolean

interface ImportMetaEnv {
  /**
   * Geoapify API key, from the committed `.env`. Optional in the type because
   * a build without it is legal — geocoding then runs permanently on the
   * keyless fallback rather than failing.
   */
  readonly VITE_GEOAPIFY_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
