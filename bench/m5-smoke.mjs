/**
 * M5 acceptance checks, in a real browser.
 *
 * These drive the milestone's definition of done, and two of them are the
 * reason this file exists rather than a set of screenshots:
 *
 *  - Snap points are asserted on the sheet's MEASURED offset, never on a class
 *    name or a data attribute. A sheet that reports `data-snap="expanded"`
 *    while sitting at the collapsed offset is exactly the bug that would slip
 *    through an attribute check, and it is the one a driver would feel.
 *  - The scroll/drag conflict is driven with real TOUCH events through CDP,
 *    not mouse drags. A mouse drag on a list does not scroll it, so a mouse
 *    would report the nested-scroll problem as solved whether it is or not.
 *
 *   node bench/m5-smoke.mjs            (expects a build in dist-bench)
 *   node bench/m5-smoke.mjs --headed
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
const STOP_COUNT = 300

const GREEN_GROUP = { id: 'g-green', name: 'Green run', colorHex: '#12823c' }

/**
 * 300 stops, the first eight of which are every row variant the brief names.
 *
 * Both properties matter: the variants have to render, and they have to render
 * inside a list long enough that virtualisation is actually engaged — a
 * six-row fixture would pass every check here while proving nothing about the
 * thing that has to hold at 300.
 */
function seedRoute() {
  const stops = []
  for (let i = 0; i < STOP_COUNT; i++) {
    stops.push({
      id: `stop-${i}`,
      stopId: `D${i + 1}`,
      originalPosition: i + 1,
      lat: 55.66 + (i % 40) * 0.001,
      lng: 12.53 + (i % 37) * 0.0012,
      kind: 'delivery',
      order: 'auto',
      status: 'pending',
      statusHistory: [],
      address: { title: `Elmekrogen ${i + 1}`, subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    })
  }

  // 0 plain · 1 note · 2 first · 3 pickup · 4 delivered · 5 failed
  // 6 two-line title with a recipient · 7 failed inside the GREEN group
  stops[1].notes = 'bike + boks'
  stops[2].order = 'first'
  stops[3].kind = 'pickup'
  stops[4].status = 'delivered'
  stops[4].statusHistory = [{ status: 'delivered', atMs: Date.now() }]
  stops[5].status = 'failed'
  stops[5].statusHistory = [{ status: 'failed', atMs: Date.now() }]
  stops[6].address = { title: 'Rundgården 34, st. th.', subtitle: 'København NV, 2400', source: 'geocoder' }
  stops[6].recipient = 'Jette Kelbjørn'
  stops[7].groupId = GREEN_GROUP.id
  stops[7].status = 'failed'
  stops[7].statusHistory = [{ status: 'failed', atMs: Date.now() }]

  return {
    id: 'route-m5',
    name: 'M5 fixture',
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
        coordinates: [[12.5683, 55.6761], ...stops.map((s) => [s.lng, s.lat]), [12.5701, 55.6867]],
      },
      distanceMeters: 18_400,
      durationSeconds: 7200,
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

/** Seed the persisted v4 blob, then navigate straight at the fixture. See m4-smoke. */
async function seedAndReload(page, route) {
  await page.evaluate(
    ([key, routeData]) =>
      new Promise((resolve, reject) => {
        // No version argument on purpose. The seeder runs AFTER the app has
        // booted, so the database already exists at whatever SCHEMA_VERSION
        // this build ships; naming a version here pins the harness to one
        // release and fails with a VersionError the moment the app migrates
        // past it — which is exactly what M6's geocache store did.
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
  await page.goto(`${page.url().split('#')[0]}#/route/${route.id}`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
}

/** The sheet's actual top edge, in viewport coordinates. The ground truth. */
const sheetTop = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="route-sheet"]').getBoundingClientRect().top)

const snapAttr = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="route-sheet"]').dataset.snap)

/**
 * Tap the handle until the sheet reaches `target`, and give up rather than
 * spin.
 *
 * Bounded on purpose: the first run of this suite had a bare `while` here, and
 * when a bug made the handle unresponsive the loop tapped forever and the whole
 * run had to be killed from outside. A test that hangs on failure reports
 * nothing at all, which is strictly worse than a test that fails.
 */
async function goToSnap(page, target, taps = 6) {
  for (let i = 0; i < taps; i++) {
    if ((await snapAttr(page)) === target) return true
    await page.tap('[data-testid="sheet-handle"]')
    await settle(page)
  }
  return (await snapAttr(page)) === target
}

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

/**
 * A real touch drag: touchStart, a run of touchMoves, touchEnd.
 *
 * Mouse events would not do. A mouse drag over a scrollable div does not
 * scroll it, so every "the list scrolls instead of the sheet" check would pass
 * vacuously — the exact shape of vacuous pass this project has been bitten by
 * before.
 */
async function touchDrag(client, { x, fromY, toY, steps = 14, holdMs = 8 }) {
  const point = (y) => ({ x, y, radiusX: 12, radiusY: 12, force: 1 })
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(fromY)] })
  for (let i = 1; i <= steps; i++) {
    const y = fromY + ((toY - fromY) * i) / steps
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(y)] })
    await new Promise((r) => setTimeout(r, holdMs))
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Fast and slow, as separate profiles — because synthesised gestures do not
 * get speed for free.
 *
 * The sheet reads velocity from the LAST touchMove pair, and every CDP
 * dispatch costs a round trip of its own (~15-25ms) on top of whatever delay
 * the harness asks for. So the speed of a synthetic drag is set almost
 * entirely by the distance per step, and the first version of this file got
 * both of these backwards: a "flick" of 46px over 5 steps came out at 0.46
 * px/ms — just under the fling threshold — while a "slow drag" of 675px over
 * 14 steps came out at 1.4 px/ms and was treated as a fling. Same helper, same
 * arguments, opposite intent.
 */
