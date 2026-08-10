/**
 * M8 acceptance checks, in a real browser.
 *
 * The milestone's definition of done, driven through the UI. Three of these
 * cannot be asserted any other way:
 *
 *  - "ETA recomputation triggers zero network requests" is a claim about the
 *    network, and the only witness is the network. Every request the page
 *    makes is counted, and the count is asserted across a status tick.
 *  - "Apply → Update inserts them without touching any other stop's position
 *    or ID" is a claim about 6 stops staying exactly where they were, which a
 *    unit test can assert about the algorithm but not about the app.
 *  - The map annotations are read off the LIVE chip specs the map registered,
 *    not off a prop.
 *
 * OSRM is intercepted rather than called. The public demo server is rate
 * limited to about a request a second and is occasionally down, and a suite
 * that fails for that reason teaches you to ignore it. The fixture's geometry
 * is a straight line, so the intercepted matrix is exact rather than
 * approximate — which is what lets the insertion position be asserted.
 *
 *   node bench/m8-smoke.mjs            (expects a build in dist-bench)
 *   node bench/m8-smoke.mjs --headed
 */
import { launchChromium } from './lib/launch.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, process.argv.find((a) => a.startsWith('--dist='))?.split('=')[1] ?? 'dist-bench')
const HEADED = process.argv.includes('--headed')

const PHONE = { width: 390, height: 844 }
const PERSIST_KEY = 'route-optimiser:routes:v4'
const ROUTE_ID = 'route-m8'

/**
 * Six stops on a straight line running north-east, one "unit" apart, plus a
 * start anchor before them.
 *
 * A line is the point. Cheapest insertion has an unambiguous right answer on
 * one — a stop dropped between D3 and D4 belongs at position 4 and nowhere
 * else — so "it inserted correctly" is a fact rather than a judgement.
 */
const STOP_COUNT = 6
const LAT0 = 55.6
const LNG0 = 12.4
const STEP = 0.01

const stopAt = (i) => ({ lat: LAT0 + i * STEP, lng: LNG0 + i * STEP })

function seedRoute() {
  const stops = Array.from({ length: STOP_COUNT }, (_, i) => ({
    id: `stop-${i}`,
    stopId: `D${i + 1}`,
    originalPosition: i + 1,
    ...stopAt(i),
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    address: { title: `Elstedvej ${i + 1}`, subtitle: 'Rødovre, 2610', source: 'geocoder' },
  }))

  const points = [{ lat: LAT0 - STEP, lng: LNG0 - STEP }, ...stops.map(stopAt2)]
  return {
    route: {
      id: ROUTE_ID,
      name: 'M8 fixture',
      dateISO: new Date().toISOString().slice(0, 10),
      status: 'active',
      start: points[0],
      end: null,
      endpointMode: 'fixed',
      stops,
      groups: [],
      breaks: [],
      optimizeBy: 'duration',
      searchTierSec: 3,
      targetK: null,
      matrixCacheKey: `${ROUTE_ID}:duration`,
      optimized: {
        orderedWaypoints: points,
        orderedStopIds: [null, ...stops.map((s) => s.id)],
        legSeconds: Array.from({ length: STOP_COUNT }, () => 600),
        legMeters: Array.from({ length: STOP_COUNT }, () => 4000),
        // Ten minutes between points, a minute at each stop.
        arrivalSec: Array.from({ length: STOP_COUNT + 1 }, (_, i) =>
          i === 0 ? 0 : i * 600 + (i - 1) * 60,
        ),
        geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
        distanceMeters: 24_000,
        durationSeconds: 3900,
        candidatesVisited: STOP_COUNT,
        candidatesTotal: STOP_COUNT,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    /** The cached grid a solve would have left behind: keys, and real costs. */
    matrix: buildMatrix(['\u0020start', ...stops.map((s) => s.id)], points),
  }
}

function stopAt2(s) {
  return { lat: s.lat, lng: s.lng }
}

/** Euclidean along the line, scaled to seconds. Exact, so insertion is exact. */
function buildMatrix(keys, points) {
  const n = keys.length
  const costs = new Array(n * n).fill(0)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) costs[i * n + j] = Math.round(distance(points[i], points[j]))
  }
  return { cacheKey: `${ROUTE_ID}:duration`, createdAt: Date.now(), n, costs, keys, objective: 'duration' }
}

