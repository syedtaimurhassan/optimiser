import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'
import {
  SOLOMON_BEST_KNOWN,
  evaluateSolomonRoute,
  parseSintefSolution,
  parseSolomon,
  routeAsOpenPath,
} from './lib/vrptw.mjs'

/**
 * Solomon, asked a question a single-vehicle engine can answer.
 *
 *   npm run bench:solomon
 *   npm run bench:solomon -- --instances=c101,r101,rc201 --budget=1000
 *
 * Every route of SINTEF's published best-known solution becomes a TSPTW
 * sub-instance: the customers are fixed, so the fleet-size term and the capacity
 * constraint are both satisfied by construction, and what remains is the
 * sequencing problem this engine exists to solve. See the header of
 * `lib/vrptw.mjs` for why this is the honest form of the comparison M9 deferred.
 *
 * The scoreboard is "routes we ordered at least as cheaply as the published
 * solution did, with every window met". Beating it is possible and not
 * suspicious — the published route was optimised as part of a whole fleet, and
 * nobody claims its individual sequences are optimal in isolation.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CACHE = join(HERE, 'fixtures/solomon')
const RESULTS = join(HERE, 'results')

const args = process.argv.slice(2)
const opt = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const BUDGET = Number(opt('budget', 1000))
const ENGINES = opt('engine', 'wasm').split(',')
const DIST = join(ROOT, opt('dist', 'dist-bench'))
const HEADED = args.includes('--headed')
const SEED = Number(opt('seed', 1))
/** At least this many customers, or the ordering question is trivial. */
const MIN_CUSTOMERS = Number(opt('min-customers', 5))

/** One instance from each of Solomon's six classes, which is the useful sample. */
const DEFAULT_INSTANCES = ['c101', 'c201', 'r101', 'r201', 'rc101', 'rc201']
const INSTANCES = opt('instances', DEFAULT_INSTANCES.join(',')).split(',')

/**
 * The instance definitions are not on SINTEF — that site publishes the
 * SOLUTIONS. A plain-text mirror of Solomon's originals stands in, in exactly
 * the format `parseSolomon` reads. Same arrangement as TSPLIB: fetched on
 * demand, cached, never committed.
 */
const INSTANCE_SOURCE = (name) =>
  `https://raw.githubusercontent.com/jonzhaocn/VRPTW-ACO-python/master/solomon-100/${name.toLowerCase()}.txt`

const SOLUTION_INDEX = 'https://www.sintef.no/projectweb/top/vrptw/100-customers/'

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

/**
 * Map instance name → solution URL by scraping the index.
 *
 * The filenames are not predictable: some carry the solution's cost in the name
 * (`r103_13_1292.675455.txt`) and some do not, so guessing a URL pattern gets
 * roughly half of them and no error to say which half.
 */
async function solutionIndex() {
  const cached = join(CACHE, 'solution-index.json')
  if (existsSync(cached)) return new Map(Object.entries(JSON.parse(readFileSync(cached, 'utf8'))))

  const html = await fetchText(SOLUTION_INDEX)
  const index = {}
  for (const [, href] of html.matchAll(/href="(\/contentassets\/[^"]+\.txt)"/g)) {
    const file = href.slice(href.lastIndexOf('/') + 1)
    // `r103_13_1292.675455.txt` → `r103`
    const name = file.replace(/\.txt$/, '').split('_')[0].toLowerCase()
    if (!index[name]) index[name] = `https://www.sintef.no${href}`
  }
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cached, JSON.stringify(index, null, 2))
  return new Map(Object.entries(index))
}

async function cachedText(file, url) {
  const path = join(CACHE, file)
  if (existsSync(path)) return readFileSync(path, 'utf8')
  const text = await fetchText(url)
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(path, text)
  return text
}

mkdirSync(CACHE, { recursive: true })
const solutions = await solutionIndex()

const loaded = []
for (const name of INSTANCES) {
  const key = name.toLowerCase()
  const solutionUrl = solutions.get(key)
  if (!solutionUrl) {
    console.error(`  ${name}: no published solution found on SINTEF's index`)
    continue
  }
  const instance = parseSolomon(await cachedText(`${key}.instance.txt`, INSTANCE_SOURCE(key)))
  const solution = parseSintefSolution(await cachedText(`${key}.solution.txt`, solutionUrl))
  loaded.push({ name: key, instance, solution })
}
if (loaded.length === 0) {
  console.error('No instances loaded.')
  process.exit(1)
}

