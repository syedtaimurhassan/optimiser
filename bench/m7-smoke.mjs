/**
 * M7 acceptance checks, in a real browser.
 *
 * The milestone's definition of done, driven with real touch events. Two of
 * these could not be asserted any other way:
 *
 *  - The camera lockstep is read off the LIVE MapLibre camera, not off a
 *    prop or a class name. "The map followed" is a claim about pixels, and
 *    the only witness that cannot be fooled is the map itself.
 *  - The carousel's virtualisation is counted in the DOM at 300 stops. A
 *    six-page fixture would pass every check here while proving nothing about
 *    the size a real round actually is.
 *
 *   node bench/m7-smoke.mjs            (expects a build in dist-bench)
 *   node bench/m7-smoke.mjs --headed
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, process.argv.find((a) => a.startsWith('--dist='))?.split('=')[1] ?? 'dist-bench')
const HEADED = process.argv.includes('--headed')

const PHONE = { width: 390, height: 844 }
const PERSIST_KEY = 'route-optimiser:routes:v4'
const STOP_COUNT = 300

const GREEN_GROUP = { id: 'g-green', name: 'Green run', colorHex: '#12823c' }

/**
 * 300 stops, spread far enough apart that moving between them MOVES THE
 * CAMERA measurably.
 *
 * That spacing is the whole point of this fixture: the M5 one packs stops into
 * a few hundred metres, and at zoom 16 two neighbours there differ by a
 * fraction of a degree that rounds away. A camera check on that data would
 * pass whether the map followed or not.
 */
function seedRoute() {
  const stops = []
  for (let i = 0; i < STOP_COUNT; i++) {
    stops.push({
      id: `stop-${i}`,
      stopId: `D${i + 1}`,
      originalPosition: i + 1,
      lat: 55.6 + i * 0.004,
      lng: 12.4 + i * 0.005,
      kind: 'delivery',
      order: 'auto',
      status: 'pending',
      statusHistory: [],
      address: { title: `Elmekrogen ${i + 1}`, subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    })
  }

  // 2 delivered · 3 failed inside the GREEN group · 4 noted
  stops[2].status = 'delivered'
  stops[2].statusHistory = [{ status: 'delivered', atMs: Date.parse('2026-08-08T14:13:00') }]
  stops[3].status = 'failed'
  stops[3].groupId = GREEN_GROUP.id
  stops[3].statusHistory = [{ status: 'failed', atMs: Date.parse('2026-08-08T14:40:00') }]
  stops[4].notes = 'bike + boks'

  return {
    id: 'route-m7',
    name: 'M7 fixture',
    dateISO: new Date().toISOString().slice(0, 10),
    status: 'active',
    start: { lat: 55.59, lng: 12.39 },
    end: { lat: 57.5, lng: 14.0 },
    endpointMode: 'fixed',
    stops,
    groups: [GREEN_GROUP],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    optimized: {
      orderedWaypoints: [],
      orderedStopIds: [null, ...stops.map((s) => s.id), null],
      arrivalSec: [],
      geometry: {
        type: 'LineString',
        coordinates: [[12.39, 55.59], ...stops.map((s) => [s.lng, s.lat]), [14.0, 57.5]],
      },
      distanceMeters: 184_000,
      durationSeconds: 21_600,
      candidatesVisited: stops.length,
      candidatesTotal: stops.length,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

/** Seed the persisted blob, then navigate straight at the fixture. See m5-smoke. */
async function seedAndReload(page, route, hash) {
  await page.evaluate(
    ([key, routeData]) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('route-optimiser')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('meta', 'readwrite')
          tx.objectStore('meta').put({
            key,
            value: JSON.stringify({
              state: {
                routes: { [routeData.id]: routeData },
                activeRouteId: routeData.id,
                favorites: [],
                stopIdMode: 'letterBlock',
              },
              version: 4,
            }),
          })
          tx.oncomplete = () => resolve(true)
          tx.onerror = () => reject(tx.error)
        }
      }),
    [PERSIST_KEY, route],
  )
  await page.goto(`${page.url().split('#')[0]}#${hash}`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
}

const sheetTop = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="route-sheet"]').getBoundingClientRect().top)

/** The live MapLibre camera. The only witness to "the map followed". */
const mapCenter = (page) =>
  page.evaluate(() => {
    const c = globalThis.__mapController?.map.getCenter()
    return c ? { lat: c.lat, lng: c.lng } : null
  })

const pageId = (page) =>
  page.evaluate(
    () => document.querySelector('[data-page-role="current"]')?.dataset.pageId ?? null,
  )

/**
 * Scope a selector to the page you can actually see.
 *
 * A carousel has three cards in the DOM at once and they are the SAME card, so
 * every testid inside one matches three times. Playwright happily taps the
 * first, which is the previous stop, sitting a full screen width off to the
 * left — the tap then times out on "element is outside of the viewport" and
 * reports it as a timing problem rather than as the selector bug it is.
 */
const CURRENT = '[data-page-role="current"] '
const snapAttr = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="route-sheet"]').dataset.snap)

