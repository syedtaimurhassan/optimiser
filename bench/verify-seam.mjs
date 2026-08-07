/**
 * Guards the one risk a test seam carries: shipping it.
 *
 * Builds production normally (no VITE_BENCH_SEAM) and asserts the seam's marker
 * string is absent from every emitted asset. If Vite ever stops eliminating the
 * dead branch, this fails the build instead of quietly exposing an internal
 * solver handle to every visitor.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Everything that must never reach a production bundle. */
const MARKERS = ['__bench', '__crash']

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
  for (const marker of MARKERS) {
    if (src.includes(marker)) offenders.push(`assets/${file} contains "${marker}"`)
  }
}

if (offenders.length > 0) {
  console.error('\nFAIL: dev-only markers found in production output:')
  for (const f of offenders) console.error(`  - ${f}`)
  console.error('\nDead-branch elimination is no longer working. Check the')
  console.error('import.meta.env guards in src/main.tsx and src/routes.tsx.')
  process.exit(1)
}

console.log(`\nPASS: ${MARKERS.map((m) => `"${m}"`).join(', ')} absent from all production assets.`)
