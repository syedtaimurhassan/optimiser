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
const MARKER = '__bench'

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
  if (readFileSync(join(assets, file), 'utf8').includes(MARKER)) offenders.push(file)
}

if (offenders.length > 0) {
  console.error(`\nFAIL: seam marker "${MARKER}" found in production output:`)
  for (const f of offenders) console.error(`  - assets/${f}`)
  console.error('\nThe dead-branch elimination in src/main.tsx is no longer working.')
  process.exit(1)
}

console.log(`\nPASS: "${MARKER}" absent from all production assets — seam is bench-only.`)
