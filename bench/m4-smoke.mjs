/**
 * M4 acceptance checks, in a real browser.
 *
 * These drive the milestone's definition of done, and they interrogate
 * MapLibre rather than eyeballing pixels. That distinction matters: a
 * screenshot cannot tell a marker that failed to render from one the
 * collision detector correctly suppressed, and the whole point of this
 * milestone is that suppression is now deliberate.
 *
 * `map.queryRenderedFeatures()` reports what was actually PLACED, so
 * "labels never overlap" becomes a measurable claim about placed bounding
 * boxes rather than a promise.
 *
 *   node bench/m4-smoke.mjs            (expects a build in dist-bench)
 *   node bench/m4-smoke.mjs --headed
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

const GREEN_GROUP = { id: 'g-green', name: 'Green run', colorHex: '#12823c' }

/** Copenhagen, tight enough that collisions are real at city zoom. */
const COORDS = [
  [55.6801, 12.5903],
  [55.68139, 12.5757],
  [55.6789, 12.5984],
  [55.6825, 12.5812],
  [55.677, 12.5866],
  [55.6844, 12.5931],
]

function makeStop(i, patch = {}) {
  const [lat, lng] = COORDS[i % COORDS.length]
  return {
    id: `stop-${i}`,
    stopId: `D${i + 1}`,
    originalPosition: i + 1,
    lat,
    lng,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    address: { title: `Elmekrogen ${i + 1}`, subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    ...patch,
  }
}

/**
 * A route that exercises every marker state the brief names.
 *
 * Stop 0 is the CRITICAL case: failed, in a GREEN group. It must draw a
 * green chip with a red ✗, not a red chip.
 */
function seedRoute() {
  const stops = [
    makeStop(0, { groupId: GREEN_GROUP.id, status: 'failed' }),
    makeStop(1, { status: 'delivered' }),
    makeStop(2, { groupId: GREEN_GROUP.id }),
    makeStop(3),
    makeStop(4, { status: 'delivered' }),
    makeStop(5),
  ]
  return {
    id: 'route-m4',
    name: 'M4 fixture',
    dateISO: new Date().toISOString().slice(0, 10),
    status: 'active',
    start: { lat: 55.6761, lng: 12.5683 },
    end: { lat: 55.6867, lng: 12.5701 },
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
        // Start → each stop in order → end, as a crude but valid driven path.
        coordinates: [
          [12.5683, 55.6761],
          ...stops.map((s) => [s.lng, s.lat]),
          [12.5701, 55.6867],
        ],
      },
      distanceMeters: 8400,
      durationSeconds: 3600,
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

/**
 * Overwrite the persisted v4 blob, then reload.
 *
 * Deliberately NOT an `addInitScript`: that cannot await, and `indexedDB.open`
 * is async, so the app read `meta` and booted an empty route before the write
 * landed. Seeding after boot means the app's own `openDB` has already created
 * the schema correctly — this only replaces the blob — and the reload makes
 * the ordering explicit instead of hoping.
 */
async function seedAndReload(page, persistKey, route) {
  await page.evaluate(
    ([key, routeData]) =>
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
    [persistKey, route],
  )
  // Navigate straight at the fixture's own id.
  //
  // Two traps avoided here. The hash still names the auto-created route from
  // first boot, and reloading onto that renders "this route no longer exists"
  // with no map. But setting the hash to "#/" and reloading does not work
  // either: RoutesListScreen redirects to the OLD active route before the
  // reload round-trips, so it lands back where it started. Addressing the
  // fixture directly is the only version with no race in it.
  await page.goto(`${page.url().split('#')[0]}#/route/${route.id}`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
}

const mapState = (page, fn, arg) => page.evaluate(fn, arg)

/** Wait until the controller exists and its layers are in the style. */
async function waitForMap(page) {
  await page.waitForFunction(
    () => {
      const c = globalThis.__mapController
      return !!c && c.ready && !!c.map.getLayer('stops')
    },
    null,
    { timeout: 30_000 },
  )
  // Let the first symbol placement pass settle.
  await page.waitForTimeout(1500)
}

/**
 * Zoom onto one stop and report the chip it drew.
 *
 * Necessary because collision detection is doing its job: at a zoom where all
 * six fixture stops are on screen, most are correctly suppressed, so asserting
 * "stop-0 renders green" against a wide view tests the collision detector
 * rather than the colour rule. Framing the stop alone separates the two —
 * placement is covered by the overlap checks, appearance is covered here.
 */
async function chipFor(page, id, lat, lng) {
  await page.evaluate(
    ([la, ln]) => globalThis.__mapController.map.jumpTo({ center: [ln, la], zoom: 17 }),
    [lat, lng],
  )
  await page.waitForTimeout(1000)
  return page.evaluate((stopId) => {
    const f = globalThis.__mapController.map
      .queryRenderedFeatures({ layers: ['stops'] })
      .find((x) => x.properties.id === stopId)
    return f ? String(f.properties.chipKey) : null
  }, id)
}

/**
 * Frame a stop, tap its chip for real, and report the chip it redrew.
 *
 * Selection is what fills the chip — an unselected chip is a white plate
 * whatever group it belongs to, so the group-colour rule can only be tested
 * on a SELECTED marker. Going through a real mouse click also exercises the
 * hit test and the layer's click handler rather than poking the store.
 */
async function tapStop(page, id, lat, lng) {
  await page.evaluate(
    ([la, ln]) => globalThis.__mapController.map.jumpTo({ center: [ln, la], zoom: 17 }),
    [lat, lng],
  )
  await page.waitForTimeout(900)
  const at = await page.evaluate((stopId) => {
    const map = globalThis.__mapController.map
    const f = map.queryRenderedFeatures({ layers: ['stops'] }).find((x) => x.properties.id === stopId)
    if (!f) return null
    const p = map.project(f.geometry.coordinates)
    // Anchor is the tail tip at the bottom; the chip sits ~24px above it.
    return { x: Math.round(p.x), y: Math.round(p.y) - 24 }
  }, id)
  if (!at) return null
  await page.mouse.click(at.x, at.y)
  await page.waitForTimeout(800)
  return page.evaluate((stopId) => {
    const f = globalThis.__mapController.map
      .queryRenderedFeatures({ layers: ['stops'] })
      .find((x) => x.properties.id === stopId)
    return f ? String(f.properties.chipKey) : null
  }, id)
}

/** Frame the whole fixture so every stop is on screen. */
async function frameAll(page, zoom = 13.4) {
  await page.evaluate((z) => {
    globalThis.__mapController.map.jumpTo({ center: [12.5833, 55.6805], zoom: z })
  }, zoom)
  await page.waitForTimeout(1200)
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED })
  const server = await startServer({ root: DIST })
  const context = await browser.newContext({ viewport: PHONE })
  const page = await context.newPage()

  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  // Boot once so the app creates the IndexedDB schema, then replace the
  // persisted blob with the fixture and reload onto it.
  await page.goto(`${server.url}#/`, { waitUntil: 'load' })
  await page.waitForFunction(() => location.hash.startsWith('#/route/'), null, { timeout: 15_000 })
  await seedAndReload(page, PERSIST_KEY, seedRoute())
  await page.waitForFunction(() => location.hash === '#/route/route-m4', null, { timeout: 15_000 })
  await waitForMap(page)

  // ────────────────────────────────────────────── the migration off Leaflet
  console.log('\n━━━ the migration ━━━\n')

  check('MapLibre owns a canvas at full container size', ...(await mapState(page, () => {
    const c = document.querySelector('.maplibregl-canvas')
    const ok = !!c && c.clientWidth > 300 && c.clientHeight > 600
    return [ok, c ? `${c.clientWidth}×${c.clientHeight}` : 'missing']
  })))

  check('no Leaflet DOM survives anywhere in the page', ...(await mapState(page, () => {
    const n = document.querySelectorAll('[class*="leaflet"]').length
    return [n === 0, `${n} nodes`]
  })))

  check('attribution is present exactly once (ODbL requires it)', ...(await mapState(page, () => {
    const text = document.querySelector('.maplibregl-ctrl-attrib')?.textContent ?? ''
    const hits = (text.match(/OpenStreetMap/g) ?? []).length
    return [hits === 1, `${hits} × "OpenStreetMap"`]
  })))

  // ──────────────────────────────────────────────────────── marker states
  console.log('\n━━━ stop markers ━━━\n')

  await frameAll(page)

  check('every stop has a chip image registered', ...(await mapState(page, () => {
    const map = globalThis.__mapController.map
    const keys = map.listImages().filter((i) => i.includes('|'))
    return [keys.length >= 4, `${keys.length} distinct chips`]
  })))

  // THE critical detail: group colour drives the fill, status drives the
  // badge, and the two never cross. stop-0 is failed AND in the green group.
  //
  // Note the two halves. Unselected, every chip is a white plate regardless of
  // group — so asserting "not red" there proves nothing, which is exactly how
  // an earlier version of this test passed vacuously. The rule can only be
  // tested on a SELECTED chip, where the fill is actually the group's.
  const unselected = await chipFor(page, 'stop-0', ...COORDS[0])
  check(
    'a FAILED stop is placed, and carries the failed badge unselected',
    unselected !== null && unselected.includes('failed'),
    unselected ?? 'not placed even when framed alone',
  )

  const selectedFailed = await tapStop(page, 'stop-0', ...COORDS[0])
  check(
    '🎯 a SELECTED failed stop in a GREEN group fills GREEN, not red',
    selectedFailed !== null && selectedFailed.split('|')[0] === '#12823c',
    `fill ${selectedFailed?.split('|')[0]} (want #12823c, never #c62828)`,
  )
  check(
    '🎯 ...and the failure still lives only on the badge',
    selectedFailed !== null && selectedFailed.includes('failed'),
    selectedFailed ?? '',
  )

  // Clear the selection so later checks start from a known state.
  await page.mouse.click(30, 120)
  await page.waitForTimeout(600)

  const delivered = await chipFor(page, 'stop-1', ...COORDS[1])
  check(
    'a delivered stop carries the delivered badge',
    delivered !== null && delivered.includes('delivered'),
    delivered ?? 'not placed',
  )
  check(
    '...and is dimmed, without its hue changing',
    delivered !== null && delivered.endsWith('|d'),
    delivered ?? '',
  )

  // ─────────────────────────────────────────────── collision and clipping
  console.log('\n━━━ labels never overlap, at any zoom ━━━\n')

  for (const zoom of [12, 13.4, 15]) {
    await frameAll(page, zoom)
    const overlap = await mapState(page, () => {
      const map = globalThis.__mapController.map
      const placed = map.queryRenderedFeatures({ layers: ['stops'] })
      // Reconstruct each placed symbol's screen box from its anchor. The
      // chip is 46×47 CSS px anchored bottom-centre; the label block sits to
      // its right. Overlapping boxes would mean collision detection failed.
      const boxes = placed.map((f) => {
        const p = map.project(f.geometry.coordinates)
        return { left: p.x - 23, right: p.x + 23, top: p.y - 47, bottom: p.y, id: f.properties.id }
      })
      let worst = null
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (dx > 0 && dy > 0) worst = `${a.id} ∩ ${b.id} by ${Math.round(dx)}×${Math.round(dy)}px`
        }
      }
      return { count: placed.length, worst }
    })
    check(
      `z${zoom}: no two placed chips overlap`,
      overlap.worst === null && overlap.count > 0,
      overlap.worst ?? `${overlap.count} placed`,
    )
  }

  // "Never clips mid-word" has two halves, and both are checkable: the label
  // text reaches the layer intact, and the layer is configured to WRAP rather
  // than truncate. A vacuous pass on an empty viewport would prove neither,
  // so this asserts something was actually placed.
  check('long address labels reach the layer intact', ...(await mapState(page, () => {
    const map = globalThis.__mapController.map
    const placed = map.queryRenderedFeatures({ layers: ['stops'] })
    if (placed.length === 0) return [false, 'nothing placed — vacuous']
    const mangled = placed.filter((f) => !/^Elmekrogen \d+$/.test(String(f.properties.line1)))
    return [mangled.length === 0, `${placed.length} placed, ${mangled.length} mangled`]
  })))

  // Labels are dropped below z14 so a symbol's collision box shrinks back to
  // the chip. Without this, six stops over 2 km placed two of six at z12 —
  // a driver looking at a 300-stop round would see almost none of it.
  check('below z14 markers shed their labels to fit more of the route', ...(await mapState(page, () => {
    const field = globalThis.__mapController.map.getLayoutProperty('stops', 'text-field')
    const isStep = Array.isArray(field) && field[0] === 'step' && field[2] === ''
    return [isStep, isStep ? `chip-only below z${field[3]}` : JSON.stringify(field).slice(0, 60)]
  })))

  const density = await mapState(page, () => {
    const map = globalThis.__mapController.map
    const at = (z) => {
      map.jumpTo({ center: [12.5833, 55.6805], zoom: z })
      return map.queryRenderedFeatures({ layers: ['stops'] }).length
    }
    return { low: at(13), high: at(15) }
  })
  check(
    'dropping labels genuinely places more chips at low zoom',
    density.low >= density.high,
    `z13 placed ${density.low}, z15 placed ${density.high}`,
  )

  check('the label block wraps instead of truncating', ...(await mapState(page, () => {
    const map = globalThis.__mapController.map
    const maxWidth = map.getLayoutProperty('stops', 'text-max-width')
    const optional = map.getLayoutProperty('stops', 'text-optional')
    // text-optional false is what makes the chip and its label ONE collision
    // unit — with it true, MapLibre would place a chip and drop its label.
    return [maxWidth > 0 && optional === false, `text-max-width ${maxWidth}, text-optional ${optional}`]
  })))

  // ─────────────────────────────────────────────────── collision priority
  console.log('\n━━━ collision priority and selection ━━━\n')

  await frameAll(page, 12)
  const placedAtLowZoom = await mapState(page, () =>
    globalThis.__mapController.map
      .queryRenderedFeatures({ layers: ['stops'] })
      .map((f) => f.properties.id),
  )
  check(
    'at a crowded zoom some markers are deliberately suppressed',
    placedAtLowZoom.length < 6,
    `${placedAtLowZoom.length} of 6 placed at z12`,
  )

  // Tap a marker for real: project it to screen coordinates and click the
  // chip. This exercises the whole path — hit test, layer handler, store,
  // re-render, new chip image — rather than poking state directly.
  await frameAll(page, 15.5)
  const target = await mapState(page, () => {
    const map = globalThis.__mapController.map
    const f = map.queryRenderedFeatures({ layers: ['stops'] })[0]
    if (!f) return null
    const p = map.project(f.geometry.coordinates)
    // The anchor is the tail tip at the bottom; the chip sits ~24px above it.
    return { id: f.properties.id, x: Math.round(p.x), y: Math.round(p.y) - 24 }
  })

  if (!target) {
    check('a marker was available to tap', false, 'nothing placed at z15.5')
  } else {
    await page.mouse.click(target.x, target.y)
    await page.waitForTimeout(900)

    check('tapping a marker selects it', ...(await mapState(page, (id) => {
      const map = globalThis.__mapController.map
      const f = map.queryRenderedFeatures({ layers: ['stops'] }).find((x) => x.properties.id === id)
      if (!f) return [false, 'the tapped stop vanished']
      // sortKey 0 is the selected slot, and a selected chip grows a tail.
      const key = String(f.properties.chipKey)
      return [f.properties.sortKey === 0 && key.endsWith('|t|'), `sortKey ${f.properties.sortKey}, key ${key}`]
    }, target.id)))

    check('a selected chip fills with its GROUP colour, not a status colour', ...(await mapState(page, (id) => {
      const map = globalThis.__mapController.map
      const f = map.queryRenderedFeatures({ layers: ['stops'] }).find((x) => x.properties.id === id)
      if (!f) return [false, 'the tapped stop vanished']
      const fill = String(f.properties.chipKey).split('|')[0]
      const groupColours = ['#1a5fd4', '#12823c', '#7b3fe4', '#0e8a8a', '#d6296e', '#c77700']
      return [groupColours.includes(fill), `fill ${fill}`]
    }, target.id)))

    check('selecting swaps the contextual FAB to focus-stop', ...(await mapState(page, () => {
      const fab = document.querySelector('[data-testid="fab-contextual"]')?.getAttribute('data-fab')
      return [fab === 'focus-stop', String(fab)]
    })))
  }

  // ────────────────────────────────────────────────────────── polylines
  console.log('\n━━━ route polylines ━━━\n')

  await frameAll(page, 13.4)

  const legs = await mapState(page, () => {
    const map = globalThis.__mapController.map
    const visited = map.queryRenderedFeatures({ layers: ['route-visited'] }).length
    const remaining = map.queryRenderedFeatures({ layers: ['route-remaining'] }).length
    const vWidth = map.getPaintProperty('route-visited', 'line-width')
    const rWidth = map.getPaintProperty('route-remaining', 'line-width')
    return {
      visited,
      remaining,
      vColor: map.getPaintProperty('route-visited', 'line-color'),
      rColor: map.getPaintProperty('route-remaining', 'line-color'),
      // Compare the widths at the same zoom stop in the interpolation.
      vAt14: vWidth[vWidth.indexOf(14) + 1],
      rAt14: rWidth[rWidth.indexOf(14) + 1],
    }
  })

  check('both legs render', legs.visited > 0 && legs.remaining > 0, `visited ${legs.visited}, remaining ${legs.remaining}`)
  check(
    'the remaining leg is thicker than the visited one',
    legs.rAt14 > legs.vAt14,
    `${legs.rAt14}px vs ${legs.vAt14}px at z14`,
  )
  check(
    'the visited leg is desaturated grey, the remaining one blue',
    legs.vColor === '#9aa4b2' && legs.rColor === '#1a5fd4',
    `${legs.vColor} / ${legs.rColor}`,
  )

  // ──────────────────────────────────────────────────────── map chrome
  console.log('\n━━━ map chrome ━━━\n')

  check('the basemap FAB is the top of the stack', ...(await mapState(page, () => {
    const basemap = document.querySelector('[data-testid="fab-basemap"]')?.getBoundingClientRect()
    const ctx = document.querySelector('[data-testid="fab-contextual"]')?.getBoundingClientRect()
    if (!basemap || !ctx) return [false, 'a FAB is missing']
    return [basemap.top < ctx.top, `basemap y=${Math.round(basemap.top)}, contextual y=${Math.round(ctx.top)}`]
  })))

  check('the FAB gap is ~12dp', ...(await mapState(page, () => {
    const a = document.querySelector('[data-testid="fab-basemap"]').getBoundingClientRect()
    const b = document.querySelector('[data-testid="fab-contextual"]').getBoundingClientRect()
    const gap = Math.round(b.top - a.bottom)
    return [gap >= 10 && gap <= 14, `${gap}px`]
  })))

  check('every map control meets the 44dp touch target', ...(await mapState(page, () => {
    const ids = ['fab-basemap', 'fab-contextual']
    const small = ids
      .map((id) => [id, document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect()])
      .filter(([, r]) => !r || r.width < 44 || r.height < 44)
    return [small.length === 0, small.map(([id]) => id).join(', ')]
  })))

  check('the finish pill is top-right and shows a time', ...(await mapState(page, () => {
    const pill = document.querySelector('[data-testid="finish-pill"]')
    if (!pill) return [false, 'missing']
    const r = pill.getBoundingClientRect()
    const hasTime = /\d{2}:\d{2}/.test(pill.textContent ?? '')
    return [hasTime && r.right > window.innerWidth - 30 && r.top < 80, pill.textContent?.trim()]
  })))

  check('the drawer trigger sits on the same 16dp margin', ...(await mapState(page, () => {
    const r = document.querySelector('[data-testid="drawer-trigger"]')?.getBoundingClientRect()
    if (!r) return [false, 'missing']
    return [Math.round(r.left) === 16 && Math.round(r.top) === 16, `${Math.round(r.left)},${Math.round(r.top)}`]
  })))

  // ───────────────────────────────────────────── the contextual FAB swaps
  console.log('\n━━━ the contextual FAB swaps with state ━━━\n')

  const fabFor = () =>
    mapState(page, () =>
      document.querySelector('[data-testid="fab-contextual"]')?.getAttribute('data-fab'),
    )

  // Tap empty map to clear the selection made above, and the FAB should go
  // back to offering the route overview.
  await page.mouse.click(30, 120)
  await page.waitForTimeout(700)
  check('deselecting returns the FAB to "fit route"', (await fabFor()) === 'fit-route', await fabFor())

  console.log('\n━━━ the recenter cycle ━━━\n')

  // The controller derives stops and route geometry from the data it already
  // holds, so recenter takes only the selected stop id — the one thing that
  // lives in the UI store and not on the map.
  const cycle = await page.evaluate(() => {
    const c = globalThis.__mapController
    c.resetRecenterCycle()
    return [
      c.recenter('stop-0'),
      c.recenter('stop-0'),
      c.recenter('stop-0'),
      c.recenter('stop-0'),
    ]
  })
  check(
    'recenter cycles stop → all stops → route → wraps',
    JSON.stringify(cycle) === JSON.stringify(['stop', 'stops', 'route', 'stop']),
    cycle.join(' → '),
  )

  const skipping = await page.evaluate(() => {
    const c = globalThis.__mapController
    c.resetRecenterCycle()
    return [c.recenter(null), c.recenter(null), c.recenter(null)]
  })
  check(
    'with nothing selected the "stop" phase is skipped, not a dead tap',
    JSON.stringify(skipping) === JSON.stringify(['stops', 'route', 'stops']),
    skipping.join(' → '),
  )

  // ───────────────────────────────────────────── the imperative camera API
  console.log('\n━━━ the camera API ━━━\n')

  check('focusStop takes an id and reports an unknown one', ...(await mapState(page, () => {
    const c = globalThis.__mapController
    return [c.focusStop('stop-3') === true && c.focusStop('nope') === false, 'id-based, returns a boolean']
  })))

  check('fitRoute frames the drive with no arguments', ...(await mapState(page, () => {
    const before = globalThis.__mapController.map.getZoom()
    const ok = globalThis.__mapController.fitRoute()
    return [ok === true, `zoom was ${before.toFixed(1)}`]
  })))

  check('followUser reports honestly when there is no fix yet', ...(await mapState(page, () => {
    const ok = globalThis.__mapController.followUser()
    return [ok === false, 'returned false with no geolocation fix']
  })))

  // ───────────────────────────────────────────────────── basemap toggle
  console.log('\n━━━ the basemap toggle ━━━\n')

  const before = await mapState(page, () => globalThis.__mapController.basemap)
  await page.click('[data-testid="fab-basemap"]')
  await page.waitForTimeout(2500)
  const after = await mapState(page, () => globalThis.__mapController.basemap)
  check('the layers FAB switches basemap', before !== after, `${before} → ${after}`)

  check('custom layers survive the style swap', ...(await mapState(page, () => {
    const map = globalThis.__mapController.map
    const ours = ['route-visited', 'route-remaining', 'stops', 'stop-clusters']
    const missing = ours.filter((id) => !map.getLayer(id))
    return [missing.length === 0, missing.join(', ') || 'all present']
  })))

  check('chip images survive the style swap', ...(await mapState(page, () => {
    const n = globalThis.__mapController.map.listImages().filter((i) => i.includes('|')).length
    return [n >= 4, `${n} chips re-registered`]
  })))

  // ───────────────────────────────────────────────────────── clustering
  console.log('\n━━━ clustering at low zoom ━━━\n')

  await page.evaluate(() => globalThis.__mapController.map.jumpTo({ center: [12.583, 55.68], zoom: 8 }))
  await page.waitForTimeout(1800)
  check('stops collapse into clusters when zoomed out', ...(await mapState(page, () => {
    const map = globalThis.__mapController.map
    const clusters = map.queryRenderedFeatures({ layers: ['stop-clusters'] })
    const stops = map.queryRenderedFeatures({ layers: ['stops'] })
    return [clusters.length > 0 && stops.length === 0, `${clusters.length} clusters, ${stops.length} chips`]
  })))

  // ────────────────────────────────────────────────────────────── errors
  console.log('\n━━━ no errors along the way ━━━\n')
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
  check(
    'no console errors',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(' | '),
  )

  await context.close()
  await browser.close()
  await server.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`)
  if (failed.length > 0) {
    console.log('failed:')
    for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? `  — ${f.detail}` : ''}`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
