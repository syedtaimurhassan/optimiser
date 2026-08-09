/**
 * M12: what the sparse fetch costs, and what it buys.
 *
 * Two questions, both answered without touching the network:
 *
 *   1. **How many requests?** The covering is a pure function of the point set
 *      and the provider's limits, so dense-versus-sparse is arithmetic and can
 *      be reported exactly rather than estimated.
 *   2. **Is the answer still good?** This is the one that matters and the one
 *      a request count cannot answer. A fetch that is ten times cheaper and
 *      produces a route five per cent worse is not a saving, it is a driver's
 *      extra half hour.
 *
 * The second is measurable because bench/fixtures/ holds the REAL OSRM matrix
 * for samples/bikes_low_battery.json. That fixture plays the part of the
 * provider — the cover asks it for the cells it would have requested, the rest
 * are estimated from straight lines, and the tour that comes out is then scored
 * against the true matrix. So the quality figure is the honest one: what the
 * driver actually drives, priced at what it actually costs.
 *
 *   node bench/m12-matrix.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { planCover, uncovered } from '../src/lib/routing/cover.ts'
import { candidateNeeds, estimateGaps, getBit, makeBitset, setBit } from '../src/lib/routing/sparse.ts'
import { hilbertOrder } from '../src/lib/compute/hilbert.ts'
import { engineTs } from '../src/lib/compute/engineTs.ts'
import { SKIP_PENALTY, makeConstraints } from '../src/lib/compute/solverPort.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

/** OSRM's real limits, measured against the live service in M12. */
const OSRM = { maxCells: 10_000, maxPoints: 450, minRequestGapMs: 1_100 }

const points = JSON.parse(readFileSync(join(HERE, '../samples/bikes_low_battery.json'), 'utf8'))
const fixture = JSON.parse(
  readFileSync(join(HERE, '../bench/fixtures/bikes_low_battery.matrix.json'), 'utf8'),
)

const n = fixture.n
const truth = new Int32Array(n * n)
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) truth[i * n + j] = fixture.matrix[i][j]
}

const solve = async (matrix, size, budgetMs = 3000) => {
  const result = await engineTs.solve({
    matrix: { n: size, durations: matrix },
    constraints: makeConstraints(size),
    endpoints: { start: 0, end: null },
    selectK: null,
    skipPenalty: SKIP_PENALTY,
    objective: 'duration',
    budgetMs,
    departAtSec: 0,
    seedOrder: hilbertOrder(points),
  })
  return Array.from(result.order)
}

/** What a tour really costs, whatever grid it was chosen on. */
const realCost = (tour) => {
  let total = 0
  for (let i = 0; i < tour.length - 1; i++) total += truth[tour[i] * n + tour[i + 1]]
  return total
}

/** The fixture, acting as the provider: hand back exactly the cells asked for. */
function fetchFromTruth(bands) {
  const matrix = new Int32Array(n * n)
  const known = makeBitset(n * n)
  let cells = 0
  for (const band of bands) {
    for (const source of band.sources) {
      for (const destination of band.destinations) {
        const cell = source * n + destination
        matrix[cell] = truth[cell]
        setBit(known, cell)
        cells++
      }
    }
  }
  return { matrix, known, cells }
}

console.log(`\ninstance: ${fixture.source} — ${n} stops, ${fixture.objective}\n`)

// ── 1. The arithmetic, at four sizes ────────────────────────────────────────
//
// Larger instances are synthesised by jittering the real ones inside their own
// bounding box, which preserves the clustering that decides how well the cover
// packs. Only the request counts come from these — quality is measured on the
// real instance below, where there is a true matrix to score against.
const grow = (size) => {
  let seed = 7
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  return Array.from({ length: size }, (_, i) => {
    const base = points[i % points.length]
    return { lat: base.lat + (random() - 0.5) * 0.004, lng: base.lng + (random() - 0.5) * 0.004 }
  })
}

