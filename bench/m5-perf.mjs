/**
 * M5 performance probe: scrolling a 300-row route list.
 *
 * ── Read this before quoting the number ───────────────────────────────────
 *
 * The milestone's definition of done asks for 60fps on a real phone. THIS IS
 * NOT THAT, for exactly the reasons m4-perf.mjs gives: a desktop Chromium
 * under CDP CPU throttling models a slower processor and models nothing else —
 * not the GPU, not memory bandwidth, not thermals, and not what happens when
 * a WebGL map is competing for all three.
 *
 * Treat it as a REGRESSION DETECTOR. It will catch "M7's photos made the list
 * three times slower", which is its job. For the real answer run
 * DEVICE-SMOKE-TEST.md §15.
 *
 * What it measures, and why each one:
 *
 *   rows in the DOM     the point of virtualising. If this tracks the route
 *                       length, windowing has silently stopped working — and
 *                       nothing else here would notice.
 *   frame deltas        during a sustained scroll of the whole list
 *   settle after jump   the two-pass measure correcting itself
 *
 *   node bench/m5-perf.mjs                (expects a build in dist-bench)
 *   node bench/m5-perf.mjs --throttle=6   (CPU slowdown multiplier, default 4)
 *   node bench/m5-perf.mjs --stops=300
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : fallback
}
const DIST = join(ROOT, 'dist-bench')
const THROTTLE = arg('throttle', 4)
const STOP_COUNT = arg('stops', 300)
const PHONE = { width: 390, height: 844 }
const PERSIST_KEY = 'route-optimiser:routes:v4'

/**
 * `count` stops, deterministically decorated.
 *
 * Every seventh row carries a note and every eleventh a tag, so the list has
 * the mix of heights that makes the virtualiser measure rather than trust its
 * estimate. A list of identical rows would be a measurement of the easy case.
 */
function scatter(count) {
  let seed = 1337
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  return Array.from({ length: count }, (_, i) => ({
    id: `stop-${i}`,
    stopId: `D${i + 1}`,
    originalPosition: i + 1,
    lat: 55.66 + next() * 0.05,
    lng: 12.53 + next() * 0.09,
    kind: i % 11 === 0 ? 'pickup' : 'delivery',
    order: 'auto',
    status: i % 7 === 0 ? 'delivered' : i % 13 === 0 ? 'failed' : 'pending',
    statusHistory: [],
    notes: i % 7 === 3 ? 'bike + boks, ring på 2. sal' : undefined,
    address: { title: `Elmekrogen ${i + 1}`, subtitle: 'Bagsværd, 2880', source: 'geocoder' },
  }))
}

function fixture(count) {
  const stops = scatter(count)
  return {
    id: 'route-perf',
    name: 'Perf fixture',
    dateISO: new Date().toISOString().slice(0, 10),
    status: 'active',
    start: { lat: 55.6761, lng: 12.5683 },
    end: { lat: 55.6867, lng: 12.5701 },
    endpointMode: 'fixed',
    stops,
    groups: [],
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
        coordinates: [[12.5683, 55.6761], ...stops.map((s) => [s.lng, s.lat]), [12.5701, 55.6867]],
      },
      distanceMeters: 84_000,
      durationSeconds: 21_600,
      candidatesVisited: stops.length,
      candidatesTotal: stops.length,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]

