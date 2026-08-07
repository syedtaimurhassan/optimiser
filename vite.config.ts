import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vite.dev/config/
export default defineConfig({
  // IMPORTANT: `base` must match your GitHub repository name for Pages to
  // resolve assets correctly, i.e. https://<user>.github.io/<repo>/
  // Repo is https://github.com/syedtaimurhassan/optimiser -> base '/optimiser/'.
  base: '/optimiser/',
  // wasm() lets Vite import .wasm as ES modules (needed by or-tools-wasm);
  // topLevelAwait() supports the top-level `await` those WASM modules use.
  // React/Tailwind stay first; wasm + TLA run after.
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  // Compile-time constant for dev/bench-only routes.
  //
  // `import.meta.env.VITE_BENCH_SEAM` is NOT usable for this: Vite only inlines
  // a VITE_ variable when it is actually set, so in a normal production build
  // the expression stays a runtime property lookup and the guard never folds to
  // a constant — which left the /__crash route's strings in the shipped bundle.
  // A `define` is replaced unconditionally, so the branch is genuinely dead.
  define: {
    __DEV_ROUTES__: JSON.stringify(process.env.VITE_BENCH_SEAM === '1'),
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