const flick = (client, opts) => touchDrag(client, { ...opts, steps: 3, holdMs: 0 })
const slowDrag = (client, opts) => touchDrag(client, { ...opts, steps: 30, holdMs: 24 })

async function main() {
  const server = await startServer({ root: DIST })
  const browser = await launchChromium({ headless: !HEADED })
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

  console.log(`\nM5 — the persistent sheet and the route list\n${'─'.repeat(52)}`)

  await page.goto(server.url, { waitUntil: 'load' })
  await seedAndReload(page, seedRoute())
  await page.waitForSelector('[data-testid="route-sheet"]', { timeout: 30_000 })
  await settle(page)

  const H = PHONE.height

  // ───────────────────────────────────────────────────────── the detents
  console.log('\n━━━ the four snap points ━━━\n')

  const collapsedTop = await settle(page)
  check(
    'opens collapsed, showing the summary strip only',
    (await snapAttr(page)) === 'collapsed' && collapsedTop > H * 0.8,
    `top ${Math.round(collapsedTop)}px of ${H}`,
  )

  check(
    'the summary strip states what is LEFT, not the totals',
    ...(await page.evaluate(() => {
      const text = document.querySelector('[data-testid="summary-strip"]')?.textContent ?? ''
      // 297 of the 300 are pending — one is delivered and two failed — so the
      // strip must NOT say 300. That is the whole distinction it exists to
      // make: these are the values remaining, not the totals.
      return [/Finish \d\d:\d\d/.test(text) && /297\s*stops/.test(text) && /\d+ km/.test(text), text.trim()]
    })),
  )

  // Tap the handle repeatedly: collapsed → medium → expanded → full → collapsed.
  const byTap = {}
  for (const expected of ['medium', 'expanded', 'full', 'collapsed']) {
    await page.tap('[data-testid="sheet-handle"]')
    byTap[expected] = { top: await settle(page), snap: await snapAttr(page) }
    check(
      `tapping the handle reaches ${expected}`,
      byTap[expected].snap === expected,
      `top ${Math.round(byTap[expected].top)}px`,
    )
  }

  check(
    'each detent is a genuinely different position',
    byTap.medium.top > byTap.expanded.top && byTap.expanded.top > byTap.full.top,
    `medium ${Math.round(byTap.medium.top)} > expanded ${Math.round(byTap.expanded.top)} > full ${Math.round(byTap.full.top)}`,
  )

  // Drag from the handle. Flicking up from collapsed must land on medium —
  // one detent, not straight to the top.
  const handleY = () =>
    page.evaluate(() => {
      const r = document.querySelector('[data-testid="sheet-handle"]').getBoundingClientRect()
      return r.top + r.height / 2
    })

  /**
   * A SHORT, fast flick — 46px, which is nowhere near any detent.
   *
   * The distance is the point. Released there, the nearest detent is still
   * collapsed by a wide margin, so a sheet that only ever snapped to the
   * nearest one would stay put. Landing on medium is therefore evidence of the
   * fling rule specifically, not of snapping in general. A long fast drag
   * would prove nothing: it ends near a detent anyway.
   */
  const flickFrom = await handleY()
  await flick(client, { x: 195, fromY: flickFrom, toY: flickFrom - 96 })
  const afterFlick = await settle(page)
  check(
    'a flick up from collapsed carries one detent, past the nearest',
    (await snapAttr(page)) === 'medium',
    `${await snapAttr(page)}, top ${Math.round(afterFlick)}px`,
  )

  // Slow, so the sheet settles where the finger left it rather than flinging
  // past — released just below the expanded offset, nearest wins.
  await slowDrag(client, { x: 195, fromY: await handleY(), toY: H * 0.12 })
  await settle(page)
  check(
    'a slow drag settles at the detent it was released nearest',
    (await snapAttr(page)) === 'expanded',
    await snapAttr(page),
  )

  // ────────────────────────────────────────────────────────── the morph
  console.log('\n━━━ the header morph ━━━\n')

  check(
    'expanded shows the hamburger and the search field',
    ...(await page.evaluate(() => {
      const header = document.querySelector('[data-testid="sheet-header"]')
      const visible = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return false
        return el.closest('[inert]') === null && el.getBoundingClientRect().width > 0
      }
      return [
        header?.dataset.morph === 'expanded' && visible('[data-testid="header-menu"]') && visible('[data-testid="sheet-search"]'),
        `morph=${header?.dataset.morph}`,
      ]
    })),
  )

  check(
    'the collapsed layer is inert while expanded, so it holds no tab stops',
    await page.evaluate(
      () => document.querySelector('[data-testid="header-search-icon"]')?.closest('[inert]') !== null,
    ),
  )

  check(
    'the floating drawer trigger stands down once the sheet shows a hamburger',
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="drawer-trigger"]')
      return !el || el.getBoundingClientRect().width === 0
    }),
  )

  await page.tap('[data-testid="sheet-handle"]') // → full
  await settle(page)
  await page.tap('[data-testid="sheet-handle"]') // → collapsed
  await settle(page)
  check(
    'collapsed shows the summary and two icons instead',
    ...(await page.evaluate(() => {
      const header = document.querySelector('[data-testid="sheet-header"]')
      const strip = document.querySelector('[data-testid="summary-strip"]')
      const searchInert = document.querySelector('[data-testid="sheet-search"]')?.closest('[inert]') !== null
      return [header?.dataset.morph === 'collapsed' && !!strip && searchInert, `morph=${header?.dataset.morph}`]
    })),
  )
  check(
    'and the drawer trigger comes back',
    await page.evaluate(
      () => document.querySelector('[data-testid="drawer-trigger"]')?.getBoundingClientRect().width > 0,
    ),
  )

  // Focusing search goes all the way to full — that is what `full` is for.
  await page.tap('[data-testid="header-search-icon"]')
  await settle(page)
  check('tapping the search icon opens the sheet to full', (await snapAttr(page)) === 'full', await snapAttr(page))

  // ─────────────────────────────────────────────── the nested-scroll rule
  console.log('\n━━━ the list scroll versus the sheet drag ━━━\n')

  const listState = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="sheet-list"]')
      return { scrollTop: el.scrollTop, overflowY: getComputedStyle(el).overflowY }
    })

  // Back to expanded, where both the list and the sheet want a vertical drag.
  check('back at expanded for the scroll tests', await goToSnap(page, 'expanded'), await snapAttr(page))

  check('the list is scrollable at expanded', (await listState()).overflowY === 'auto')

  const topBeforeScroll = await sheetTop(page)
  await touchDrag(client, { x: 195, fromY: H * 0.75, toY: H * 0.3, steps: 16, holdMs: 10 })
  await page.waitForTimeout(400)
  const afterListDrag = await listState()
  const topAfterScroll = await sheetTop(page)

  check(
    'dragging UP on the list scrolls the list',
    afterListDrag.scrollTop > 40,
    `scrollTop ${Math.round(afterListDrag.scrollTop)}px`,
  )
  check(
    'and does not move the sheet',
    Math.abs(topAfterScroll - topBeforeScroll) < 2,
    `${Math.round(topBeforeScroll)} → ${Math.round(topAfterScroll)}`,
  )

  // Still scrolled: a downward drag belongs to the list, not the sheet.
  const topMidList = await sheetTop(page)
  await touchDrag(client, { x: 195, fromY: H * 0.4, toY: H * 0.55, steps: 8, holdMs: 12 })
  await page.waitForTimeout(400)
  check(
    'dragging DOWN mid-list scrolls back, leaving the sheet alone',
    Math.abs((await sheetTop(page)) - topMidList) < 2,
    `sheet ${Math.round(topMidList)} → ${Math.round(await sheetTop(page))}`,
  )

  // At the top of the list, the same downward drag is the sheet's.
  await page.evaluate(() => {
    document.querySelector('[data-testid="sheet-list"]').scrollTop = 0
  })
  await page.waitForTimeout(200)
  await touchDrag(client, { x: 195, fromY: H * 0.4, toY: H * 0.75, steps: 12, holdMs: 12 })
  await settle(page)
  check(
    'at the top of the list, a downward drag closes the sheet',
    (await snapAttr(page)) !== 'expanded' && (await sheetTop(page)) > topMidList + 20,
    `→ ${await snapAttr(page)}`,
  )

  // Below expanded the list must not scroll at all — nothing to arbitrate.
  check('reached medium', await goToSnap(page, 'medium'), await snapAttr(page))
  check('the list does not scroll below expanded', (await listState()).overflowY === 'hidden')

  const topBeforeMediumDrag = await sheetTop(page)
  await touchDrag(client, { x: 195, fromY: H * 0.75, toY: H * 0.6, steps: 8, holdMs: 12 })
  await settle(page)
  check(
    'so a drag on the list at medium moves the sheet instead',
    (await sheetTop(page)) < topBeforeMediumDrag - 10,
    `${Math.round(topBeforeMediumDrag)} → ${Math.round(await sheetTop(page))}`,
  )

  // ────────────────────────────────────────────────────────── the rows
  console.log('\n━━━ the route list ━━━\n')

  // Open to full and start from the top of the list.
  check('opened to full for the row checks', await goToSnap(page, 'full'), await snapAttr(page))
  await page.evaluate(() => {
    document.querySelector('[data-testid="sheet-list"]').scrollTop = 0
  })
  await page.waitForTimeout(300)

  check(
    'the list is virtualised — a fraction of 300 rows is in the DOM',
    ...(await page.evaluate((total) => {
      const rendered = document.querySelectorAll('[data-row-kind]').length
      return [rendered > 0 && rendered < 40, `${rendered} of ${total + 4} rows rendered`]
    }, STOP_COUNT)),
  )

  check(
    'the header block leads: title, then two action chips',
    ...(await page.evaluate(() => {
      const header = document.querySelector('[data-row-kind="header"]')
      const chips = header?.querySelectorAll('button') ?? []
      return [
        header?.querySelector('h1')?.textContent === 'M5 fixture' && chips.length === 2,
        `${chips.length} chips`,
      ]
    })),
  )

  check(
    'Share live route and Load vehicle are present and disabled stubs',
    ...(await page.evaluate(() => {
      const chips = [...(document.querySelector('[data-row-kind="header"]')?.querySelectorAll('button') ?? [])]
      const labels = chips.map((c) => c.textContent.trim())
      return [chips.length === 2 && chips.every((c) => c.disabled), labels.join(' | ')]
    })),
  )

  check(
    'the break row sits ABOVE the start location — it is a route property',
    ...(await page.evaluate(() => {
      const kinds = [...document.querySelectorAll('[data-row-kind]')].map((n) => n.dataset.rowKind)
      const b = kinds.indexOf('break')
      const s = kinds.indexOf('start')
      return [b !== -1 && s !== -1 && b < s, kinds.slice(0, 4).join(' → ')]
    })),
  )

  check(
    'the start row explains where its anchor came from',
    ...(await page.evaluate(() => {
      const text = document.querySelector('[data-testid="start-row"]')?.textContent ?? ''
      return [/Used GPS position when optimising/.test(text), text.trim().slice(0, 60)]
    })),
  )

  check(
    'every stop row aligns its title on the same x, whatever the sequence',
    ...(await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-testid="stop-row"]')].slice(0, 8)
      const xs = rows.map((r) => Math.round(r.children[1].getBoundingClientRect().left))
      return [new Set(xs).size === 1, `x = ${[...new Set(xs)].join(', ')}`]
    })),
  )

  check(
    'the sequence is zero-padded to the width of the largest',
    ...(await page.evaluate(() => {
      const first = document.querySelector('[data-testid="stop-row"]')
      const seq = first?.querySelector('.tabular-nums')?.textContent?.trim()
      return [seq === '001', `first row reads "${seq}"`]
    })),
  )

  check(
    'a stop with a note renders it inline',
    ...(await page.evaluate(() => {
      const row = document.querySelector('[data-stop-id="stop-1"]')
      return [/bike \+ boks/.test(row?.textContent ?? ''), row ? 'found' : 'row missing']
    })),
  )

  check(
    'tags appear only where something is non-default',
    ...(await page.evaluate(() => {
      const tagged = document.querySelector('[data-stop-id="stop-2"]')?.querySelector('[data-testid="tag-first"]')
      const pickup = document.querySelector('[data-stop-id="stop-3"]')?.querySelector('[data-testid="tag-pickup"]')
      const plain = document.querySelector('[data-stop-id="stop-0"]')?.querySelectorAll('[data-testid^="tag-"]').length
      return [!!tagged && !!pickup && plain === 0, `first=${!!tagged} pickup=${!!pickup} plain has ${plain}`]
    })),
  )

  check(
    'a delivered stop is badged and a failed one too; a pending stop has no badge',
    ...(await page.evaluate(() => {
      const badge = (id) =>
        document.querySelector(`[data-stop-id="${id}"]`)?.querySelector('[role="img"]')?.getAttribute('aria-label') ?? null
      return [
        badge('stop-4') === 'Delivered' && badge('stop-5') === 'Failed' && badge('stop-0') === null,
        `delivered=${badge('stop-4')} failed=${badge('stop-5')} pending=${badge('stop-0')}`,
      ]
    })),
  )

  /**
   * The critical detail, restated for the list.
   *
   * M4's own version of this check passed vacuously — it asserted a failed
   * stop in a green group was "not red" when unselected chips were white
   * anyway. Here the id chip is ALWAYS the group colour, so the assertion has
   * something real to bite on: green chip, red badge, on the same row.
   */
  check(
    'a failed stop in a green group keeps a GREEN chip and a red badge',
    ...(await page.evaluate(() => {
      const row = document.querySelector('[data-stop-id="stop-7"]')
      const chip = row?.querySelector('span.rounded-row')
      const badge = row?.querySelector('[role="img"]')
      const chipColor = chip ? getComputedStyle(chip).color : ''
      const badgeBg = badge ? getComputedStyle(badge).backgroundColor : ''
      return [
        chipColor === 'rgb(17, 122, 56)' && badgeBg === 'rgb(198, 40, 40)',
        `chip ${chipColor}, badge ${badgeBg}`,
      ]
    })),
  )

  check(
    'a long title with a recipient wraps to two lines rather than truncating',
    ...(await page.evaluate(() => {
      const row = document.querySelector('[data-stop-id="stop-6"]')
      const title = row?.children[1]?.firstElementChild
      const text = title?.textContent ?? ''
      const lines = title ? Math.round(title.getBoundingClientRect().height / 22) : 0
      return [/Jette Kelbjørn/.test(text) && lines >= 2, `${lines} line(s): ${text}`]
    })),
  )

  check(
    'a row with a note is taller than a plain one',
    ...(await page.evaluate(() => {
      const h = (id) => document.querySelector(`[data-stop-id="${id}"]`)?.getBoundingClientRect().height ?? 0
      return [h('stop-1') > h('stop-0'), `plain ${Math.round(h('stop-0'))}px, noted ${Math.round(h('stop-1'))}px`]
    })),
  )

  // ─────────────────────────────────────────────────────── the timeline
  console.log('\n━━━ the timeline connector ━━━\n')

  check(
    'segments abut their neighbours with no gap',
    ...(await page.evaluate(() => {
      const segs = [...document.querySelectorAll('[data-testid="timeline-segment"]')]
        .map((s) => s.getBoundingClientRect())
        .sort((a, b) => a.top - b.top)
      if (segs.length < 3) return [false, `only ${segs.length} segments`]
      let worst = 0
      for (let i = 1; i < segs.length; i++) {
        worst = Math.max(worst, Math.abs(segs[i].top - segs[i - 1].bottom))
      }
      return [worst < 1.5, `${segs.length} segments, largest gap ${worst.toFixed(2)}px`]
    })),
  )

  check(
    'they share one x, so the line is straight',
    ...(await page.evaluate(() => {
      const xs = [...document.querySelectorAll('[data-testid="timeline-segment"]')].map((s) =>
        Math.round(s.getBoundingClientRect().left * 2),
      )
      return [new Set(xs).size === 1, `x = ${[...new Set(xs)].map((v) => v / 2).join(', ')}`]
    })),
  )

  check(
    'the start row caps the line at its own middle rather than running off',
    ...(await page.evaluate(() => {
      const seg = document.querySelector('[data-testid="start-row"] [data-testid="timeline-segment"]')
      const row = document.querySelector('[data-testid="start-row"]')
      if (!seg || !row) return [false, 'start row missing']
      const s = seg.getBoundingClientRect()
      const r = row.getBoundingClientRect()
      return [seg.dataset.variant === 'bottom' && Math.abs(s.top - (r.top + r.height / 2)) < 2, seg.dataset.variant]
    })),
  )

  // ───────────────────────────────────────────────────── the end row
  console.log('\n━━━ the end row breaks the grammar deliberately ━━━\n')

  await page.evaluate(() => {
    const list = document.querySelector('[data-testid="sheet-list"]')
    list.scrollTop = list.scrollHeight
  })
  await page.waitForTimeout(500)

  check(
    'it carries a flag, no sequence number and no id chip',
    ...(await page.evaluate(() => {
      const row = document.querySelector('[data-testid="end-row"]')
      if (!row) return [false, 'end row not rendered']
      const hasChip = !!row.querySelector('span.rounded-row')
      const hasSvg = !!row.querySelector('svg')
      return [!hasChip && hasSvg, `chip=${hasChip} glyph=${hasSvg}`]
    })),
  )

  check(
    'and a highlighted background, so it reads as a terminus',
    ...(await page.evaluate(() => {
      const bg = getComputedStyle(document.querySelector('[data-testid="end-row"]')).backgroundColor
      return [bg === 'rgb(241, 243, 246)', bg]
    })),
  )

  check(
    'the completed action is OUTLINED, not a filled blue button',
    ...(await page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-row-kind="footer"] button')][0]
      if (!button) return [false, 'footer not rendered']
      const style = getComputedStyle(button)
      return [
        style.borderStyle === 'solid' && style.backgroundColor === 'rgb(255, 255, 255)',
        `${style.backgroundColor}, border ${style.borderStyle}`,
      ]
    })),
  )

  // ───────────────────────────────────────────────────────── the jump FAB
  console.log('\n━━━ the jump-to-next FAB ━━━\n')

  const scrolledToEnd = await page.evaluate(
    () => document.querySelector('[data-testid="sheet-list"]').scrollTop,
  )
  await page.tap('[data-testid="jump-fab"]')
  await page.waitForTimeout(900)
  const afterJump = await page.evaluate(
    () => document.querySelector('[data-testid="sheet-list"]').scrollTop,
  )
  check(
    'it jumps back to the next pending stop',
    afterJump < scrolledToEnd - 100,
    `scrollTop ${Math.round(scrolledToEnd)} → ${Math.round(afterJump)}`,
  )
  check(
    'and lands with that stop on screen',
    await page.evaluate(() => {
      const row = document.querySelector('[data-stop-id="stop-0"]')
      if (!row) return false
      const r = row.getBoundingClientRect()
      return r.top > 0 && r.bottom < window.innerHeight
    }),
  )

  // ─────────────────────────────────────────────── search (M6)
  console.log('\n━━━ search answers two questions in one field ━━━\n')

  /**
   * M5 asserted that typing did NOT filter the list. M6 owns search, so that
   * contract is deliberately replaced rather than deleted: search now swaps
   * the route list for a screen with two sections.
   *
   * Only the existing-stops half is asserted here. The "Add a new stop" half
   * calls a live geocoder over the network, which is neither offline-safe nor
   * deterministic, and a smoke test that spends someone's API quota on every
   * run is a bad trade.
   */
  await page.fill('[data-testid="sheet-search"]', 'Elmekrogen 200')
  await page.waitForTimeout(250)

  check(
    'typing replaces the route list with the search screen',
    ...(await page.evaluate(() => {
      const search = document.querySelector('[data-testid="search-screen"]')
      const list = document.querySelector('[data-testid="route-list"]')
      return [!!search && !list, `search=${!!search} list=${!!list}`]
    })),
  )

  check(
    'an existing stop appears under "From this route"',
    ...(await page.evaluate(() => {
      const section = document.querySelector('[data-testid="section-existing"]')
      const heading = section?.querySelector('h2')?.textContent ?? ''
      const rows = section?.querySelectorAll('[data-testid="stop-row"]') ?? []
      return [rows.length === 1 && heading.includes('(1)'), `${heading} — ${rows.length} row(s)`]
    })),
  )

  /**
   * The workflow the whole screen exists for: a driver holding a parcel
   * with "D7" written on it types D7 and gets that stop, rendered with the
   * same ID chip they are reading off the box.
   */
  await page.fill('[data-testid="sheet-search"]', 'D7')
  await page.waitForTimeout(250)
  check(
    'searching a stop ID finds that parcel, ID chip and all',
    ...(await page.evaluate(() => {
      const row = document.querySelector('[data-testid="section-existing"] [data-testid="stop-row"]')
      const chip = row?.textContent?.includes('D7')
      const title = row?.textContent?.includes('Rundgården') ?? false
      return [Boolean(chip && title), row ? row.textContent.slice(0, 60) : 'no row']
    })),
  )

  // Danish folding: "ø" and "æ" have no canonical decomposition, so an ASCII
  // query only works because searchScreen.ts maps them explicitly.
  await page.fill('[data-testid="sheet-search"]', 'rundgarden')
  await page.waitForTimeout(250)
  check(
    'an ASCII query finds a Danish address',
    ...(await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="section-existing"] [data-testid="stop-row"]')
      return [rows.length >= 1, `${rows.length} row(s)`]
    })),
  )

  await page.tap('[data-testid="header-search-cancel"]')
  await page.waitForTimeout(250)
  check(
    'Cancel restores the route list',
    ...(await page.evaluate(() => {
      const list = document.querySelector('[data-testid="route-list"]')
      const search = document.querySelector('[data-testid="search-screen"]')
      return [!!list && !search, `list=${!!list} search=${!!search}`]
    })),
  )

  // ─────────────────────────────────────────── the map chrome clears it
  console.log('\n━━━ the map chrome clears the sheet ━━━\n')

  await page.evaluate(() => {
    document.querySelector('[data-testid="sheet-list"]').scrollTop = 0
  })
  check('collapsed again for the chrome checks', await goToSnap(page, 'collapsed'), await snapAttr(page))

  check(
    'the FAB stack sits above the collapsed sheet, not under it',
    ...(await page.evaluate(() => {
      const fab = document.querySelector('[data-testid="fab-contextual"]')
      const sheet = document.querySelector('[data-testid="route-sheet"]')
      if (!fab) return [false, 'no contextual FAB']
      const f = fab.getBoundingClientRect()
      const s = sheet.getBoundingClientRect()
      const hit = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2)
      return [f.bottom <= s.top + 1 && fab.contains(hit), `fab bottom ${Math.round(f.bottom)}, sheet top ${Math.round(s.top)}`]
    })),
  )

  /**
   * The floating controls must not land on each other.
   *
   * The first version of the M5 offsets computed the Calculate FAB's position
   * and the map stack's position independently, and put Calculate exactly on
   * top of the basemap button. Nothing looked wrong; the button simply stopped
   * working, and it took the M4 suite reporting "Calculate route intercepts
   * pointer events" to find it. This is the check that would have caught it
   * here.
   */
  check(
    'the map FABs and the Calculate FAB do not overlap each other',
    ...(await page.evaluate(() => {
      const boxes = ['fab-basemap', 'fab-contextual']
        .map((id) => document.querySelector(`[data-testid="${id}"]`))
        .filter(Boolean)
        .map((el) => el.getBoundingClientRect())
      const calc = document.querySelector('button[aria-label^="Calculate"]')?.getBoundingClientRect()
      if (!calc || boxes.length < 2) return [false, 'a floating control is missing']
      const overlaps = boxes.filter((b) => b.left < calc.right && b.right > calc.left && b.top < calc.bottom && b.bottom > calc.top)
      return [overlaps.length === 0, `${overlaps.length} overlap(s); calc bottom ${Math.round(calc.bottom)}, stack top ${Math.round(Math.min(...boxes.map((b) => b.top)))}`]
    })),
  )

  check(
    '--sheet-peek is the measured collapsed height, not a constant',
    ...(await page.evaluate(() => {
      const published = getComputedStyle(document.documentElement).getPropertyValue('--sheet-peek').trim()
      const sheet = document.querySelector('[data-testid="route-sheet"]').getBoundingClientRect()
      const visible = Math.round(window.innerHeight - sheet.top)
      return [Math.abs(Number.parseFloat(published) - visible) <= 2, `${published} vs ${visible}px visible`]
    })),
  )

  // ─────────────────────────────────── the legacy panels are reachable
  console.log('\n━━━ route setup, behind the overflow ━━━\n')

  /*
    M7 moved this one step further away, deliberately.

    The overflow used to open the setup panel directly. It now opens the
    route's own menu, and the panel is one item inside it — "Reoptimise
    route…", which is where the endpoints, the objective, the search tier and
    Calculate belong. The M1 controls are all still reachable, which is what
    this check has always been about; only the path changed.
  */
  await page.tap('[data-testid="header-overflow-collapsed"]')
  await page.waitForSelector('[data-testid="menu-reoptimise"]', { timeout: 5000 })
  await page.tap('[data-testid="menu-reoptimise"]')
  await page.waitForSelector('[data-testid="route-setup"]', { timeout: 5000 })
  check(
    'the overflow still reaches every M1 control',
    ...(await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="route-setup"]')
      const text = panel?.textContent ?? ''
      const hasFile = !!panel?.querySelector('input[type="file"]')
      return [hasFile && /Calculate/i.test(text), `file input=${hasFile}`]
    })),
  )

  // ────────────────────────────────────────────────────────────── errors
  console.log('\n━━━ no errors along the way ━━━\n')
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

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