console.log('  n      dense reqs   dense cells    sparse reqs   sparse cells    saving')
for (const size of [107, 300, 600, 1000]) {
  const pts = size === n ? points : grow(size)
  const need = candidateNeeds(pts, { mandatory: [0, pts.length - 1] })
  const plan = planCover(need, Array.from(hilbertOrder(pts)), OSRM)
  const missed = uncovered(need, plan).length
  if (missed > 0) throw new Error(`cover missed ${missed} needed pairs at n=${size}`)

  const denseCells = size * size
  const denseReqs = Math.ceil(denseCells / OSRM.maxCells)
  console.log(
    `  ${String(size).padEnd(6)} ${String(denseReqs).padStart(10)} ${String(denseCells).padStart(13)} ` +
      `${String(plan.bands.length).padStart(14)} ${String(plan.cells).padStart(14)} ` +
      `${(denseReqs / plan.bands.length).toFixed(1).padStart(9)}x`,
  )
}

// ── 2. The quality, on the real instance ───────────────────────────────────
console.log('\nsolution quality, scored against the true OSRM matrix:\n')

const dense = await solve(truth, n)
const baseline = realCost(dense)
console.log(`  dense grid          ${baseline}s   (the answer we are trying not to lose)`)

const need = candidateNeeds(points, { mandatory: [0] })
const plan = planCover(need, Array.from(hilbertOrder(points)), OSRM)
const { matrix: sparse, known, cells } = fetchFromTruth(plan.bands)
const { ratio, estimatedCells } = estimateGaps(sparse, known, points, 'duration')

const onSparse = await solve(sparse, n)
const sparseCost = realCost(onSparse)
console.log(
  `  sparse + estimates  ${sparseCost}s   ${pct(sparseCost, baseline)}  ` +
    `(${plan.bands.length} req, ${cells} cells, ${estimatedCells} guessed at ${ratio.toFixed(4)} s/m)`,
)

/*
  Then the refinement the pipeline actually performs: the road router's legs
  for the chosen tour are real, so those arcs stop being guesses and the search
  gets one more look. Here the fixture supplies those legs, which is exactly
  what OSRM's route response supplies in the app.
*/
let corrected = 0
for (let i = 0; i < onSparse.length - 1; i++) {
  const cell = onSparse[i] * n + onSparse[i + 1]
  if (!getBit(known, cell)) corrected++
  sparse[cell] = truth[cell]
  setBit(known, cell)
}
const refined = await solve(sparse, n, 2000)
console.log(
  `  after refinement    ${realCost(refined)}s   ${pct(realCost(refined), baseline)}  ` +
    `(${corrected} tour arcs corrected, no extra request)`,
)

// ── 3. What the cache turns those numbers into ─────────────────────────────
//
// The request counts above are the COLD case, which a route pays once. The two
// below are the ones a driver actually meets: reopening a round, and adding a
// stop to one already solved.
console.log('\nwith the cache, at 300 stops:\n')

const big = grow(300)
const bigNeed = candidateNeeds(big, { mandatory: [0, big.length - 1] })
const bigPlan = planCover(bigNeed, Array.from(hilbertOrder(big)), OSRM)
const bigKnown = makeBitset(300 * 300)
for (const band of bigPlan.bands) {
  for (const source of band.sources) {
    for (const destination of band.destinations) setBit(bigKnown, source * 300 + destination)
  }
}

const outstanding = (need, known, size) =>
  need.map((row, i) => row.filter((j) => !getBit(known, i * size + j)))

const reopen = planCover(outstanding(bigNeed, bigKnown, 300), Array.from(hilbertOrder(big)), OSRM)
console.log(`  cold                ${bigPlan.bands.length} requests`)
console.log(`  reopened            ${reopen.bands.length} requests`)

// One more stop, with the previous grid re-indexed under it.
const grown = [...big, { lat: big[0].lat + 0.002, lng: big[0].lng + 0.002 }]
const size = grown.length
const grownKnown = makeBitset(size * size)
for (let i = 0; i < 300; i++) {
  for (let j = 0; j < 300; j++) {
    if (getBit(bigKnown, i * 300 + j)) setBit(grownKnown, i * size + j)
  }
}
const grownNeed = candidateNeeds(grown, { mandatory: [0, size - 1] })
const patch = planCover(outstanding(grownNeed, grownKnown, size), Array.from(hilbertOrder(grown)), OSRM)
console.log(`  one stop added      ${patch.bands.length} requests, ${patch.cells} cells`)

function pct(value, base) {
  const delta = ((value - base) / base) * 100
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(2)}%`.padStart(7)
}

console.log()
