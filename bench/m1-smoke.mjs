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
        routeStops: routes[0]?.payload?.stops?.length ?? 0,
        stopIds: (routes[0]?.payload?.stops ?? []).map((st) => st.stopId),
        stopStatuses: (routes[0]?.payload?.stops ?? []).map((st) => st.status),
        originalPositions: (routes[0]?.payload?.stops ?? []).map((st) => st.originalPosition),
        routesBlobPresent: typeof metaMap['route-optimiser:routes:v4'] === 'string',
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
    check('schemaVersion is 4', state.schemaVersion === 4, `got ${state.schemaVersion}`)
    check('one route row created', state.routeCount === 1, `got ${state.routeCount}`)
    check('route carries all 3 stops', state.routeStops === 3, `got ${state.routeStops}`)
    check('route dated today', state.routeDateISO === new Date().toISOString().slice(0, 10), String(state.routeDateISO))
    check('favorite migrated', state.favoriteCount === 1, `got ${state.favoriteCount}`)
    check('v4 routes blob written', state.routesBlobPresent)
    check('legacy v2 state blob preserved', state.statePersisted)

    // The point of M2: a stop that was #37 is labelled D7, and keeps it.
    check(
      'stop ids allocated in letter blocks',
      JSON.stringify(state.stopIds) === JSON.stringify(['A1', 'A2', 'A3']),
      `got ${JSON.stringify(state.stopIds)}`,
    )
    check(
      'originalPosition preserved from num',
      JSON.stringify(state.originalPositions) === JSON.stringify([1, 2, 3]),
      `got ${JSON.stringify(state.originalPositions)}`,
    )
    check(
      'delivered mapped to status',
      JSON.stringify(state.stopStatuses) === JSON.stringify(['pending', 'delivered', 'pending']),
      `got ${JSON.stringify(state.stopStatuses)}`,
    )
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
    check('schemaVersion stamped on fresh install', fresh.schemaVersion === 4, `got ${fresh.schemaVersion}`)
    check('app renders the map', fresh.hasMap)
    await context.close()
  }

  // ------------------------------------------- v3 → v4 upgrade (M1 → M2 user)
  //
  // The path a user who already ran the deployed M1 build takes. Their data is
  // in IndexedDB at schemaVersion 3, NOT in localStorage — so the v2 path above
  // does not exercise this at all.
  console.log('\n━━━ schemaVersion 3 → 4 upgrade ━━━\n')
  {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Land on the app once so the database exists, then rewrite it to look
    // exactly like an M1 install and reload.
    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 30_000 },
    )

    await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('route-optimiser')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const put = (store, value) =>
        new Promise((res, rej) => {
          const r = db.transaction(store, 'readwrite').objectStore(store).put(value)
          r.onsuccess = () => res()
          r.onerror = () => rej(r.error)
        })
      const clear = (store) =>
        new Promise((res, rej) => {
          const r = db.transaction(store, 'readwrite').objectStore(store).clear()
          r.onsuccess = () => res()
          r.onerror = () => rej(r.error)
        })

      await clear('routes')
      await clear('meta')

      // Exactly what M1 wrote: a routes row whose payload is the legacy session.
      await put('routes', {
        id: 'm1-route',
        dateISO: '2026-08-01',
        name: 'Imported session',
        createdAt: 1,
        updatedAt: 1,
        payload: {
          migratedFrom: 'route-optimiser:v2',
          startLocation: { lat: 55.6761, lng: 12.5683 },
          endLocation: null,
          waypoints: [
            { id: 'x1', num: 37, lat: 55.68, lng: 12.59, delivered: false },
            { id: 'x2', num: 38, lat: 55.681, lng: 12.591, delivered: true },
            { id: 'x3', num: 43, lat: 55.682, lng: 12.592, delivered: false },
          ],
          targetK: null,
          objective: 'distance',
          optimizedRoute: null,
          routeMode: 'fixed',
          searchQuality: 'maximum',
        },
      })
      await put('meta', { key: 'schemaVersion', value: 3 })
    })

    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 30_000 },
    )

    const upgraded = await page.evaluate(() => {
      const s = window.__bench.routesStore.getState()
      const route = Object.values(s.routes)[0]
      return {
        version: null,
        routeCount: Object.keys(s.routes).length,
        stopIds: route?.stops.map((st) => st.stopId) ?? [],
        originalPositions: route?.stops.map((st) => st.originalPosition) ?? [],
        statuses: route?.stops.map((st) => st.status) ?? [],
        optimizeBy: route?.optimizeBy,
        searchTierSec: route?.searchTierSec,
        hasStart: route?.start !== null,
      }
    })

    check('v3 payload upgraded into one route', upgraded.routeCount === 1, `got ${upgraded.routeCount}`)
    // The headline cases, end to end through a real browser and a real database.
    check(
      'positions 37/38/43 become D7/D8/E3',
      JSON.stringify(upgraded.stopIds) === JSON.stringify(['D7', 'D8', 'E3']),
      JSON.stringify(upgraded.stopIds),
    )
    check(
      'originalPosition carried from num',
      JSON.stringify(upgraded.originalPositions) === JSON.stringify([37, 38, 43]),
      JSON.stringify(upgraded.originalPositions),
    )
    check(
      'delivered flag became a status',
      JSON.stringify(upgraded.statuses) === JSON.stringify(['pending', 'delivered', 'pending']),
      JSON.stringify(upgraded.statuses),
    )
    check('settings carried across', upgraded.optimizeBy === 'distance' && upgraded.searchTierSec === 5,
      `optimizeBy=${upgraded.optimizeBy} tier=${upgraded.searchTierSec}`)
    check('endpoint carried across', upgraded.hasStart)

    await context.close()
  }

  // ------------------------------------------------------- multi-route model
  console.log('\n━━━ multi-route model ━━━\n')
  {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 30_000 },
    )

    const model = await page.evaluate(async () => {
      const store = window.__bench.routesStore
      const s = () => store.getState()

      // A fresh install auto-creates one route so the app is usable.
      const initialCount = Object.keys(s().routes).length

      const a = s().createRoute({ name: 'Monday', dateISO: '2026-08-10' })
      const b = s().createRoute({ name: 'Tuesday', dateISO: '2026-08-11' })

      s().setActiveRoute(a)
      s().addStops(Array.from({ length: 12 }, (_, i) => ({ lat: 55 + i / 1000, lng: 12 + i / 1000 })))
      const stopsA = s().routes[a].stops

      // Insert beside the 7th stop: takes a decimal suffix, renumbers nothing.
      s().insertStopNear('A7', { lat: 56, lng: 13 })
      const afterInsert = s().routes[a].stops.map((st) => st.stopId)

      // Status transition then undo, both timestamped.
      const target = s().routes[a].stops[0]
      s().setStopStatus(target.id, 'delivered')
      const delivered = s().routes[a].stops[0]
      s().undoStopStatus(target.id)
      const undone = s().routes[a].stops[0]

      return {
        initialCount,
        routeCount: Object.keys(s().routes).length,
        names: Object.values(s().routes).map((r) => r.name).sort(),
        byDate: s().listRoutesByDate('2026-08-10').map((r) => r.name),
        idsA: stopsA.map((st) => st.stopId),
        afterInsert,
        routeBIsEmpty: s().routes[b].stops.length === 0,
        deliveredStatus: delivered.status,
        deliveredHasTimestamp: delivered.statusHistory.length === 1 && typeof delivered.statusHistory[0].atMs === 'number',
        undoneStatus: undone.status,
        undoneHistoryEmpty: undone.statusHistory.length === 0,
      }
    })

    check('a fresh install auto-creates one usable route', model.initialCount === 1, `got ${model.initialCount}`)
    check('multiple routes can be created', model.routeCount === 3, `got ${model.routeCount}`)
    check('routes are listable by date', JSON.stringify(model.byDate) === JSON.stringify(['Monday']), JSON.stringify(model.byDate))
    check('routes hold independent stops', model.routeBIsEmpty)
    check(
      '12 stops span two letter blocks (A1..A10, B1, B2)',
      JSON.stringify(model.idsA) === JSON.stringify(['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','B1','B2']),
      JSON.stringify(model.idsA),
    )
    check(
      'insert beside A7 yields A7.1 and renumbers nothing',
      JSON.stringify(model.afterInsert) === JSON.stringify(['A1','A2','A3','A4','A5','A6','A7','A7.1','A8','A9','A10','B1','B2']),
      JSON.stringify(model.afterInsert),
    )
    check('status transition records a timestamp', model.deliveredStatus === 'delivered' && model.deliveredHasTimestamp)
    check('undo returns the stop to pending', model.undoneStatus === 'pending' && model.undoneHistoryEmpty)

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
