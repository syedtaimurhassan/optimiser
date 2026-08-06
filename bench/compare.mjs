/**
 * Compares two benchmark reports config by config.
 *
 * Used for two different questions:
 *  - "does removing cross-origin isolation change any answer?" (baseline vs nocoi)
 *  - "does the new engine beat the old one?" (baseline vs a future engine)
 *
 * Objective is the only thing that decides better/worse; time is reported
 * alongside because a faster wrong answer is still wrong.
 *
 *   node bench/compare.mjs baseline-ortools.json ortools-nocoi.json
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const load = (name) => JSON.parse(readFileSync(join(HERE, 'results', name), 'utf8'))

const [aName, bName] = process.argv.slice(2)
if (!aName || !bName) {
  console.error('usage: node bench/compare.mjs <a.json> <b.json>')
  process.exit(1)
}

const a = load(aName)
const b = load(bName)
const bById = new Map(b.runs.map((r) => [`${r.id}@${r.budgetMs}`, r]))

console.log(`\nA: ${aName}  (isolated: ${a.meta.crossOriginIsolated}, dist: ${a.meta.dist})`)
console.log(`B: ${bName}  (isolated: ${b.meta.crossOriginIsolated}, dist: ${b.meta.dist})\n`)
console.log(
  'CONFIG'.padEnd(28) + 'A obj'.padStart(15) + 'B obj'.padStart(15) +
    'Δ obj'.padStart(12) + 'A ms'.padStart(9) + 'B ms'.padStart(9),
)
console.log('-'.repeat(88))

let identical = 0
let better = 0
let worse = 0
let missing = 0

for (const ra of a.runs) {
  const rb = bById.get(`${ra.id}@${ra.budgetMs}`)
  if (!rb) { missing++; console.log(ra.id.padEnd(28) + '  (absent in B)'); continue }

  const d = rb.medianObjective - ra.medianObjective
  if (d === 0) identical++
  else if (d < 0) better++
  else worse++

  const pct = ra.medianObjective ? ((d / ra.medianObjective) * 100).toFixed(2) + '%' : '—'
  console.log(
    `${ra.id}@${ra.tier}`.padEnd(28) +
      String(ra.medianObjective).padStart(15) +
      String(rb.medianObjective).padStart(15) +
      (d === 0 ? '0' : pct).padStart(12) +
      String(ra.medianWallMs).padStart(9) +
      String(rb.medianWallMs).padStart(9),
  )
}

console.log('-'.repeat(88))
console.log(
  `identical: ${identical}   B better: ${better}   B worse: ${worse}` +
    (missing ? `   missing: ${missing}` : ''),
)

if (identical === a.runs.length) {
  console.log('\n→ Every objective matches exactly. The two configurations are equivalent.\n')
} else {
  console.log(`\n→ ${better + worse} config(s) differ.\n`)
}
