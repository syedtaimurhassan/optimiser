import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'
import { asClosedTour, loadTsplibFile } from './lib/tsplib.mjs'
import { OPTIMA, cachePath, cachedInstances } from './fetch-tsplib.mjs'

/**
 * Gap to PROVEN OPTIMAL, on the standard instance library.
 *
 *   npm run bench:tsplib
 *   npm run bench:tsplib -- --budget=3000 --engine=ts,ts-workers
 *
 * ── Why this is the only absolute number in the harness ───────────────────
 *
 * Everything else here is relative: engine A beat engine B on an instance we
 * invented. Three engines could agree on a route 30% above optimal and the
 * comparison table would look perfectly healthy. TSPLIB is where the answer is
 * known, so it is the only place the harness can say how good "good" is.
 *
 * See lib/tsplib.mjs for the closed-tour-as-open-path transform and why exact
 * nint rounding is load-bearing.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const RESULTS = join(HERE, 'results')

const args = process.argv.slice(2)
const opt = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const BUDGET = Number(opt('budget', 1000))
const ENGINES = opt('engine', 'ts,ts-workers,ortools').split(',')
const DIST = join(ROOT, opt('dist', 'dist-bench'))
const HEADED = args.includes('--headed')

const names = cachedInstances()
if (names.length === 0) {
  console.error('No TSPLIB instances cached. Run: npm run bench:tsplib:fetch')
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
}
await load()

console.log(`\n━━━ TSPLIB — gap to proven optimum (budget ${BUDGET}ms) ━━━\n`)
console.log(
  '  ' +
    'instance'.padEnd(12) +
    'n'.padStart(5) +
    'optimum'.padStart(10) +
    ENGINES.map((e) => e.padStart(20)).join(''),
)

const rows = []
for (const name of names) {
  const parsed = loadTsplibFile(cachePath(name))
  const instance = asClosedTour(parsed)
  const optimum = OPTIMA[name]
  const row = { instance: name, n: parsed.n, optimum, engines: {} }

  const cells = []
  for (const engine of ENGINES) {
    // A fresh page per solve: or-tools-wasm never frees native routing models
    // in a browser, so without this the later instances measure the wreckage of
    // the earlier ones. See AUDIT.md §6.
    await load()
    let cell
    try {
      const outcome = await page.evaluate(
        ({ engine, matrix, startNode, endNode, k, budget }) =>
          window.__bench.solve(engine, matrix, {
            startNode,
            endNode,
            k,
            timeBudgetMs: budget,
            seed: 1,
          }),
        {
          engine,
          matrix: instance.matrix,
          startNode: instance.startNode,
          endNode: instance.endNode,
          k: instance.k,
          budget: BUDGET,
        },
      )

      if (outcome.problems.length > 0) {
        row.engines[engine] = { invalid: outcome.problems }
        cell = 'INVALID'
      } else if (outcome.visited.length !== instance.n) {
        // Every city is mandatory here, so anything short is a skipped city and
        // its cost is not comparable with a full tour.
        row.engines[engine] = { invalid: [`visited ${outcome.visited.length}/${instance.n}`] }
        cell = 'SHORT'
      } else {
        // Re-score in Node from the raw sequence. The engine's own figure is
        // never the one reported.
        let tour = 0
        for (let i = 0; i < outcome.visited.length - 1; i++) {
          tour += instance.matrix[outcome.visited[i]][outcome.visited[i + 1]]
        }
        const gap = ((tour - optimum) / optimum) * 100
        row.engines[engine] = { tour, gap: Number(gap.toFixed(3)), wallMs: Math.round(outcome.wallMs) }
        cell = `${tour} (+${gap.toFixed(2)}%)`
      }
    } catch (e) {
      row.engines[engine] = { error: String(e?.message ?? e) }
      cell = 'ERROR'
    }
    cells.push(cell.padStart(20))
  }

  rows.push(row)
  console.log(
    '  ' +
      name.padEnd(12) +
      String(parsed.n).padStart(5) +
      String(optimum).padStart(10) +
      cells.join(''),
  )
}

// Mean gap per engine — the single number worth quoting.
console.log('')
for (const engine of ENGINES) {
  const gaps = rows.map((r) => r.engines[engine]?.gap).filter((g) => typeof g === 'number')
  if (gaps.length === 0) {
    console.log(`  ${engine.padEnd(12)} no valid results`)
    continue
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const worst = Math.max(...gaps)
  console.log(
    `  ${engine.padEnd(12)} mean gap ${mean.toFixed(2)}%   worst ${worst.toFixed(2)}%   ` +
      `(${gaps.length}/${rows.length} valid)`,
  )
}

mkdirSync(RESULTS, { recursive: true })
const out = join(RESULTS, opt('out', 'tsplib.json'))
writeFileSync(
  out,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), budgetMs: BUDGET, engines: ENGINES, rows },
    null,
    2,
  ),
)
console.log(`\nwrote ${out.replace(ROOT + '/', '')}\n`)

await browser.close()
await server.close()
