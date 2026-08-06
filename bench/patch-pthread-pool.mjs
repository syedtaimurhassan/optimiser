/**
 * THE ESCAPE HATCH, as a reproducible build step.
 *
 * Background: or-tools-wasm ships only pthread-enabled builds. Emscripten's glue
 * eagerly allocates a pool of worker threads at startup:
 *
 *     initMainThread(){var pthreadPoolSize=4;while(pthreadPoolSize--){PThread.allocateUnusedWorker()}}
 *
 * and then posts the shared wasmMemory to each of them. THAT postMessage is what
 * requires cross-origin isolation — not the shared memory itself, which Chromium
 * happily constructs without it. When the postMessage throws, the
 * "loading-workers" run dependency is never cleared and initialisation hangs
 * forever rather than failing.
 *
 * Setting the pool size to 0 means no workers are allocated, nothing is posted,
 * and initialisation completes. The solver is single-threaded anyway
 * (setWorkerBridgeEnabled(false)), so nothing of value is lost. If native code
 * ever did call pthread_create, Emscripten's own
 * `_emscripten_has_threading_support()` already returns false without a
 * SharedArrayBuffer global, so it would fail loudly rather than corrupt state.
 *
 * This is a post-build byte patch on the vendored glue. It is a benchmark
 * instrument, NOT a shipping strategy — see AUDIT.md for why the real fix is a
 * build flag or a non-pthread upstream build.
 *
 *   node bench/patch-pthread-pool.mjs <assetsDir>
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const assetsDir = process.argv[2]
if (!assetsDir) {
  console.error('usage: node bench/patch-pthread-pool.mjs <assetsDir>')
  process.exit(1)
}

const NEEDLE = 'var pthreadPoolSize=4;'
const REPLACEMENT = 'var pthreadPoolSize=0;'

let patched = 0
for (const file of readdirSync(assetsDir)) {
  if (!/_runtime.*\.js$/.test(file)) continue
  const full = join(assetsDir, file)
  const src = readFileSync(full, 'utf8')
  if (!src.includes(NEEDLE)) continue
  writeFileSync(full, src.replaceAll(NEEDLE, REPLACEMENT))
  console.log(`  patched ${file}`)
  patched++
}

if (patched === 0) {
  console.error(
    `FAIL: "${NEEDLE}" not found in any runtime glue under ${assetsDir}.\n` +
      'The Emscripten glue shape changed — re-derive the patch before trusting any no-COI result.',
  )
  process.exit(1)
}

console.log(`patch-pthread-pool: pthread pool disabled in ${patched} runtime(s)`)