/*
  Check the referee before believing anything it says.

  Summing our own evaluation of every published route must reproduce SINTEF's
  published vehicle count and total distance, to the two decimals they quote.
  If it does not, then our distance formula, our clock, or our reading of the
  solution file is wrong — and every comparison below would be measuring that
  instead of the engine. c101 reproduces at 828.94 with zero violations, which
  is exactly the published figure.
*/
const mismatches = []
for (const { name, instance, solution } of loaded) {
  const expected = SOLOMON_BEST_KNOWN[name.toUpperCase()]
  if (!expected) continue
  let distance = 0
  let violations = 0
  for (const route of solution.routes) {
    const scored = evaluateSolomonRoute(instance, route)
    distance += scored.distance
    violations += scored.violations
  }
  const [vehicles, published] = expected
  if (solution.routes.length !== vehicles || Math.abs(distance - published) > 0.005) {
    mismatches.push(
      `${name}: we score the published solution at ${solution.routes.length} vehicles / ` +
        `${distance.toFixed(2)}, SINTEF publishes ${vehicles} / ${published}`,
    )
  }
  if (violations > 0) {
    mismatches.push(`${name}: we find ${violations} window violations in a published solution`)
  }
}
if (mismatches.length > 0) {
  console.error('\n✗ the referee disagrees with SINTEF:\n')
  for (const problem of mismatches) console.error(`    ${problem}`)
  console.error('\n  Nothing below means anything until that is zero.\n')
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

console.log(
  `\n━━━ Solomon best-known routes, re-sequenced as TSPTW (budget ${BUDGET}ms) ━━━\n`,
)

const rows = []
for (const { name, instance, solution } of loaded) {
  const routes = solution.routes.filter((r) => r.length >= MIN_CUSTOMERS)
  console.log(
    `  ${name}  —  ${solution.routes.length} published routes, ` +
      `${routes.length} with ${MIN_CUSTOMERS}+ customers`,
  )

  for (const engine of ENGINES) {
    let matchedOrBetter = 0
    let infeasible = 0
    let totalPublished = 0
    let totalOurs = 0
    const failures = []

    for (const route of routes) {
      const path = routeAsOpenPath(instance, route)
      const published = evaluateSolomonRoute(instance, route)

      await load()
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
            // Every customer must be visited; a short route is a wrong answer,
            // not a cheap one.
            allMandatory: true,
            // Both libraries start their clock at zero, not at the app's 08:00.
            departAtSec: 0,
          },
        },
      )

      // Map the engine's node indices back to Solomon customer numbers, then
      // score with the same function that scored the published route.
      const interior = outcome.visited.slice(1, -1)
      if (
        outcome.problems.length > 0 ||
        interior.length !== route.length ||
        outcome.visited[0] !== path.startNode ||
        outcome.visited[outcome.visited.length - 1] !== path.endNode
      ) {
        failures.push(`incomplete route: ${outcome.problems.join('; ') || 'wrong length'}`)
        continue
      }
      const ours = evaluateSolomonRoute(
        instance,
        interior.map((node) => path.nodes[node]),
      )

      totalPublished += published.distance
      totalOurs += ours.distance
      if (ours.violations > 0) infeasible++
      // A tie counts: the published sequence is frequently already optimal for
      // its own customer set, and reproducing it is the expected good outcome.
      else if (ours.distance <= published.distance + 1e-6) matchedOrBetter++
    }

    const scored = routes.length - failures.length
    rows.push({
      instance: name,
      engine,
      routes: routes.length,
      scored,
      matchedOrBetter,
      infeasible,
      publishedDistance: Number(totalPublished.toFixed(2)),
      ourDistance: Number(totalOurs.toFixed(2)),
      failures,
    })

    const delta =
      totalPublished > 0
        ? `${(((totalOurs - totalPublished) / totalPublished) * 100).toFixed(2)}%`
        : 'n/a'
    console.log(
      `    ${engine.padEnd(14)} matched-or-better ${matchedOrBetter}/${scored}   ` +
        `late ${infeasible}   total distance ${delta} vs published` +
        (failures.length > 0 ? `   (${failures.length} failed)` : ''),
    )
  }
}

mkdirSync(RESULTS, { recursive: true })
const out = join(RESULTS, opt('out', 'solomon-routes.json'))
writeFileSync(
  out,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), budgetMs: BUDGET, seed: SEED, rows },
    null,
    2,
  ),
)
console.log(`\nwrote ${out.replace(ROOT + '/', '')}\n`)

await browser.close()
await server.close()