const distance = (a, b) =>
  Math.hypot(a.lat - b.lat, a.lng - b.lng) * (600 / (STEP * Math.SQRT2))

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

async function waitForBoot(page) {
  await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0, {
    timeout: 30_000,
  })
  await page.waitForTimeout(150)
}

/** Seed both the persisted blob AND the matrix cache, then navigate. */
async function seedAndReload(page, route, matrix, hash) {
  await waitForBoot(page)
  await page.evaluate(
    ([key, routeData, matrixRow]) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('route-optimiser')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['meta', 'matrices'], 'readwrite')
          tx.objectStore('meta').put({
            key,
            value: JSON.stringify({
              state: {
                routes: { [routeData.id]: routeData },
                activeRouteId: routeData.id,
                favorites: [],
                stopIdMode: 'letterBlock',
                addressDefaults: {},
              },
              version: 4,
            }),
          })
          tx.objectStore('matrices').put(matrixRow)
          tx.oncomplete = () => resolve(true)
          tx.onerror = () => reject(tx.error)
        }
      }),
    [PERSIST_KEY, route, matrix],
  )
  await page.goto(`${page.url().split('#')[0]}#${hash}`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
  await waitForBoot(page)
}

/** The route as the store holds it — the only honest witness to "staged". */
const readRoute = (page) =>
  page.evaluate(
    (id) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('route-optimiser')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('meta', 'readonly')
          const get = tx.objectStore('meta').get('route-optimiser:routes:v4')
          get.onsuccess = () => resolve(JSON.parse(get.result.value).state.routes[id])
          get.onerror = () => reject(get.error)
        }
      }),
    ROUTE_ID,
  )

/** Every chip the map actually registered, by stop. */
const mapChips = (page) =>
  page.evaluate(() => {
    const source = globalThis.__mapController?.map?.getSource('stops')
    // `serialize()` is the public way to read a GeoJSON source's data back.
    // `queryRenderedFeatures` would only ever see the chips the collision
    // detector chose to draw, which is a different question from "is it there".
    const data = source?.serialize?.().data ?? source?._data
    if (!data || !Array.isArray(data.features)) return []
    return data.features.map((f) => ({ id: f.properties.id, chipKey: f.properties.chipKey }))
  })

async function waitForStaged(page, count) {
  await page.waitForFunction(
    (n) => document.querySelector('[data-testid="staged-banner"]')?.dataset.count === String(n),
    count,
    { timeout: 10_000 },
  )
}