async function main() {
  const browser = await chromium.launch()
  const server = await startServer({ root: DIST })
  const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true })
  const page = await context.newPage()

  await page.goto(`${server.url}#/`, { waitUntil: 'load' })
  await page.waitForFunction(() => location.hash.startsWith('#/route/'), null, { timeout: 15_000 })

  await page.evaluate(
    ([key, route]) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('route-optimiser', 4)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('meta', 'readwrite')
          tx.objectStore('meta').put({
            key,
            value: JSON.stringify({
              state: {
                routes: { [route.id]: route },
                activeRouteId: route.id,
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
    [PERSIST_KEY, fixture(STOP_COUNT)],
  )

  const cdp = await context.newCDPSession(page)

  await page.goto(`${server.url}#/route/route-perf`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('[data-testid="route-sheet"]', { timeout: 30_000 })

  // Open to full: the largest list viewport, and therefore the most rows alive
  // at once — the worst case, which is the one worth measuring.
  const t0 = Date.now()
  for (let i = 0; i < 4; i++) {
    if ((await page.getAttribute('[data-testid="route-sheet"]', 'data-snap')) === 'full') break
    await page.tap('[data-testid="sheet-handle"]')
    await page.waitForTimeout(350)
  }
  await page.waitForSelector('[data-testid="stop-row"]', { timeout: 15_000 })
  const openMs = Date.now() - t0

  const windowed = await page.evaluate(() => ({
    rows: document.querySelectorAll('[data-row-kind]').length,
    nodes: document.querySelector('[data-testid="route-list"]').querySelectorAll('*').length,
    totalPx: Math.round(document.querySelector('[data-testid="route-list"]').getBoundingClientRect().height),
  }))

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.waitForTimeout(500)

  // A sustained scroll over the whole list, recording every frame delta.
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const list = document.querySelector('[data-testid="sheet-list"]')
        const deltas = []
        let last = performance.now()
        let stop = false

        const tick = (now) => {
          deltas.push(now - last)
          last = now
          if (!stop) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)

        // Down the whole list and back, at a steady rate a thumb could
        // plausibly sustain. Programmatic rather than gestural on purpose:
        // this measures rendering, and a synthesised fling would measure the
        // browser's scroll physics as well.
        const max = list.scrollHeight - list.clientHeight
        const stepsDown = 90
        let i = 0
        const drive = () => {
          if (i > stepsDown * 2) {
            stop = true
            setTimeout(() => resolve(deltas), 100)
            return
          }
          const t = i <= stepsDown ? i / stepsDown : (stepsDown * 2 - i) / stepsDown
          list.scrollTop = max * t
          i++
          requestAnimationFrame(drive)
        }
        requestAnimationFrame(drive)
      }),
  )

  // The jump FAB, which is the one interaction that re-renders the window
  // wholesale rather than incrementally.
  await page.evaluate(() => {
    document.querySelector('[data-testid="sheet-list"]').scrollTop = 999_999
  })
  await page.waitForTimeout(400)
  const jumpStart = Date.now()
  await page.tap('[data-testid="jump-fab"]')
  await page.waitForFunction(
    () => document.querySelector('[data-testid="sheet-list"]').scrollTop < 4000,
    null,
    { timeout: 10_000 },
  )
  const jumpMs = Date.now() - jumpStart

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  // Drop the first few frames: they cover the rAF loop starting up, not scrolling.
  const deltas = frames.slice(3).sort((a, b) => a - b)
  const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length
  const median = pct(deltas, 0.5)

  console.log(`\nM5 list performance — ${STOP_COUNT} stops, ${PHONE.width}×${PHONE.height}, ${THROTTLE}× CPU throttle`)
  console.log('─'.repeat(64))
  console.log(`  rows in the DOM       ${windowed.rows} of ${STOP_COUNT + 5}`)
  console.log(`  elements in the list  ${windowed.nodes}`)
  console.log(`  total scroll height   ${windowed.totalPx}px`)
  console.log(`  sheet open → rows     ${openMs}ms`)
  console.log(`  frames sampled        ${deltas.length}`)
  console.log(`  median frame          ${median.toFixed(1)}ms  (${(1000 / median).toFixed(0)} fps)`)
  console.log(`  mean frame            ${mean.toFixed(1)}ms`)
  console.log(`  p95 frame             ${pct(deltas, 0.95).toFixed(1)}ms`)
  console.log(`  p99 frame             ${pct(deltas, 0.99).toFixed(1)}ms`)
  console.log(`  jump to next stop     ${jumpMs}ms`)
  console.log('')
  console.log('  ⚠ A throttled desktop CPU is not a phone. This is a regression')
  console.log('    detector; DEVICE-SMOKE-TEST.md §15 is the definition of done.')
  console.log('')

  await context.close()
  await browser.close()
  await server.close()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