/** Wait for the sheet to stop moving, rather than sleeping for the transition. */
async function settle(page) {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const top = await sheetTop(page)
    if (Math.abs(top - last) < 0.5) return top
    last = top
    await page.waitForTimeout(50)
  }
  return last
}

/** Wait for the map camera to stop moving. Same idea, different subject. */
async function settleCamera(page) {
  let last = null
  for (let i = 0; i < 40; i++) {
    const c = await mapCenter(page)
    if (last && c && Math.abs(c.lat - last.lat) < 1e-6 && Math.abs(c.lng - last.lng) < 1e-6) return c
    last = c
    await page.waitForTimeout(50)
  }
  return last
}

/**
 * A real HORIZONTAL touch drag.
 *
 * The vertical helper in m5-smoke taught the lesson this reuses: the speed of
 * a synthetic gesture is set almost entirely by its distance per step, because
 * every CDP dispatch costs a round trip. `steps: 3, holdMs: 0` clears the
 * fling threshold; a long slow run of steps does not.
 */
async function touchSwipe(client, { y, fromX, toX, steps = 3, holdMs = 0 }) {
  const point = (x) => ({ x, y, radiusX: 12, radiusY: 12, force: 1 })
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(fromX)] })
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x)] })
    if (holdMs) await new Promise((r) => setTimeout(r, holdMs))
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** Swipe right-to-left on the card: the next stop. */
const swipeNext = (client, y) => touchSwipe(client, { y, fromX: 300, toX: 90 })
/** And back. */
const swipePrev = (client, y) => touchSwipe(client, { y, fromX: 90, toX: 300 })

