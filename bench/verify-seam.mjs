/**
 * Guards the one risk a test seam carries: shipping it.
 *
 * Builds production normally (no VITE_BENCH_SEAM) and asserts the seam's marker
 * string is absent from every emitted asset. If Vite ever stops eliminating the
 * dead branch, this fails the build instead of quietly exposing an internal
 * solver handle to every visitor.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Everything that must never reach a production bundle. */
const MARKERS = ['__bench', '__crash', '__ui']

/**
 * OR-Tools symbols. M9's definition of done says the production bundle contains
 * no OR-Tools, and the only way to keep that true is to assert it: the engine is
 * reached by a dynamic import from a dead branch, which is exactly the kind of
 * thing a bundler change can quietly start following.
 */
const ORTOOLS_MARKERS = ['RoutingIndexManager', 'SetArcCostEvaluatorOfAllVehicles', 'or-tools-wasm']

console.log('building production bundle (no VITE_BENCH_SEAM)…')
execFileSync('npx', ['vite', 'build', '--outDir', 'dist-seamcheck'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_BENCH_SEAM: '' },
})

const assets = join(ROOT, 'dist-seamcheck', 'assets')
if (!existsSync(assets)) {
  console.error('FAIL: no assets directory produced')
  process.exit(1)
}

const offenders = []
for (const file of readdirSync(assets)) {
  if (!/\.(js|css)$/.test(file)) continue
  const src = readFileSync(join(assets, file), 'utf8')
  for (const marker of [...MARKERS, ...ORTOOLS_MARKERS]) {
    if (src.includes(marker)) offenders.push(`assets/${file} contains "${marker}"`)
  }
}

/*
  WebAssembly in production: exactly one thing is allowed there now.

  Until M10 this asserted that NO .wasm reached the bundle, because the only
  candidate was OR-Tools' 16 MB routing binary. M10 ships its own engine, so the
  rule becomes a size limit instead of a ban — which still catches the thing the
  ban was for. The Rust artefacts are under 50 KB, so anything approaching a
  megabyte is not ours.
*/
const MAX_WASM_BYTES = 512 * 1024
const wasmFiles = readdirSync(assets).filter((file) => file.endsWith('.wasm'))
for (const file of wasmFiles) {
  const bytes = statSync(join(assets, file)).size
  if (bytes > MAX_WASM_BYTES) {
    offenders.push(
      `assets/${file} is a ${(bytes / 1048576).toFixed(1)} MB WebAssembly binary — ` +
        `the solver engine is under 50 KB, so this is something else`,
    )
  }
}

if (offenders.length > 0) {
  console.error('\nFAIL: dev-only markers found in production output:')
  for (const f of offenders) console.error(`  - ${f}`)
  console.error('\nDead-branch elimination is no longer working. Check the')
  console.error('import.meta.env guards in src/main.tsx and src/routes.tsx,')
  console.error('and that engineOrToolsLegacy is only ever imported dynamically')
  console.error('from src/benchSeam.ts.')
  process.exit(1)
}

console.log(`\nPASS: ${MARKERS.map((m) => `"${m}"`).join(', ')} absent from all production assets.`)
console.log('PASS: no OR-Tools symbols in production output.')
console.log(
  wasmFiles.length === 0
    ? 'PASS: no WebAssembly emitted.'
    : `PASS: ${wasmFiles.length} WebAssembly artefact(s), all under ${MAX_WASM_BYTES / 1024} KB: ` +
      wasmFiles
        .map((f) => `${f} (${(statSync(join(assets, f)).size / 1024).toFixed(1)} KB)`)
        .join(', '),
)
