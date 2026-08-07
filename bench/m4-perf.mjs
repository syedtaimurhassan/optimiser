/**
 * M4 performance probe: 300 markers, panning and zooming.
 *
 * ── Read this before quoting the number ───────────────────────────────────
 *
 * The milestone's definition of done asks for FPS on a real mid-range Android
 * phone. THIS IS NOT THAT. It is a desktop Chromium under CDP CPU throttling,
 * which models a slower CPU and models nothing else — not the GPU, not memory
 * bandwidth, not thermal throttling, and not a mobile driver's WebGL quirks.
 * A mid-range phone is usually GPU- and bandwidth-bound, and this rig cannot
 * see either.
 *
 * Treat it as a REGRESSION DETECTOR — it will catch "M6 made the map three
 * times slower" — and run DEVICE-SMOKE-TEST.md for the real answer.
 *
 *   node bench/m4-perf.mjs                (expects a build in dist-bench)
 *   node bench/m4-perf.mjs --throttle=6   (CPU slowdown multiplier, default 4)
 *   node bench/m4-perf.mjs --stops=300
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
 * `count` stops scattered over central Copenhagen.
 *
 * Deterministic (a fixed LCG, not Math.random) so two runs are comparable —
 * a different scatter changes how many symbols collide, which changes how
 * much work MapLibre does, which would make the numbers meaningless.
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
    kind: 'delivery',
    order: 'auto',
    status: i % 7 === 0 ? 'delivered' : i % 11 === 0 ? 'failed' : 'pending',
    statusHistory: [],
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
  const context = await browser.newContext({ viewport: PHONE })
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

  const t0 = Date.now()
  // Address the fixture's id directly. The hash still names the auto-created
  // route the fixture replaced, and "#/" plus a reload does not help either:
  // RoutesListScreen redirects to the old active route before the reload
  // round-trips. This is the only version with no race in it.
  await page.goto(`${server.url}#/route/route-perf`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(
    () => globalThis.__mapController?.ready && !!globalThis.__mapController.map.getLayer('stops'),
    null,
    { timeout: 60_000 },
  )
  await page.waitForFunction(
    () => globalThis.__mapController.map.listImages().filter((i) => i.includes('|')).length > 50,
    null,
    { timeout: 60_000 },
  )
  const readyMs = Date.now() - t0

  const chipCount = await page.evaluate(
    () => globalThis.__mapController.map.listImages().filter((i) => i.includes('|')).length,
  )

  // Throttle only for the interaction measurement — throttling the load too
  // would conflate "slow to boot" with "slow to pan".
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })

  await page.evaluate(() =>
    globalThis.__mapController.map.jumpTo({ center: [12.575, 55.685], zoom: 13 }),
  )
  await page.waitForTimeout(1500)

  // Pan and zoom for ~6s while recording every frame delta in-page.
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = globalThis.__mapController.map
        const deltas = []
        let last = performance.now()
        let stop = false

        const tick = (now) => {
          deltas.push(now - last)
          last = now
          if (!stop) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)

        // A continuous drive: pan across the scatter, then zoom in and out.
        const legs = [
          { center: [12.60, 55.69], zoom: 13, duration: 1500 },
          { center: [12.55, 55.67], zoom: 14.5, duration: 1500 },
          { center: [12.58, 55.685], zoom: 12, duration: 1500 },
          { center: [12.57, 55.68], zoom: 15, duration: 1500 },
        ]
        let i = 0
        const drive = () => {
          if (i >= legs.length) {
            stop = true
            setTimeout(() => resolve(deltas), 100)
            return
          }
          map.easeTo({ ...legs[i], essential: true })
          i++
          setTimeout(drive, 1500)
        }
        drive()
      }),
  )

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  // Placement is meaningless without saying at what zoom. The final easeTo
  // leaves the camera at street level, where the viewport covers a few hundred
  // metres and "4 of 300 placed" says nothing about decluttering — it just
  // means the other 296 are off-screen. Sample an overview zoom too.
  const placed = await page.evaluate(() => {
    const map = globalThis.__mapController.map
    // `queryRenderedFeatures` straight after `jumpTo` returns the PREVIOUS
    // frame's placement — symbol layout has not run yet. Without awaiting
    // `idle` every zoom reports an identical count, which is how an earlier
    // version of this harness produced "4 · 4 · 4" and looked plausible.
    const at = (z) =>
      new Promise((resolve) => {
        map.once('idle', () =>
          resolve(map.queryRenderedFeatures({ layers: ['stops'] }).length),
        )
        map.jumpTo({ center: [12.575, 55.685], zoom: z })
      })
    return (async () => ({
      overview: await at(12),
      mid: await at(14),
      street: await at(16),
    }))()
  })

  // Drop the first few frames: they include the easeTo kickoff, not steady state.
  const clean = frames.slice(5).filter((d) => d > 0 && d < 1000)
  const sorted = [...clean].sort((a, b) => a - b)
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length
  const p50 = pct(sorted, 0.5)
  const p95 = pct(sorted, 0.95)
  const janky = clean.filter((d) => d > 1000 / 30).length

  console.log(`
─────────────────────────────────────────────────────────
  M4 map performance — SYNTHETIC PROXY, NOT A DEVICE
─────────────────────────────────────────────────────────
  stops seeded          ${STOP_COUNT}
  distinct chip images  ${chipCount}
  markers placed        z12 ${placed.overview} · z14 ${placed.mid} · z16 ${placed.street}
                        (suppression is deliberate; below z14 chips shed
                         their labels so more of the route fits)
  CPU throttle          ${THROTTLE}×
  cold load → map ready ${readyMs} ms  (unthrottled)

  frames sampled        ${clean.length}
  mean frame            ${mean.toFixed(1)} ms   → ${(1000 / mean).toFixed(0)} fps
  p50 frame             ${p50.toFixed(1)} ms   → ${(1000 / p50).toFixed(0)} fps
  p95 frame             ${p95.toFixed(1)} ms   → ${(1000 / p95).toFixed(0)} fps
  frames slower than 30fps  ${janky} (${((janky / clean.length) * 100).toFixed(1)}%)

  This is desktop Chromium with a throttled CPU. It does not model a phone's
  GPU, memory bandwidth or thermals. Use it to catch regressions; use
  DEVICE-SMOKE-TEST.md for the real answer.
─────────────────────────────────────────────────────────
`)

  await context.close()
  await browser.close()
  await server.close()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
