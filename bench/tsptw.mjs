import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'
import { asOpenPath, evaluate, loadTsptwFile, toPermutation } from './lib/tsptw.mjs'
import { SETS, boundFor, cachedInstances, loadBounds, setDir } from './fetch-tsptw.mjs'

/**
 * Time windows: gap to the published optimum, and whether the windows were met.
 *
 *   npm run bench:tsptw
 *   npm run bench:tsptw -- --budget=3000 --engine=wasm,wasm-workers --max-n=100
 *   npm run bench:tsptw -- --set=AFG --proven-only
 *
 * ── Two numbers, and the second one is the important one ──────────────────
 *
 * A cheap route that misses a window is not a better route, it is a different
 * and wrong answer. So the report leads with FEASIBILITY — how many instances
 * came back with every window met — and only then quotes a gap, computed over
 * the feasible ones alone. An engine that ignores windows entirely will show a
 * beautiful negative gap and 0% feasible, which is exactly how it should look.
 *
 * ── Nothing here trusts the engine ────────────────────────────────────────
 *
 * The page reports what it thinks it achieved; this file recomputes the cost,
 * the arrival times and the violations in Node from the raw visiting order,
 * using the transcription of the authors' own checker in `lib/tsptw.mjs` — which
 * `npm run bench:tsptw:fetch` has already validated against 370 published
 * best-known solutions. Where the engine's own claim disagrees with the
 * referee, the disagreement is reported as a defect, because an engine that
 * believes a late route is on time is worse than one that routes badly.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const RESULTS = join(HERE, 'results')

const args = process.argv.slice(2)
const opt = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const BUDGET = Number(opt('budget', 3000))
const ENGINES = opt('engine', 'wasm,wasm-workers').split(',')
const DIST = join(ROOT, opt('dist', 'dist-bench'))
const CHOSEN_SETS = opt('set', SETS.join(',')).split(',')
const MAX_N = Number(opt('max-n', 1000))
/** Instances per set. The full library is 370 runs per engine — an hour-plus. */
const PER_SET = Number(opt('per-set', 8))
const PROVEN_ONLY = args.includes('--proven-only')
const HEADED = args.includes('--headed')
const SEED = Number(opt('seed', 1))

const bounds = loadBounds()
if (bounds.size === 0) {
  console.error('No TSPTW instances cached. Run: npm run bench:tsptw:fetch')
  process.exit(1)
}

/**
 * Pick a size ladder rather than the first N files alphabetically.
 *
 * The instances are named `n20w20.001`, `n100w40.003` and so on, so sorting by
 * name buries every large instance behind a hundred small ones. Spreading the
 * selection evenly across the sorted-by-size list is what makes `--per-set=8` a
 * ladder from the smallest to the largest instead of eight variations on n=20.
 */
function ladder(set) {
  const files = cachedInstances(set)
    .map((file) => {
      const instance = loadTsptwFile(join(setDir(set), file), file)
      return { file, instance, bound: boundFor(bounds, set, file) }
    })
    .filter(({ instance, bound }) => {
      if (instance.n > MAX_N) return false
      if (!bound) return false
      if (PROVEN_ONLY && !bound.proven) return false
      return true
    })
    .sort((a, b) => a.instance.n - b.instance.n || a.file.localeCompare(b.file))

  if (files.length <= PER_SET) return files
  const step = (files.length - 1) / (PER_SET - 1)
  return Array.from({ length: PER_SET }, (_, i) => files[Math.round(i * step)])
}

const selected = []
for (const set of CHOSEN_SETS) {
  for (const entry of ladder(set)) selected.push({ set, ...entry })
}
if (selected.length === 0) {
  console.error('No instances matched the filters.')
  process.exit(1)
}

const server = await startServer({ root: DIST })
const browser = await chromium.launch({ headless: !HEADED })
const context = await browser.newContext()
const page = await context.newPage()
page.on('pageerror', (e) => console.error('  page error:', String(e?.message ?? e)))

const load = async () => {
  await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
  await page.waitForFunction(() => Boolean(window.__bench), null, { timeout: 60_000 })
  const version = await page.evaluate(() => window.__bench.version)
  if (version !== 5) throw new Error(`bench seam version ${version}, expected 5`)
}
await load()

console.log(`\n━━━ TSPTW — windows met, and gap to published (budget ${BUDGET}ms) ━━━\n`)
console.log(
  '  ' +
    'instance'.padEnd(22) +
    'n'.padStart(5) +
    'published'.padStart(12) +
    ENGINES.map((e) => e.padStart(26)).join(''),
)