async function main() {
  const server = await startServer({ root: DIST })
  const browser = await launchChromium({ headless: !HEADED })
  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  })

  /*
    Every request the page makes, counted.

    Not filtered to OSRM: the definition of done says ETA recomputation
    triggers ZERO network requests, and a count that quietly excluded a
    geocoder call would be measuring the wrong thing.
  */
  const requests = []
  context.on('request', (r) => requests.push(r.url()))

  // OSRM, intercepted. See the header note.
  let osrmTableCalls = 0
  let osrmRouteCalls = 0
  await context.route('**/router.project-osrm.org/**', async (route) => {
    const url = new URL(route.request().url())
    const coords = url.pathname.split('/').pop().split(';').map((pair) => {
      const [lng, lat] = pair.split(',').map(Number)
      return { lat, lng }
    })

    if (url.pathname.includes('/table/')) {
      osrmTableCalls++
      const indices = (value) =>
        !value || value === 'all'
          ? coords.map((_, i) => i)
          : value.split(';').map(Number)
      const sources = indices(url.searchParams.get('sources'))
      const destinations = indices(url.searchParams.get('destinations'))
      const durations = sources.map((i) =>
        destinations.map((j) => Math.round(distance(coords[i], coords[j]))),
      )
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ code: 'Ok', durations, distances: durations }),
      })
      return
    }

    osrmRouteCalls++
    let seconds = 0
    const legs = []
    for (let i = 0; i < coords.length - 1; i++) {
      const d = Math.round(distance(coords[i], coords[i + 1]))
      legs.push({ duration: d, distance: d * 6 })
      seconds += d
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        routes: [
          {
            geometry: { type: 'LineString', coordinates: coords.map((c) => [c.lng, c.lat]) },
            distance: seconds * 6,
            duration: seconds,
            legs,
          },
        ],
      }),
    })
  })

  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message))
  const client = await context.newCDPSession(page)

  try {
    await page.goto(server.url, { waitUntil: 'load' })

    // ───────────────────────────────────────────────── staging an add
    console.log('\nStaging')
    const { route, matrix } = seedRoute()
    await seedAndReload(page, route, matrix, `/route/${ROUTE_ID}`)

    check('no banner on a route with nothing staged',
      (await page.locator('[data-testid="staged-banner"]').count()) === 0)

    // Add a stop by pin, dropped between D3 and D4.
    await addByPin(page, 3.5)
    await waitForStaged(page, 1)

    let stored = await readRoute(page)
    check('an add on an optimised route STAGES rather than appending',
      stored.stops.length === STOP_COUNT && stored.pending?.changes.length === 1,
      `${stored.stops.length} committed stops, ${stored.pending?.changes.length} change`)

    await addByPin(page, 4.5)
    await waitForStaged(page, 2)
    stored = await readRoute(page)
    check('two adds accumulate as two changes',
      stored.pending?.changes.length === 2 && stored.stops.length === STOP_COUNT)

    check('the banner counts changes, not stops',
      (await page.locator('[data-testid="staged-banner"]').innerText()).includes('2 changes'))

    // ─────────────────────────────────────────── the map's annotations
    console.log('\nMap annotations')
    const chips = await mapChips(page)
    const addedIds = stored.pending.changes.map((c) => c.stopId)
    check('the added stops are on the map before they are on the route',
      addedIds.every((id) => chips.some((c) => c.id === id)),
      `${chips.length} chips for ${STOP_COUNT} committed stops`)
    check('and they carry the "+" glyph',
      addedIds.every((id) => chips.find((c) => c.id === id)?.chipKey.includes('plus')))
    check('nothing else was re-annotated',
      chips.filter((c) => c.chipKey.includes('plus')).length === 2)

    // ───────────────────────────────────────────────── the review screen
    console.log('\nThe review screen')
    await page.locator('[data-testid="staged-banner"]').tap()
    await page.waitForSelector('[data-testid="review-list"]', { timeout: 5000 })

    check('the header names the unit it counts',
      (await page.locator('[data-testid="review-header"]').innerText()).includes('2 changes'))

    // The headers are rendered uppercase by CSS, and `innerText` reports what
    // is rendered — so the comparison is on the words, not on their casing.
    const sectionTitles = (await page.locator('[data-testid="review-section"]').allInnerTexts())
      .map((t) => t.split('\n')[0].trim().toLowerCase())
    check('sections come in the order the design names them',
      sectionTitles.join(' / ') === 'added stops / existing route',
      sectionTitles.join(' / '))

    const bar = page.locator('[data-testid="review-bar"]')
    const widths = await bar.evaluate((el) => ({
      discard: el.querySelector('[data-testid="review-discard"]').getBoundingClientRect().width,
      apply: el.querySelector('[data-testid="review-apply"]').getBoundingClientRect().width,
    }))
    check('the bottom bar is deliberately unequal — Apply is the bigger target',
      widths.apply > widths.discard * 1.5,
      `discard ${Math.round(widths.discard)}px, apply ${Math.round(widths.apply)}px`)
    check('and the count is in the label',
      (await page.locator('[data-testid="review-apply"]').innerText()).includes('(2)'))

    // ───────────────────────────────────── provisional vs committed ETAs
    const finishes = await readFinishes(page)
    check('the preview produces a plan whose finish differs from the committed one',
      finishes.provisional !== null && finishes.provisional !== finishes.committed,
      `${finishes.committed}s → ${finishes.provisional}s`)
    check('and the review screen prints a clock for every existing row',
      (await page.locator('[data-testid="review-existing"]').allInnerTexts())
        .every((t) => /\d\d:\d\d/.test(t)))

    // ────────────────────────────────────────────────────────── discard
    console.log('\nDiscard')
    await page.locator('[data-testid="review-discard"]').tap()
    await page.waitForSelector('[data-testid="route-list"]', { timeout: 5000 })
    stored = await readRoute(page)
    check('Discard reverts cleanly — no change set, no stops added',
      stored.pending === undefined && stored.stops.length === STOP_COUNT)
    check('and no stop was renamed on the way through',
      stored.stops.map((s) => s.stopId).join(',') === 'D1,D2,D3,D4,D5,D6')
    check('the banner is gone',
      (await page.locator('[data-testid="staged-banner"]').count()) === 0)

    // ──────────────────────────────────────────── removing stages too
    console.log('\nRemoving')
    await page.goto(`${server.url}#/route/${ROUTE_ID}/stop/stop-2`, { waitUntil: 'load' })
    await waitForBoot(page)
    await removeCurrentStop(page)
    await waitForStaged(page, 1)
    stored = await readRoute(page)
    check('a removal stages rather than deleting',
      stored.stops.length === STOP_COUNT && stored.pending.changes[0].kind === 'remove')

    await page.locator('[data-testid="staged-banner"]').tap()
    await page.waitForSelector('[data-testid="review-removed"]', { timeout: 5000 })
    const removedRow = page.locator('[data-testid="review-removed"]').first()
    const removedText = await removedRow.innerText()
    check('the removed row keeps its sequence number and its ETA',
      /(^|\n)3(\n|$)/.test(removedText) && /\d\d:\d\d/.test(removedText),
      removedText.replace(/\n/g, ' · '))
    check('and shows a red-tinted ID chip',
      (await removedRow.locator('[data-testid="removed-id-chip"]').innerText()).includes('D3'))

    const removedChip = (await mapChips(page)).find((c) => c.id === 'stop-2')
    check('the map draws it as a red trash chip',
      removedChip?.chipKey.includes('trash'), removedChip?.chipKey)

    await page.locator('[data-testid="review-discard"]').tap()
    await page.waitForSelector('[data-testid="route-list"]', { timeout: 5000 })

    // ────────────────────────────────────────────── Apply → Update
    console.log('\nApply → Update route')
    await page.goto(`${server.url}#/route/${ROUTE_ID}`, { waitUntil: 'load' })
    await waitForBoot(page)
    await addByPin(page, 3.5)
    await waitForStaged(page, 1)
    await page.locator('[data-testid="staged-banner"]').tap()
    await page.waitForSelector('[data-testid="review-list"]', { timeout: 5000 })

    const insertedId = (await readRoute(page)).pending.changes[0].stop.stopId
    check('an inserted stop gets a DECIMAL id off the stop it lands beside',
      /^D\d+\.\d+$/.test(insertedId), insertedId)

    await page.locator('[data-testid="review-apply"]').tap()
    await page.waitForSelector('[data-testid="apply-update"]', { timeout: 5000 })
    const consequences = await page.locator('[data-testid="apply-update"]').innerText()
    check('the commit sheet states the consequence, unembellished',
      consequences.includes('Reorder only changed stops'), consequences.replace(/\n/g, ' · '))

    await page.locator('[data-testid="apply-update"]').tap()
    await page.waitForSelector('[data-testid="route-list"]', { timeout: 10_000 })
    await page.waitForTimeout(400)

    stored = await readRoute(page)
    const order = stored.optimized.orderedStopIds.filter(Boolean)
    const labelOf = Object.fromEntries(stored.stops.map((s) => [s.id, s.stopId]))
    check('Update committed the stop',
      stored.stops.length === STOP_COUNT + 1 && stored.pending === undefined,
      `${stored.stops.length} stops`)
    check('every original stop kept its ID',
      ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].every((id) =>
        stored.stops.some((s) => s.stopId === id)))
    // The pin was dropped at unit 3.5 — between D4 (unit 3) and D5 (unit 4) —
    // so a correct cheapest-insert has exactly one answer, and the decimal it
    // earned (D4.1) has to name the stop it landed after.
    check('and its position — only the new stop moved anything',
      order.map((id) => labelOf[id]).join(',') === `D1,D2,D3,D4,${insertedId},D5,D6`,
      order.map((id) => labelOf[id]).join(','))
    check('the decimal names the stop it landed beside', insertedId === 'D4.1', insertedId)

    // ──────────────────────────────────── ETAs cost nothing on the wire
    console.log('\nETA recomputation')
    /*
      Marking a stop delivered re-anchors every arrival on the route: the
      anchor moves to the next pending stop, so all seven ETAs are recomputed,
      the finish pill changes and the summary strip changes. The claim is that
      this costs nothing on the wire.

      The row is SWIPED rather than opened, so the camera never moves — a tap
      that opens a card flies the map, and the basemap tiles that follow are
      the map drawing the world, not anything to do with an arrival time.
      Basemap requests are excluded from the count for that reason and that
      reason only; every other host counts, including OSRM and the geocoder.
    */
    const finishBefore = await finishPillText(page)
    const before = appRequests(requests).length
    const rowY = await firstRowY(page)
    await touchSwipe(client, { y: rowY, fromX: 60, toX: 330 })
    await page.waitForTimeout(1500)
    const made = appRequests(requests).slice(before)
    const finishAfter = await finishPillText(page)

    check('marking a stop actually moved every ETA',
      finishBefore !== null && finishAfter !== null && finishBefore !== finishAfter,
      `${finishBefore} → ${finishAfter}`)
    check('recomputing every ETA on the route makes ZERO network requests',
      made.length === 0,
      made.length === 0
        ? `0 of ${requests.length} lifetime requests, basemap excluded`
        : made.join(', '))

    // ─────────────────────────────────────────── Apply → Reoptimise
    console.log('\nApply → Reoptimise route')
    /*
      A deliberately SCRAMBLED committed order — D1, D3, D2, D5, D4, D6 on a
      route whose stops lie on a straight line.

      This is what makes the check mean something. "Update" would preserve that
      order exactly, scramble and all, because preserving it is its entire
      promise. So an order that comes back monotonic can only have come from
      the other model.
    */
    const scrambled = seedRoute()
    scrambled.route.optimized.orderedStopIds =
      [null, 'stop-0', 'stop-2', 'stop-1', 'stop-4', 'stop-3', 'stop-5']
    await seedAndReload(page, scrambled.route, scrambled.matrix, `/route/${ROUTE_ID}`)

    await addByPin(page, 2.5)
    await waitForStaged(page, 1)
    await page.locator('[data-testid="staged-banner"]').tap()
    await page.waitForSelector('[data-testid="review-list"]', { timeout: 5000 })

    const previewOrder = await page.evaluate((id) => {
      const route = window.__bench.routesStore.getState().routes[id]
      const label = new Map(route.stops.map((s) => [s.id, s.stopId]))
      for (const c of route.pending.changes) if (c.kind === 'add') label.set(c.stopId, c.stop.stopId)
      return route.pending.provisional.orderedStopIds.filter(Boolean).map((i) => label.get(i)).join(',')
    }, ROUTE_ID)
    check('the preview keeps the driver’s order, scramble and all',
      previewOrder.startsWith('D1,D3'), previewOrder)

    await page.locator('[data-testid="review-apply"]').tap()
    await page.waitForSelector('[data-testid="apply-reoptimise"]', { timeout: 5000 })
    check('the second model states its consequence too',
      (await page.locator('[data-testid="apply-reoptimise"]').innerText())
        .includes('Reorder all stops for optimal efficiency'))

    await page.locator('[data-testid="apply-reoptimise"]').tap()
    await page.waitForSelector('[data-testid="route-list"]', { timeout: 60_000 })
    await page.waitForTimeout(800)

    stored = await readRoute(page)
    const finalLabels = Object.fromEntries(stored.stops.map((s) => [s.id, s.stopId]))
    const finalOrder = stored.optimized.orderedStopIds
      .filter(Boolean)
      .map((id) => finalLabels[id])
      .join(',')
    check('Reoptimise committed and cleared the change set',
      stored.pending === undefined && stored.stops.length === STOP_COUNT + 1,
      `${stored.stops.length} stops`)
    /*
      The scramble is gone and the round runs along the line again. Note where
      D2.1 ends up: it was labelled at REVIEW time, from the position the
      preview gave it in the scrambled order, and reoptimising moved it to
      where the geometry wants it WITHOUT relabelling it.

      That is not a bug, it is M2's doctrine holding under the one case that
      tests it: an ID is a property of the parcel and a position is a property
      of the route, and they are allowed to disagree. A label that chased the
      new position would be the thing that invalidates what is written on a box.
    */
    check('and it REORDERED everything — the scramble is gone',
      finalOrder === 'D1,D2,D3,D2.1,D4,D5,D6', finalOrder)
    check('the inserted stop kept the ID the review screen showed it',
      stored.stops.some((s) => s.stopId === 'D2.1'),
      stored.stops.map((s) => s.stopId).join(','))
    check('while every original ID survived the reorder untouched',
      ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].every((id) =>
        stored.stops.some((s) => s.stopId === id)))
    check('it went through the solver — a road route was fetched',
      osrmRouteCalls > 0, `${osrmRouteCalls} route calls, ${osrmTableCalls} table calls`)
  } finally {
    if (!HEADED) await browser.close()
    await server.close()
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length > 0) {
    console.log('\nFailed:')
    for (const r of failed) console.log(`  ✗ ${r.name}${r.detail ? `  — ${r.detail}` : ''}`)
    process.exitCode = 1
  }
}

