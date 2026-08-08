import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Fetch the TSPLIB instances we measure gap-to-optimal against.
 *
 *   node bench/fetch-tsplib.mjs
 *
 * ── Why these are not committed ───────────────────────────────────────────
 *
 * TSPLIB publishes no licence. The library has been freely used in academic
 * work for thirty years and nobody has ever objected to a download, but
 * redistributing someone else's data in our repository is a different act from
 * fetching it, so the cache is gitignored and this script is how you fill it.
 * The harness degrades to "no TSPLIB instances cached" rather than failing.
 *
 * ── Where the numbers come from ───────────────────────────────────────────
 *
 * The optima below are transcribed from the official table at
 * http://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/STSP.html
 * They are PROVEN optima, not best-known bounds, for every instance listed
 * here. They are hard-coded rather than scraped because a silently changed
 * parse would move every gap we report, and a wrong optimum is worse than no
 * optimum: it makes a broken solver look fine, or a fine one look broken.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, 'fixtures', 'tsplib')

/**
 * Instance → proven optimal tour length.
 *
 * All EUC_2D, spanning 52 to 280 cities: small enough that a one-second budget
 * is a fair test, large enough that a greedy construction is visibly bad.
 */
export const OPTIMA = {
  berlin52: 7542,
  eil51: 426,
  st70: 675,
  eil76: 538,
  pr76: 108159,
  rat99: 1211,
  kroA100: 21282,
  eil101: 629,
  ch150: 6528,
  kroA150: 26524,
  tsp225: 3916,
  a280: 2579,
}

/**
 * A plain-text mirror. The canonical archive serves `.tsp.gz` from a university
 * host that has been intermittently unreachable for years; this repository holds
 * the identical files uncompressed, which keeps the fetcher a single GET with no
 * decompression step.
 */
const SOURCE = (name) => `https://raw.githubusercontent.com/mastqe/tsplib/master/${name}.tsp`

export function cachePath(name) {
  return join(CACHE, `${name}.tsp`)
}

export function cachedInstances() {
  return Object.keys(OPTIMA).filter((name) => existsSync(cachePath(name)))
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  const names = Object.keys(OPTIMA)
  console.log(`fetching ${names.length} TSPLIB instances into bench/fixtures/tsplib/…\n`)

  let fetched = 0
  let skipped = 0
  for (const name of names) {
    const target = cachePath(name)
    if (existsSync(target)) {
      skipped++
      continue
    }
    try {
      const response = await fetch(SOURCE(name))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      if (!text.includes('NODE_COORD_SECTION') && !text.includes('EDGE_WEIGHT_SECTION')) {
        throw new Error('response does not look like a TSPLIB file')
      }
      writeFileSync(target, text)
      console.log(`  ${name.padEnd(12)} ${text.length} bytes  (optimum ${OPTIMA[name]})`)
      fetched++
    } catch (e) {
      console.error(`  ${name.padEnd(12)} FAILED: ${e.message}`)
    }
  }

  console.log(`\n${fetched} fetched, ${skipped} already cached.`)
  if (fetched + skipped === 0) {
    console.error('Nothing cached — the TSPLIB grid will be skipped.')
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