const rows = []
for (const { set, file, instance, bound } of selected) {
  const path = asOpenPath(instance)
  const row = {
    set,
    instance: file,
    n: instance.n,
    published: bound.best,
    proven: bound.proven,
    engines: {},
  }

  const cells = []
  for (const engine of ENGINES) {
    // A fresh page per solve, for the same reason the TSPLIB runner does it:
    // or-tools-wasm never frees its native models, so without this the later
    // instances measure the wreckage of the earlier ones. See AUDIT.md §6.
    await load()
    let cell
    try {
      const outcome = await page.evaluate(
        ({ engine, matrix, options }) => window.__bench.solve(engine, matrix, options),
        {
          engine,
          matrix: path.matrix,
          options: {
            startNode: path.startNode,
            endNode: path.endNode,
            k: path.k,
            timeBudgetMs: BUDGET,
            seed: SEED,
            twOpenSec: path.twOpenSec,
            twCloseSec: path.twCloseSec,
            serviceTimeSec: path.serviceTimeSec,
          },
        },
      )

      const permutation = toPermutation(instance, outcome.visited)
      if (outcome.problems.length > 0) {
        row.engines[engine] = { invalid: outcome.problems }
        cell = 'INVALID'
      } else if (!permutation) {
        // Every customer is mandatory here. Anything short is a skipped customer
        // and its cost is not comparable with a complete tour.
        row.engines[engine] = { invalid: [`not a complete tour: ${outcome.visited.length} nodes`] }
        cell = 'SHORT'
      } else {
        // Scored in Node, in the ORIGINAL real-valued domain — the engine
        // optimised a ×100 fixed-point copy and is graded on the real thing.
        const scored = evaluate(instance, permutation)
        /*
          Rounded to the published table's own precision before the gap is
          taken. The table quotes two decimals, so on rc_206.1 — where the
          engine reproduces the proven optimum exactly — the raw values are
          117.8477 against a published 117.85 and the gap comes out at −0.002%.
          A negative gap to a PROVEN OPTIMUM is a claim that the optimum is not
          optimal, and reporting one because of somebody else's rounding would
          be the harness lying in our favour.
        */
        const cost = Number(scored.tourCost.toFixed(2))
        const gap = ((cost - bound.best) / bound.best) * 100
        const disagrees =
          outcome.feasible !== (scored.violations === 0)
            ? `engine claims feasible=${outcome.feasible}, referee counts ${scored.violations} violations`
            : null

        row.engines[engine] = {
          tourCost: cost,
          gap: Number(gap.toFixed(3)),
          violations: scored.violations,
          lateness: Number(scored.lateness.toFixed(2)),
          worstLate: scored.worst,
          wallMs: Math.round(outcome.wallMs),
          engineClaimedFeasible: outcome.feasible,
          disagrees,
        }
        cell =
          scored.violations === 0
            ? `${cost} (${gap >= 0 ? '+' : ''}${gap.toFixed(2)}%)`
            : `${scored.violations} LATE`
        if (disagrees) cell = `⚠ ${cell}`
      }
    } catch (e) {
      row.engines[engine] = { error: String(e?.message ?? e) }
      cell = 'ERROR'
    }
    cells.push(cell.padStart(26))
  }

  rows.push(row)
  console.log(
    '  ' +
      file.padEnd(22) +
      String(instance.n).padStart(5) +
      (bound.proven ? `${bound.best}*` : String(bound.best)).padStart(12) +
      cells.join(''),
  )
}

console.log('\n  (* = proven optimal; a gap to one of those is an absolute claim)\n')

for (const engine of ENGINES) {
  const results = rows.map((r) => r.engines[engine]).filter(Boolean)
  const scored = results.filter((r) => typeof r.gap === 'number')
  const feasible = scored.filter((r) => r.violations === 0)
  const liars = scored.filter((r) => r.disagrees)

  if (scored.length === 0) {
    console.log(`  ${engine.padEnd(14)} no valid results`)
    continue
  }

  const gaps = feasible.map((r) => r.gap)
  const summary =
    gaps.length > 0
      ? `mean gap ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)}%   ` +
        `worst ${Math.max(...gaps).toFixed(2)}%`
      : 'no feasible route to measure a gap on'

  console.log(
    `  ${engine.padEnd(14)} feasible ${feasible.length}/${scored.length}   ${summary}`,
  )
  if (liars.length > 0) {
    console.log(
      `  ${' '.repeat(14)} ⚠ ${liars.length} run(s) where the engine's own feasibility ` +
        `claim contradicts the referee`,
    )
  }
}

mkdirSync(RESULTS, { recursive: true })
const out = join(RESULTS, opt('out', 'tsptw.json'))
writeFileSync(
  out,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), budgetMs: BUDGET, seed: SEED, engines: ENGINES, rows },
    null,
    2,
  ),
)
console.log(`\nwrote ${out.replace(ROOT + '/', '')}\n`)

await browser.close()
await server.close()

if (!existsSync(DIST)) process.exit(1)