// ───────────────────────────────────────────────────────────── helpers

/**
 * Add a stop by dropping a pin.
 *
 * `unit` is a position along the fixture's line, so 3.5 means "between D4 and
 * D5" — where a correct cheapest-insert has exactly one answer.
 */
async function addByPin(page, unit) {
  await page.evaluate(
    ([lat, lng]) => {
      globalThis.__mapController?.map.jumpTo({ center: [lng, lat], zoom: 14 })
    },
    [LAT0 + unit * STEP, LNG0 + unit * STEP],
  )
  await page.evaluate(() => {
    window.__bench.uiStore.getState().setAddByPinOpen(true)
  })
  await page.waitForSelector('[data-testid="pin-add"]', { timeout: 5000 })
  await page.waitForTimeout(300)
  await page.locator('[data-testid="pin-add"]').tap()
}

/** Remove whatever stop the carousel is showing, through its own edit form. */
async function removeCurrentStop(page) {
  await page.evaluate(() => {
    const { selectedStopId, setStopEditorId } = window.__bench.uiStore.getState()
    if (selectedStopId) setStopEditorId(selectedStopId)
  })
  await page.waitForSelector('[data-testid="edit-done"]', { timeout: 5000 })
  // Scoped to the dialog: the card behind it carries a "Remove stop" of its
  // own, and an unscoped locator resolves to both.
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove stop' })
    .tap()
}

