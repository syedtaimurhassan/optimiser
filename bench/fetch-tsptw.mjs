import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  loadTsptwFile,
  parseBestKnownSolutions,
  parseBounds,
  verifyAgainstPublished,
} from './lib/tsptw.mjs'

/**
 * Caches the TSPTW instance library, its best-known table, and the published
 * best-known SOLUTIONS — then checks our arithmetic against them.
 *
 *   npm run bench:tsptw:fetch
 *
 * The last step is the point. A benchmark harness that has never been checked
 * against a known answer is a very convincing way to measure nothing, and every
 * detail that could be wrong here (service time baked into the matrix, the free
 * wait for a window to open, the scored return leg) produces a number that looks
 * entirely reasonable. So the fetcher finishes by re-evaluating every published
 * permutation and refusing to succeed unless our cost equals theirs.
 *
 * Instances are cached and never committed — the library publishes no licence,
 * and downloading is not redistributing. Same rule as TSPLIB.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, 'fixtures/tsptw')
const BASE = 'https://lopez-ibanez.eu/files/TSPTW'

/**
 * The sets worth running, and why.
 *
 *   Dumas                  135 instances, n=20..200, EVERY ONE proven optimal.
 *                          The only set where our gap is an absolute claim at
 *                          every size, so it is the spine of the ladder.
 *   GendreauDumasExtended  the same instances with windows widened by 100 units,
 *                          which is much harder for a penalty-based search:
 *                          wide windows mean the time-warp term stops guiding it.
 *   OhlmannThomas          n=150/200 with wide windows — the large end.
 *   AFG                    50 ASYMMETRIC real-world instances (a stacker crane).
 *                          The only asymmetric set, and asymmetry is the one
 *                          property of a real driving matrix the synthetic
 *                          instances cannot fake.
 *   SolomonPotvinBengio    30 instances derived from Solomon's RC set, so the
 *                          geometry the brief asked about is represented.
 *
 * Langevin is skipped: its own maintainers describe it as trivial for a modern
 * solver, and 70 instances that every engine ties on would dilute every mean in
 * the report.
 */
const SETS = [
  'Dumas',
  'GendreauDumasExtended',
  'OhlmannThomas',
  'AFG',
  'SolomonPotvinBengio',
]

/**
 * The bounds CSV names this set `GendreauDumas`; the tarball is
 * `GendreauDumasExtended`. Same instances.
 */
const BOUNDS_SET_NAME = { GendreauDumasExtended: 'GendreauDumas' }

export function setDir(set) {
  return join(CACHE, set)
}

export function boundsPath() {
  return join(CACHE, 'Traveltime_Bounds.csv')
}

export function bestKnownPath(set) {
  return join(CACHE, 'best-known', `${set}.best`)
}

/** Instance files present on disk for a set, sorted by n then by name. */
export function cachedInstances(set) {
  const dir = setDir(set)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.txt') || f.endsWith('.tw'))
    .sort()
}

/** Every cached instance, keyed the way the `.best` files key them. */
export function loadAll(sets = SETS) {
  const out = new Map()
  for (const set of sets) {
    for (const file of cachedInstances(set)) {
      out.set(file, loadTsptwFile(join(setDir(set), file), file))
    }
  }
  return out
}

export function loadBounds() {
  if (!existsSync(boundsPath())) return new Map()
  return parseBounds(readFileSync(boundsPath(), 'utf8'))
}

/** The best-known value for an instance, with whether it is proven optimal. */
export function boundFor(bounds, set, file) {
  return bounds.get(`${BOUNDS_SET_NAME[set] ?? set}/${file}`) ?? null
}

async function download(url, target) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  writeFileSync(target, Buffer.from(await response.arrayBuffer()))
}

/**
 * Unpack with the system `tar`.
 *
 * Node has no archive support in its standard library, and pulling a tar package
 * in for a dev-only fetch script would be a production dependency's worth of
 * supply chain for one line. `tar -xzf` exists on macOS, Linux, and Windows 10+
 * (bsdtar), which covers every machine this repository is developed on.
 */
function extract(archive, into) {
  execFileSync('tar', ['-xzf', archive, '-C', into], { stdio: 'inherit' })
}

async function main() {
  mkdirSync(CACHE, { recursive: true })

  for (const set of SETS) {
    if (existsSync(setDir(set)) && cachedInstances(set).length > 0) {
      console.log(`  ${set.padEnd(24)} cached`)
      continue
    }
    const archive = join(CACHE, `${set}.tar.gz`)
    console.log(`  ${set.padEnd(24)} fetching…`)
    await download(`${BASE}/${set}.tar.gz`, archive)
    extract(archive, CACHE)
    rmSync(archive)
  }

  if (!existsSync(boundsPath())) {
    console.log('  Traveltime_Bounds.csv    fetching…')
    await download(`${BASE}/Traveltime_Bounds.csv`, boundsPath())
  }

  const bestKnownDir = join(CACHE, 'best-known')
  if (!existsSync(bestKnownDir)) {
    console.log('  best-known solutions     fetching…')
    const archive = join(CACHE, 'best.tar.gz')
    await download(`${BASE}/tsptw-2010-best-known.tar.gz`, archive)
    extract(archive, CACHE)
    rmSync(archive)
    // The archive unpacks to a dated directory name; normalise it so nothing
    // downstream has to know which year's file it got.
    const unpacked = join(CACHE, 'tsptw-2010-best-known')
    if (existsSync(unpacked)) {
      execFileSync('mv', [unpacked, bestKnownDir])
    }
  }

  // ── The self-check ──────────────────────────────────────────────────────
  const instances = loadAll()
  const bounds = loadBounds()
  console.log(`\n  ${instances.size} instances, ${bounds.size} published bounds`)

  let checked = 0
  const problems = []
  for (const set of SETS) {
    const path = bestKnownPath(set)
    if (!existsSync(path)) continue
    const published = parseBestKnownSolutions(readFileSync(path, 'utf8'))
    checked += published.size
    problems.push(...verifyAgainstPublished(instances, published))
  }

  if (problems.length > 0) {
    console.error(`\n✗ the referee disagrees with the published values:\n`)
    for (const problem of problems.slice(0, 20)) console.error(`    ${problem}`)
    if (problems.length > 20) console.error(`    …and ${problems.length - 20} more`)
    console.error(
      `\n  ${problems.length} of ${checked} published solutions re-score differently here.\n` +
        `  Nothing this harness reports about an engine means anything until that is zero.\n`,
    )
    process.exit(1)
  }

  console.log(
    `  ✓ re-scored ${checked} published best-known solutions; every cost and ` +
      `violation count matches\n`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}

export { SETS }
