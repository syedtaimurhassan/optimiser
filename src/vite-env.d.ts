/// <reference types="vite/client" />

/**
 * Compile-time flag for dev/bench-only routes, injected by `define` in
 * vite.config.ts. Always replaced with a literal `true` or `false`, so any
 * branch guarded by it is statically dead in production and gets tree-shaken.
 */
declare const __DEV_ROUTES__: boolean
