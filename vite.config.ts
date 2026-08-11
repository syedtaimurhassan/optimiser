import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { precacheManifest } from './plugins/precache'

/** Bench builds only. */
const IS_BENCH = process.env.VITE_BENCH_SEAM === '1'

/**
 * Put coi-serviceworker back, for bench builds alone.
 *
 * The script forces a page reload to gain cross-origin isolation. Users no
 * longer need it — no production engine touches SharedArrayBuffer since M9 —
 * but the OR-Tools oracle the benchmark grades against was built with pthreads
 * and will not initialise without it. Injecting here rather than leaving the
 * tag in index.html is what keeps the reload out of the artifact we deploy
 * while leaving the harness measuring a real OR-Tools.
 */
function coiServiceWorkerForBench(): Plugin {
  return {
    name: 'coi-serviceworker-bench-only',
    apply: 'build',
    transformIndexHtml(html) {
      if (!IS_BENCH) return html
      return html.replace(
        '</head>',
        '  <script src="/optimiser/coi-serviceworker.js"></script>\n  </head>',
      )
    },
  }
}

/**
 * Keep the dead COOP/COEP worker out of what we deploy.
 *
 * `public/coi-serviceworker.js` is copied verbatim into every build, and since
 * M9 nothing in production loads it — `bench:verify-seam` fails the build if
 * anything ever does. It stays in `public/` because the bench build's OR-Tools
 * oracle genuinely needs it, and gets removed from the production output here.
 *
 * Not tidiness. A service worker script sitting at a stable URL is a loaded
 * gun: it calls `skipWaiting()` and `clients.claim()` on install and registers
 * itself at the directory it is served from, which is EXACTLY the scope our
 * own worker uses. Anything that re-registered it — a stale cached document, a
 * bookmark, a copy-pasted snippet — would take that scope over and start
 * answering with COOP/COEP headers, which is how an offline shell turns into a
 * cross-origin isolation failure nobody asked for.
 */
function dropCoiFromProduction(): Plugin {
  let outDir = 'dist'
  return {
    name: 'drop-coi-from-production',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      if (IS_BENCH) return
      rmSync(join(outDir, 'coi-serviceworker.js'), { force: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // IMPORTANT: `base` must match your GitHub repository name for Pages to
  // resolve assets correctly, i.e. https://<user>.github.io/<repo>/
  // Repo is https://github.com/syedtaimurhassan/optimiser -> base '/optimiser/'.
  base: '/optimiser/',
  // wasm() lets Vite import .wasm as ES modules and topLevelAwait() rewrites
  // the top-level `await` those modules use. BOTH ARE BENCH-ONLY, and that is
  // a measurement rather than a tidy-up.
  //
  // Nothing in the production app imports a .wasm as a module: the solver
  // engine goes through `new URL(...)` + `WebAssembly.instantiateStreaming`,
  // which is plain Vite asset handling. Only `or-tools-wasm` — dev and bench
  // only since M9 — ever needed either plugin.
  //
  // Left on, they are not free. `topLevelAwait` rewrites every module in any
  // graph containing a TLA module into an async wrapper, and the wrappers are
  // charged per module rather than once. M13's barcode decoder is such a
  // module, and adding it to the graph inflated the MAIN chunk by 381 kB —
  // for a library that is dynamically imported and whose own chunk is 63 kB.
  // Scoping the plugins to bench builds gives that back and costs the shipped
  // app nothing: es2022 supports top-level await natively.
  plugins: [
    react(),
    tailwindcss(),
    ...(IS_BENCH ? [wasm(), topLevelAwait()] : []),
    coiServiceWorkerForBench(),
    dropCoiFromProduction(),
    precacheManifest(),
  ],
  // Compile-time constant for dev/bench-only routes.
  //
  // `import.meta.env.VITE_BENCH_SEAM` is NOT usable for this: Vite only inlines
  // a VITE_ variable when it is actually set, so in a normal production build
  // the expression stays a runtime property lookup and the guard never folds to
  // a constant — which left the /__crash route's strings in the shipped bundle.
  // A `define` is replaced unconditionally, so the branch is genuinely dead.
  define: {
    __DEV_ROUTES__: JSON.stringify(IS_BENCH),
  },
  // Target es2022: top-level await is natively supported there, so esbuild
  // doesn't try (and fail) to down-level TLA/destructuring to es2020.
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  // or-tools-wasm ships large prebuilt WASM; don't let esbuild pre-bundle it.
  optimizeDeps: {
    exclude: ['or-tools-wasm'],
    esbuildOptions: {
      target: 'es2022',
    },
  },
})