async function main() {
  const server = await startServer({ root: DIST })
  const browser = await chromium.launch({ headless: !HEADED })
  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  const client = await context.newCDPSession(page)

  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  console.log(`\nM7 — the stop carousel and the driver's surface\n${'─'.repeat(52)}`)

  const route = seedRoute()
  await page.goto(server.url, { waitUntil: 'load' })

  // ─────────────────────────────────────────────────── the deep link
  console.log('\n━━━ deep-linking straight at a stop ━━━\n')

  await seedAndReload(page, route, `/route/${route.id}/stop/stop-40`)
  await page.waitForSelector('[data-testid="stop-carousel"]', { timeout: 30_000 })
  await settle(page)
  await settleCamera(page)

  check('a deep link opens the carousel on the right page', (await pageId(page)) === 'stop-40', await pageId(page))

  check(
    'the card names the stop the URL asked for',
    (await page.textContent(CURRENT + '[data-testid="stop-detail"] h2'))?.includes('Elmekrogen 41'),
    await page.textContent(CURRENT + '[data-testid="stop-detail"] h2'),
  )

  check(
    'it opens the sheet to the detent that leaves the map visible',
    (await snapAttr(page)) === 'medium' &&
      (await sheetTop(page)) > PHONE.height * 0.3 &&
      (await sheetTop(page)) < PHONE.height * 0.7,
    `${await snapAttr(page)}, sheet top ${Math.round(await sheetTop(page))} of ${PHONE.height}`,
  )

  const domPages = await page.$$eval('[data-testid="carousel-page"]', (n) => n.length)
  check(
    'only the current page and its neighbours are in the DOM, at 300 stops',
    domPages === 3,
    `${domPages} of 301 pages rendered`,
  )

  check(
    'the neighbours are inert, so they are not tab stops or read aloud',
    await page.$$eval('[data-page-role="previous"], [data-page-role="next"]', (n) =>
      n.every((el) => el.hasAttribute('inert')),
    ),
  )

  // ─────────────────────────────────────────────── the signature swipe
  console.log('\n━━━ the paged carousel ━━━\n')

  const beforeTop = await sheetTop(page)
  const beforeCenter = await settleCamera(page)
  const cardY = Math.round(beforeTop + 120)

  await swipeNext(client, cardY)
  await page.waitForTimeout(120)
  const midFlight = await page.$$eval('[data-testid="carousel-page"]', (nodes) =>
    nodes.map((n) => ({
      role: n.dataset.pageRole,
      x: Math.round(n.getBoundingClientRect().x),
    })),
  )
  await page.waitForTimeout(400)
  await settleCamera(page)

  check('swiping right-to-left is the next stop', (await pageId(page)) === 'stop-41', await pageId(page))

  check(
    'the sheet height is preserved across pages',
    Math.abs((await sheetTop(page)) - beforeTop) < 1,
    `${Math.round(beforeTop)} → ${Math.round(await sheetTop(page))}`,
  )

  check(
    'mid-flight the outgoing and incoming cards are on screen together',
    midFlight.length === 3 && midFlight.some((p) => p.x !== 0),
    midFlight.map((p) => `${p.role}@${p.x}`).join(' '),
  )

  const afterCenter = await mapCenter(page)
  check(
    'the map camera followed the card',
    beforeCenter &&
      afterCenter &&
      Math.abs(afterCenter.lat - beforeCenter.lat) > 0.001 &&
      Math.abs(afterCenter.lat - 55.6 - 41 * 0.004) < 0.01,
    `lat ${beforeCenter?.lat.toFixed(4)} → ${afterCenter?.lat.toFixed(4)}, stop 42 is at ${(55.6 + 41 * 0.004).toFixed(4)}`,
  )

  check(
    'the URL is deep-linkable at whatever page the swipe reached',
    page.url().endsWith('/stop/stop-41'),
    page.url().split('#')[1],
  )

  await swipePrev(client, cardY)
  await page.waitForTimeout(500)
  check('swiping back is the previous stop', (await pageId(page)) === 'stop-40', await pageId(page))

  // ───────────────────────────────────────────────────── the chrome
  console.log('\n━━━ the chrome stays put ━━━\n')

  check('the finish pill is still up', await page.isVisible('[data-testid="finish-pill"]'))

  const peek = await page.textContent('[data-testid="peek-pill"]')
  check('the peek pill labels the page behind you', peek?.includes('D40'), peek)

  await page.tap('[data-testid="peek-pill"]')
  await page.waitForTimeout(500)
  check('and tapping it goes there', (await pageId(page)) === 'stop-39', await pageId(page))

  // ──────────────────────────────────────────────── the three states
  console.log('\n━━━ pending → delivered → undo ━━━\n')

  check(
    'a pending stop puts Navigate in the primary slot, filled',
    await page.evaluate(() => {
      const el = document.querySelector('[data-page-role="current"] [data-testid="action-navigate"]')
      return el ? getComputedStyle(el).backgroundColor === 'rgb(26, 95, 212)' : false
    }),
  )

  check(
    'and does not also offer it in the demoted block',
    (await page.$$eval(CURRENT + '[data-testid="stop-detail"] button', (b) =>
      b.map((x) => x.textContent.trim()),
    )).filter((t) => t === 'Navigate').length === 1,
  )

  const beforeMark = Date.now()
  await page.tap(CURRENT + '[data-testid="action-delivered"]')
  await page.waitForSelector(CURRENT + '[data-testid="completion-card"]', { timeout: 5_000 })

  check('marking delivered replaces the action row with a completion card', true)

  check(
    'the completion card is timestamped',
    /^\d{2}:\d{2}$/.test((await page.textContent(CURRENT + '[data-testid="completion-time"]'))?.trim() ?? ''),
    (await page.textContent(CURRENT + '[data-testid="completion-time"]'))?.trim(),
  )

  const stamp = (await page.textContent(CURRENT + '[data-testid="completion-time"]')).trim()
  const expected = new Date(beforeMark)
  check(
    'and the timestamp is now, not a stored default',
    stamp === `${String(expected.getHours()).padStart(2, '0')}:${String(expected.getMinutes()).padStart(2, '0')}`,
    stamp,
  )

  check(
    'the ETA is dropped once the stop is done',
    !(await page.textContent(CURRENT + '[data-testid="stop-counter"]')).includes(':'),
    await page.textContent(CURRENT + '[data-testid="stop-counter"]'),
  )

  check(
    'Navigate is promoted out of the primary slot into the grey block',
    (await page.$(CURRENT + '[data-testid="action-navigate"]')) === null &&
      (await page.$$eval(CURRENT + '[data-testid="stop-detail"] button', (b) =>
        b.map((x) => x.textContent.trim()),
      )).includes('Navigate'),
  )

  await page.tap(CURRENT + '[data-testid="undo-status"]')
  await page.waitForSelector(CURRENT + '[data-testid="action-delivered"]', { timeout: 5_000 })
  check(
    'undo puts it back to pending, with the action row restored',
    (await page.getAttribute(CURRENT + '[data-testid="stop-detail"]', 'data-status')) === 'pending',
  )

  // ────────────────────────────────────────────── the failure reason
  console.log('\n━━━ failing a stop, and saying why ━━━\n')

  await page.tap(CURRENT + '[data-testid="action-failed"]')
  await page.waitForSelector('[data-testid="failure-reason-nobody-home"]', { timeout: 5_000 })

  check(
    'the stop is ALREADY failed while the sheet is still asking why',
    (await page.getAttribute(CURRENT + '[data-testid="stop-detail"]', 'data-status')) === 'failed',
  )

  await page.tap('[data-testid="failure-skip"]')
  await page.waitForTimeout(400)
  check(
    'skipping leaves the failure standing, with a way back to the reason',
    (await page.getAttribute(CURRENT + '[data-testid="stop-detail"]', 'data-status')) === 'failed' &&
      (await page.$(CURRENT + '[data-testid="add-failure-reason"]')) !== null,
  )

  await page.tap(CURRENT + '[data-testid="add-failure-reason"]')
  await page.waitForSelector('[data-testid="failure-reason-nobody-home"]', { timeout: 5_000 })
  await page.tap('[data-testid="failure-reason-nobody-home"]')
  await page.fill('[data-testid="failure-note"]', 'tried the back door too')
  await page.tap('text=Save reason')
  await page.waitForTimeout(400)

  check(
    'a saved reason and note read as one line on the completion card',
    (await page.textContent(CURRENT + '[data-testid="failure-reason-line"]'))?.trim() ===
      'Nobody home — tried the back door too',
    (await page.textContent(CURRENT + '[data-testid="failure-reason-line"]'))?.trim(),
  )

  await page.tap(CURRENT + '[data-testid="undo-status"]')
  await page.waitForSelector(CURRENT + '[data-testid="action-failed"]', { timeout: 5_000 })
  await page.tap(CURRENT + '[data-testid="action-failed"]')
  await page.waitForSelector('[data-testid="failure-reason-nobody-home"]', { timeout: 5_000 })
  await page.tap('[data-testid="failure-skip"]')
  await page.waitForTimeout(400)
  check(
    'undoing a failure discards its reason — it cannot outlive the failure',
    (await page.$(CURRENT + '[data-testid="failure-reason-line"]')) === null &&
      (await page.$(CURRENT + '[data-testid="add-failure-reason"]')) !== null,
  )

  await page.tap(CURRENT + '[data-testid="undo-status"]')
  await page.waitForSelector(CURRENT + '[data-testid="action-failed"]', { timeout: 5_000 })

  // ─────────────────────────────────────── the dot is the GROUP colour
  console.log('\n━━━ the two colours never cross ━━━\n')

  await page.goto(`${page.url().split('#')[0]}#/route/${route.id}/stop/stop-3`, { waitUntil: 'load' })
  await page.waitForSelector('[data-testid="stop-detail"]', { timeout: 10_000 })

  const dot = await page.getAttribute(CURRENT + '[data-testid="group-dot"]', 'data-color')
  const pill = await page.textContent(CURRENT + '[data-testid="status-line"]')
  check(
    'a FAILED stop still shows its GROUP-coloured dot beside the counter',
    dot === 'green' && pill?.includes('Failed'),
    `dot=${dot} line="${pill?.trim()}"`,
  )

  check(
    'the dot is painted the group colour, not a status colour',
    (await page.evaluate(
      (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor,
      CURRENT + '[data-testid="group-dot"]',
    )) === 'rgb(18, 130, 60)',
  )

  // ───────────────────────────────────────────── the end location
  console.log('\n━━━ the end location breaks the grammar ━━━\n')

  await page.goto(`${page.url().split('#')[0]}#/route/${route.id}/stop/end`, { waitUntil: 'load' })
  await page.waitForSelector('[data-testid="end-detail"]', { timeout: 10_000 })

  check(
    'it is the last page of the same carousel',
    (await pageId(page)) === 'end' &&
      (await page.getAttribute('[data-testid="stop-carousel"]', 'data-page-index')) === '300',
    `index ${await page.getAttribute('[data-testid="stop-carousel"]', 'data-page-index')}`,
  )

  check(
    'label and time share one grey line',
    (await page.textContent(CURRENT + '[data-testid="end-subtitle"]'))?.startsWith('End location'),
    await page.textContent(CURRENT + '[data-testid="end-subtitle"]'),
  )

  check(
    'no counter, no group dot, no ID chip',
    (await page.$(CURRENT + '[data-testid="end-detail"] [data-testid="stop-counter"]')) === null &&
      (await page.$(CURRENT + '[data-testid="end-detail"] [data-testid="group-dot"]')) === null,
  )

  const [navBox, completedBox] = await page.evaluate(() => {
    const card = document.querySelector('[data-page-role="current"]')
    const nav = card.querySelector('[data-testid="action-navigate"]').getBoundingClientRect()
    const buttons = [...card.querySelectorAll('[data-testid="end-detail"] button')]
    const done = buttons.find((b) => b.textContent.includes('Route completed')).getBoundingClientRect()
    return [
      { w: Math.round(nav.width), h: Math.round(nav.height) },
      { w: Math.round(done.width), h: Math.round(done.height) },
    ]
  })
  check(
    'Navigate shrinks to a glyph and completing the route takes the words',
    navBox.w <= 56 && navBox.h >= 44 && completedBox.w > navBox.w * 3,
    `navigate ${navBox.w}×${navBox.h}, completed ${completedBox.w}px wide`,
  )

  // ────────────────────────────────────────── swipe a row to mark it
  console.log('\n━━━ swipe-to-complete on the list ━━━\n')

  await page.goto(`${page.url().split('#')[0]}#/route/${route.id}`, { waitUntil: 'load' })
  await page.waitForSelector('[data-testid="route-sheet"]', { timeout: 10_000 })
  for (let i = 0; i < 6; i++) {
    if ((await snapAttr(page)) === 'expanded') break
    await page.tap('[data-testid="sheet-handle"]')
    await settle(page)
  }
  await page.waitForSelector('[data-testid="stop-row"][data-stop-id="stop-8"]', { timeout: 10_000 })

  /**
   * The vertical middle of a row, ON SCREEN.
   *
   * The scroll is mandatory, not defensive. The list is virtualised with an
   * overscan, so a row can be in the DOM with a bounding rect a long way below
   * the viewport — and a synthetic touch dispatched at y > 844 lands on
   * nothing at all, silently. Every swipe check passed vacuously until this
   * scrolled first.
   */
  const rowY = async (id) => {
    const selector = `[data-testid="stop-row"][data-stop-id="${id}"]`
    // Centre the row in the sheet's own scroller, twice — the virtualiser
    // re-measures as rows enter the window, so the first scroll lands
    // approximately and the second lands exactly. `scrollIntoViewIfNeeded`
    // scrolls the MINIMUM, which parks a row from below the fold at the very
    // bottom of the screen, under the floating jump FAB.
    for (let i = 0; i < 2; i++) {
      await page.evaluate((sel) => {
        const row = document.querySelector(sel)
        const list = document.querySelector('[data-testid="sheet-list"]')
        if (!row || !list) return
        const r = row.getBoundingClientRect()
        const l = list.getBoundingClientRect()
        list.scrollTop += r.top + r.height / 2 - (l.top + l.height / 2)
      }, selector)
      await page.waitForTimeout(150)
    }
    const y = Math.round(
      await page.evaluate((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect()
        return r.top + r.height / 2
      }, selector),
    )
    if (y < 0 || y > PHONE.height) throw new Error(`row ${id} is off screen at y=${y}`)
    return y
  }

  const rowStatus = (id) =>
    page.getAttribute(`[data-testid="stop-row"][data-stop-id="${id}"]`, 'data-status')

  // A short drag: far enough to see, not far enough to commit.
  await touchSwipe(client, { y: await rowY('stop-8'), fromX: 120, toX: 170, steps: 6, holdMs: 24 })
  await page.waitForTimeout(300)
  check(
    'a short drag springs back and changes nothing',
    (await rowStatus('stop-8')) === 'pending',
    await rowStatus('stop-8'),
  )

  await touchSwipe(client, { y: await rowY('stop-8'), fromX: 60, toX: 340, steps: 8, holdMs: 20 })
  await page.waitForTimeout(400)
  check(
    'swiping right marks the row delivered',
    (await rowStatus('stop-8')) === 'delivered',
    await rowStatus('stop-8'),
  )

  check(
    'and the row springs back rather than staying pushed aside',
    Math.abs(
      await page.evaluate(
        (sel) => document.querySelector(sel).getBoundingClientRect().x,
        '[data-testid="stop-row"][data-stop-id="stop-8"]',
      ),
    ) < 1,
  )

  await touchSwipe(client, { y: await rowY('stop-8'), fromX: 60, toX: 340, steps: 8, holdMs: 20 })
  await page.waitForTimeout(400)
  check(
    'swiping the same way again undoes it',
    (await rowStatus('stop-8')) === 'pending',
    await rowStatus('stop-8'),
  )

  // Starts at 300, not 340. `scrollIntoViewIfNeeded` scrolls the minimum, so a
  // row from below the fold lands at the BOTTOM of the viewport — which is
  // where the jump FAB floats (x 330–374, y 776–820). A leftward swipe begun
  // at 340 starts on the FAB and never reaches the row at all.
  await touchSwipe(client, { y: await rowY('stop-9'), fromX: 300, toX: 40, steps: 8, holdMs: 20 })
  await page.waitForTimeout(400)
  check(
    'swiping left marks the row failed',
    (await rowStatus('stop-9')) === 'failed',
    await rowStatus('stop-9'),
  )

  check(
    'a swipe does NOT open the card — the gesture works without looking',
    !page.url().includes('/stop/'),
    page.url().split('#')[1],
  )

  // The sheet must not have moved: a horizontal gesture is never the sheet's.
  check(
    'swiping a row never drags the sheet',
    (await snapAttr(page)) === 'expanded',
    await snapAttr(page),
  )

  await page.tap('[data-testid="stop-row"][data-stop-id="stop-10"]')
  await page.waitForTimeout(400)
  check(
    'tapping a row still opens it',
    page.url().endsWith('/stop/stop-10'),
    page.url().split('#')[1],
  )

  // ─────────────────────────────────────────────────── the edit form
  console.log('\n━━━ edit stop ━━━\n')

  /** Scope to the modal. The route list is still in the DOM behind it, and it
   *  contains the words "Pickup" and "First" too. */
  const FORM = '[role="dialog"] '

  /**
   * "Edit stop" lives in the demoted block at the BOTTOM of the card, which is
   * below the fold at the `medium` detent a card opens to. Open the sheet and
   * scroll to it — the alternative is a tap that times out on "element is
   * outside of the viewport" and reads like a timing flake.
   */
  const openEditor = async () => {
    await page.waitForSelector(CURRENT + '[data-testid="stop-detail"]', { timeout: 10_000 })
    for (let i = 0; i < 6; i++) {
      if ((await snapAttr(page)) === 'expanded') break
      await page.tap('[data-testid="sheet-handle"]')
      await settle(page)
    }
    const edit = page.locator(CURRENT + '[data-testid="stop-detail"] >> text=Edit stop')
    await edit.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await edit.tap()
    await page.waitForSelector('[data-testid="edit-done"]', { timeout: 5_000 })
  }

  const formText = () =>
    page.evaluate(() =>
      document.querySelector('[data-testid="edit-done"]').closest('[role="dialog"]').textContent,
    )

  const selectedGroup = () =>
    page.getAttribute('[data-testid="group-chips"] [data-selected="true"]', 'data-group-color')

  await page.goto(`${page.url().split('#')[0]}#/route/${route.id}/stop/stop-20`, {
    waitUntil: 'load',
  })
  await openEditor()

  const initialText = await formText()
  check(
    'defaults read as words, not blanks',
    initialText.includes('Anytime') &&
      initialText.includes('Default (1 min)') &&
      initialText.includes('Not set'),
  )

  await page.tap(FORM + '>> text=Pickup')
  await page.waitForTimeout(300)
  check(
    'making a stop a pickup moves it into the purple group by itself',
    (await selectedGroup()) === 'purple',
    await selectedGroup(),
  )

  await page.tap('[data-testid="group-chips"] >> text=Multiple parcels')
  await page.waitForTimeout(200)
  await page.tap(FORM + '>> text=Delivery')
  await page.waitForTimeout(300)
  check(
    'a group the driver chose is never overwritten by the automatic rule',
    (await selectedGroup()) === 'teal',
    await selectedGroup(),
  )

  await page.tap('[data-testid="edit-access"]')
  await page.waitForSelector('[data-testid="text-picker-input"]', { timeout: 5_000 })
  await page.fill('[data-testid="text-picker-input"]', '1234#')
  await page.tap('[data-testid="text-picker-save"]')
  await page.waitForTimeout(300)

  await page.tap(FORM + '>> text=Estimated time at stop')
  await page.waitForSelector('[data-testid="duration-300"]', { timeout: 5_000 })
  await page.tap('[data-testid="duration-300"]')
  await page.waitForTimeout(300)
  check(
    'a drill-down writes back through to the row that opened it',
    (await formText()).includes('5 min'),
  )

  await page.tap('[data-testid="set-default"]')
  await page.waitForTimeout(300)
  check(
    'Set Default lights up once the stop matches what is saved',
    (await page.getAttribute('[data-testid="set-default"]', 'data-on')) === 'true',
  )

  // Everything must survive a reload. This is the definition of done, and it
  // is the one thing a screenshot can never show.
  await page.tap('[data-testid="edit-done"]')
  await page.waitForTimeout(400)
  await page.reload({ waitUntil: 'load' })
  await openEditor()

  const reloaded = await formText()
  check(
    'every edit survives a reload',
    reloaded.includes('5 min') &&
      (await page.getAttribute('[data-testid="set-default"]', 'data-on')) === 'true' &&
      (await selectedGroup()) === 'teal',
    `group=${await selectedGroup()}`,
  )
  await page.tap('[data-testid="edit-done"]')
  await page.waitForTimeout(300)

  // ──────────────────────────────── the sticky part of Set Default
  console.log('\n━━━ sticky settings follow the address ━━━\n')

  /*
    Driven through the bench seam's routes store rather than through the UI.
    Adding a stop at a known address means either a geocoder round trip or a
    file import, and neither of those is what is under test — what is under
    test is that a stop CREATED at a remembered address arrives already
    knowing the door code.
  */
  const sticky = await page.evaluate(() => {
    const store = window.__bench.routesStore.getState()
    const source = store.routes[store.activeRouteId].stops.find((s) => s.id === 'stop-20')
    store.addStops([{ lat: 55.9, lng: 12.9, address: { ...source.address } }])
    const after = window.__bench.routesStore.getState()
    const stops = after.routes[after.activeRouteId].stops
    const created = stops[stops.length - 1]
    return {
      sourceCode: source.accessCodes,
      code: created.accessCodes,
      service: created.serviceTimeSec,
      notes: created.notes ?? null,
      group: created.groupId ?? null,
    }
  })

  check(
    'a NEW stop at a remembered address arrives with its access code',
    sticky.code === '1234#' && sticky.sourceCode === '1234#',
    `saved "${sticky.sourceCode}" → new stop "${sticky.code}"`,
  )
  check(
    'and with the time at stop that was saved with it',
    sticky.service === 300,
    String(sticky.service),
  )
  check(
    'but NOT with the group — groups are route-scoped and cannot travel',
    sticky.group === null,
    String(sticky.group),
  )

  // ───────────────────────────────────────────────────────── errors
  console.log('\n━━━ no errors along the way ━━━\n')
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await browser.close()
  await server.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
