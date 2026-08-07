/**
 * M1 acceptance checks, in a real browser.
 *
 * These verify the two claims that are easy to *believe* and hard to *know*:
 * that a legacy localStorage session actually survives the move to IndexedDB,
 * and that a thrown component error produces a recovery UI rather than a blank
 * page. Both are the kind of thing that silently regresses.
 *
 *   node bench/m1-smoke.mjs            (expects a build in dist-bench)
 *   node bench/m1-smoke.mjs --headed
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, process.argv.find((a) => a.startsWith('--dist='))?.split('=')[1] ?? 'dist-bench')
const HEADED = process.argv.includes('--headed')

/** A realistic v2 payload, in the exact shape Zustand's persist writes. */
const LEGACY_V2 = JSON.stringify({
  state: {
    startLocation: { lat: 55.6761, lng: 12.5683 },
    endLocation: { lat: 55.6867, lng: 12.5701 },
    waypoints: [
      { id: 'a1', num: 1, lat: 55.6801, lng: 12.5903, delivered: false },
      { id: 'a2', num: 2, lat: 55.68139, lng: 12.5757, delivered: true },
      { id: 'a3', num: 3, lat: 55.6789, lng: 12.5984, delivered: false },
    ],
    targetK: 2,
    objective: 'duration',
    optimizedRoute: null,
    favorites: [{ id: 'f1', name: 'Monday loop', startLocation: null, endLocation: null, waypoints: [] }],
    routeMode: 'fixed',
    searchQuality: 'deep',
  },
  version: 2,
})

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED })
  const server = await startServer({ root: DIST })

  // ---------------------------------------------------------------- migration
  console.log('\n━━━ legacy localStorage → IndexedDB migration ━━━\n')
  {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Seed localStorage BEFORE the app's scripts run.
    await page.addInitScript((payload) => {
      localStorage.setItem('route-optimiser:v2', payload)
    }, LEGACY_V2)

    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })

    // The app holds first paint until rehydration; wait for it to let go.
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 30_000 },
    )

    const state = await page.evaluate(async () => {
      const openDb = () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('route-optimiser')
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
      const getAll = (db, store) =>
        new Promise((resolve, reject) => {
          const req = db.transaction(store).objectStore(store).getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

      const db = await openDb()
      const [routes, favorites, meta] = await Promise.all([
        getAll(db, 'routes'),
        getAll(db, 'favorites'),
        getAll(db, 'meta'),
      ])
      const metaMap = Object.fromEntries(meta.map((m) => [m.key, m.value]))
      return {
        stores: [...db.objectStoreNames],
        routeCount: routes.length,
        routeStops: routes[0]?.payload?.waypoints?.length ?? 0,
        routeDateISO: routes[0]?.dateISO ?? null,
        favoriteCount: favorites.length,
        schemaVersion: metaMap.schemaVersion ?? null,
        statePersisted: typeof metaMap['route-optimiser:v2'] === 'string',
        legacyStillPresent: localStorage.getItem('route-optimiser:v2') !== null,
        backupWritten: localStorage.getItem('route-optimiser:v2.backup') !== null,
        // What the UI actually shows — the real proof the session survived.
        bodyText: document.body.innerText,
      }
    })

    const expectedStores = ['routes', 'matrices', 'photos', 'favorites', 'meta']
    check('all 5 object stores created', expectedStores.every((s) => state.stores.includes(s)), state.stores.join(', '))
    check('schemaVersion is 3', state.schemaVersion === 3, `got ${state.schemaVersion}`)
    check('one route row created', state.routeCount === 1, `got ${state.routeCount}`)
    check('route carries all 3 stops', state.routeStops === 3, `got ${state.routeStops}`)
    check('route dated today', state.routeDateISO === new Date().toISOString().slice(0, 10), String(state.routeDateISO))
    check('favorite migrated', state.favoriteCount === 1, `got ${state.favoriteCount}`)
    check('state blob relocated to IndexedDB', state.statePersisted)
    check('legacy localStorage key preserved', state.legacyStillPresent)
    check('backup copy written', state.backupWritten)
    // 3 stops, one delivered → the UI should report 2 active.
    check(
      'UI shows the migrated stops',
      state.bodyText.includes('55.68010, 12.59030') && state.bodyText.includes('55.67890, 12.59840'),
      'migrated coordinates rendered in the stop list',
    )

    // ---- idempotency: a second load must not duplicate anything ----
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 30_000 },
    )
    const second = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('route-optimiser')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      return new Promise((res, rej) => {
        const r = db.transaction('routes').objectStore('routes').count()
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
    })
    check('migration is idempotent (still 1 route after reload)', second === 1, `got ${second}`)

    await context.close()
  }

  // ------------------------------------------------------------ fresh install
  console.log('\n━━━ fresh install (no legacy data) ━━━\n')
  {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 30_000 },
    )
    const fresh = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('route-optimiser')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const meta = await new Promise((res, rej) => {
        const r = db.transaction('meta').objectStore('meta').getAll()
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      return {
        schemaVersion: Object.fromEntries(meta.map((m) => [m.key, m.value])).schemaVersion ?? null,
        hasMap: document.querySelector('.leaflet-container') !== null,
      }
    })
    check('schemaVersion stamped on fresh install', fresh.schemaVersion === 3, `got ${fresh.schemaVersion}`)
    check('app renders the map', fresh.hasMap)
    await context.close()
  }

  // ---------------------------------------------------------------- routing
  console.log('\n━━━ hash routing ━━━\n')
  {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(`${server.url}#/settings`, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(() => document.body.innerText.includes('Settings'), null, { timeout: 30_000 })
    check('deep link #/settings resolves on cold load', true)

    await page.goto(`${server.url}#/route/current/stop/a1`, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(() => document.body.innerText.includes('Stop detail'), null, { timeout: 30_000 })
    const params = await page.evaluate(() => document.body.innerText)
    check('deep link to stop detail resolves', params.includes('a1'), 'stop id rendered from URL params')

    await page.goto(`${server.url}#/nonsense`, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(() => document.body.innerText.includes('Page not found'), null, { timeout: 30_000 })
    check('unknown route shows not-found, not a blank page', true)

    // Root must land on the working screen, not a stub — behaviour unchanged.
    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(() => location.hash.includes('/route/'), null, { timeout: 30_000 })
    const landed = await page.evaluate(() => ({
      hash: location.hash,
      hasMap: document.querySelector('.leaflet-container') !== null,
    }))
    check('/ lands on the working screen', landed.hasMap, `hash: ${landed.hash}`)

    await context.close()
  }

  // ---------------------------------------------------------- error boundary
  console.log('\n━━━ error boundary ━━━\n')
  {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', () => {}) // expected: we're about to cause one

    // #/__crash renders a component that throws during render (dev/bench only).
    await page.goto(`${server.url}#/__crash`, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(
      () => document.querySelector('[role="alert"]') !== null,
      null,
      { timeout: 30_000 },
    )

    const recovery = await page.evaluate(() => {
      const alert = document.querySelector('[role="alert"]')
      const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
      return {
        text: alert?.textContent ?? '',
        buttons,
        bodyLength: document.body.innerText.trim().length,
      }
    })

    check('thrown render error shows recovery UI, not a blank page', recovery.bodyLength > 0)
    check('recovery UI states nothing was lost', recovery.text.includes('nothing has been lost'))
    check('recovery UI surfaces the error message', recovery.text.includes('deliberate render failure'))
    check('"Try again" action present', recovery.buttons.includes('Try again'))
    check('"Reload" action present', recovery.buttons.includes('Reload'))
    check('"Copy diagnostics" action present', recovery.buttons.includes('Copy diagnostics'))

    // The root boundary caught it, so navigating away must recover cleanly.
    await page.evaluate(() => { location.hash = '#/help' })
    await page.click('button:has-text("Try again")')
    await page.waitForFunction(() => document.body.innerText.includes('Help'), null, { timeout: 15_000 })
    check('"Try again" recovers into a working screen', true)

    await context.close()
  }

  await server.close()
  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed` +
      (failed.length ? `\nFAILED: ${failed.map((f) => f.name).join(', ')}\n` : '\n'),
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('\nm1-smoke failed:', e)
  process.exit(1)
})