/**
 * Requests that are the APP's, rather than the map drawing the world.
 *
 * The basemap is a different host and a different subsystem; it fetches tiles
 * whenever the camera moves and never has an opinion about arrival times.
 * Excluding it is what makes the remaining count mean something.
 */
const appRequests = (urls) => urls.filter((u) => !u.includes('tiles.openfreemap.org'))

/**
 * A real HORIZONTAL touch drag. Lifted from m7-smoke, and the same lesson
 * applies: a gesture's speed is set by its distance per step, because every
 * CDP dispatch costs a round trip.
 */
async function touchSwipe(client, { y, fromX, toX, steps = 3 }) {
  const point = (x) => ({ x, y, radiusX: 12, radiusY: 12, force: 1 })
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(fromX)] })
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x)] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** A row's centre, in viewport coordinates. The list is virtualised — see m7. */
const firstRowY = (page) =>
  page.evaluate(() => {
    const row = document.querySelector('[data-testid="stop-row"]')
    const box = row?.getBoundingClientRect()
    return box ? box.top + box.height / 2 : 400
  })

const finishPillText = (page) =>
  page.evaluate(() => {
    const pill = document.querySelector('[data-testid="finish-pill"]')
    return pill ? pill.innerText.match(/\d\d:\d\d/)?.[0] ?? null : null
  })

/**
 * The two plans' finish times, in seconds from their own start.
 *
 * Read off the store rather than off the summary strip: the strip is hidden at
 * the expanded detents by the header morph, so a check that read it would be
 * asserting on which layer of the header happened to be visible.
 */
async function readFinishes(page) {
  return page.evaluate((id) => {
    const route = window.__bench.routesStore.getState().routes[id]
    const last = (plan) => (plan?.arrivalSec?.length ? plan.arrivalSec.at(-1) : null)
    return { committed: last(route?.optimized), provisional: last(route?.pending?.provisional) }
  }, ROUTE_ID)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
