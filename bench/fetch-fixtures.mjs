/**
 * Fetches the REAL OSRM cost matrix for samples/bikes_low_battery.json once and
 * caches it under bench/fixtures/.
 *
 * Why bother: a synthetic haversine matrix is symmetric-ish and smooth, which
 * flatters any solver. Real driving costs are asymmetric and lumpy, and that is
 * where construction heuristics actually differ. Caching keeps the benchmark
 * reproducible and stops it hammering the public demo server on every run.
 *
 * Mirrors fetchCostMatrix() in src/lib/routingService.ts: same tiling by cell
 * count, same 1.1 s spacing, same integer rounding and unreachable penalty.
 *
 *   node bench/fetch-fixtures.mjs           (duration matrix — the app default)
 *   node bench/fetch-fixtures.mjs distance
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OSRM_TABLE_BASE = 'https://router.project-osrm.org/table/v1/driving'
const OSRM_TABLE_MAX_CELLS = 10_000
const OSRM_MIN_REQUEST_GAP_MS = 1_100
const UNREACHABLE_COST = 9_999_999

const objective = process.argv[2] === 'distance' ? 'distance' : 'duration'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const points = JSON.parse(readFileSync(join(HERE, '../samples/bikes_low_battery.json'), 'utf8'))
const n = points.length
const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
const rowsPerRequest = Math.max(1, Math.floor(OSRM_TABLE_MAX_CELLS / n))
const totalRequests = Math.ceil(n / rowsPerRequest)

console.log(`fetching ${objective} matrix for ${n} points in ${totalRequests} request(s)…`)

const rows = []
for (let req = 0; req < totalRequests; req++) {
  const from = req * rowsPerRequest
  const to = Math.min(n, from + rowsPerRequest)
  const sources = Array.from({ length: to - from }, (_, i) => from + i).join(';')
  const url =
    `${OSRM_TABLE_BASE}/${coords}?annotations=${objective}` +
    (totalRequests > 1 ? `&sources=${sources}` : '')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM ${res.status} ${res.statusText}`)
  const data = await res.json()
  const band = objective === 'distance' ? data.distances : data.durations
  if (data.code !== 'Ok' || !band) throw new Error(`OSRM: ${data.message ?? data.code}`)
  rows.push(...band)
  console.log(`  ${req + 1}/${totalRequests} (rows ${from}–${to - 1})`)
  if (req < totalRequests - 1) await sleep(OSRM_MIN_REQUEST_GAP_MS)
}

const matrix = rows.map((row) => row.map((v) => (v == null ? UNREACHABLE_COST : Math.round(v))))

let unreachable = 0
let asymmetric = 0
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    if (i === j) continue
    if (matrix[i][j] === UNREACHABLE_COST) unreachable++
    if (matrix[i][j] !== matrix[j][i]) asymmetric++
  }
}

mkdirSync(join(HERE, 'fixtures'), { recursive: true })
const out = join(HERE, 'fixtures', 'bikes_low_battery.matrix.json')
writeFileSync(
  out,
  JSON.stringify(
    {
      source: 'osrm',
      objective,
      fetchedAt: new Date().toISOString(),
      n,
      unreachablePairs: unreachable,
      asymmetricPairs: asymmetric,
      matrix,
    },
    null,
    0,
  ),
)

console.log(
  `\nwrote ${out}\n  ${n}x${n}  unreachable pairs: ${unreachable}  ` +
    `asymmetric pairs: ${asymmetric}/${n * (n - 1)} ` +
    `(${((asymmetric / (n * (n - 1))) * 100).toFixed(1)}%)`,
)
