/**
 * M3 acceptance checks, in a real browser.
 *
 * These drive the milestone's definition of done end to end: create a named,
 * dated route, find it under the right section header, open it, rename it,
 * duplicate it, and delete it — with the confirmation actually blocking the
 * delete. They also assert the two things that are easy to eyeball wrong: that
 * the drawer really is a side sheet with a live strip of the screen behind it,
 * and that every control someone taps with a thumb is at least 44dp.
 *
 *   node bench/m3-smoke.mjs            (expects a build in dist-bench)
 *   node bench/m3-smoke.mjs --headed
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, process.argv.find((a) => a.startsWith('--dist='))?.split('=')[1] ?? 'dist-bench')
const HEADED = process.argv.includes('--headed')

/** A phone, because that is what this milestone is designed for. */
const PHONE = { width: 390, height: 844 }

/**
 * The same legacy session m1-smoke uses. Migration turns it into one route
 * with three stops, one of them already delivered — which is what makes the
 * route row's summary line testable against real data rather than a fixture
 * invented for the test.
 */
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
    favorites: [],
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

const DRAWER = '[role="dialog"][aria-label="Your routes"]'

/**
 * Wait for the sheet transition to finish.
 *
 * This used to claim that and then sleep for a flat 400ms, which is a guess,
 * not a wait — and M4 exposed it: with MapLibre competing for the main thread
 * the drawer's close animation ran past the window and "tapping the exposed
 * strip closes the drawer" started failing on a drawer that closes perfectly
 * well, just ~100ms later.
 *
 * `document.getAnimations()` reports running CSS transitions, so this now
 * waits for the actual condition. MapLibre animates with rAF rather than the
 * Web Animations API, so it never appears here and cannot hold the wait open.
 */
const settle = async (page) => {
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.playState !== 'running'),
      null,
      { timeout: 5_000 },
    )
    .catch(() => {})
  // One frame for React to commit the unmount the transition's end triggers.
  await page.waitForTimeout(50)
}

/**
 * Open the drawer from the FLOATING trigger specifically.
 *
 * This used to select on `button[aria-label="Your routes"]`, which stopped
 * being unique in M5: the route sheet's header morphs to show a hamburger with
 * the same accessible name. That is correct — only one of the two is ever
 * exposed, since the other sits inside an `inert` layer — but a name-based
 * selector cannot tell them apart, and this one silently began resolving to
 * the hidden one and timing out against the layer covering it.
 */
async function openDrawer(page) {
  await page.click('[data-testid="drawer-trigger"]')
  await settle(page)
}

/** Section header → the route names under it, straight from the rendered DOM. */
async function drawerSections(page) {
  return page.$$eval(`${DRAWER} nav section`, (sections) =>
    sections.map((section) => ({
      title: section.querySelector('h2')?.textContent?.trim() ?? '',
      routes: Array.from(section.querySelectorAll('[role="button"]')).map((row) =>
        row.querySelector('.font-bold')?.textContent?.trim(),
      ),
    })),
  )
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED })
  const server = await startServer({ root: DIST })

  const context = await browser.newContext({ viewport: PHONE })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.addInitScript((payload) => {
    localStorage.setItem('route-optimiser:v2', payload)
  }, LEGACY_V2)

  // ───────────────────────────────────────────────────────── landing + drawer
  console.log('\n━━━ landing and the routes drawer ━━━\n')

  await page.goto(`${server.url}#/`, { waitUntil: 'load' })
  await page.waitForFunction(() => location.hash.startsWith('#/route/'), null, { timeout: 15_000 })

  const landedOn = await page.evaluate(() => location.hash)
  check('"/" redirects to a real route id, not the M1 placeholder', !landedOn.includes('/route/current'), landedOn)
  check('the redirect target is a uuid', /#\/route\/[0-9a-f-]{36}$/.test(landedOn))

  await openDrawer(page)
  check('the drawer opens as a dialog', (await page.locator(DRAWER).count()) === 1)

  const geometry = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"][aria-label="Your routes"]')
    const scrim = panel?.parentElement?.querySelector('button[aria-label^="Close"]')
    return {
      panel: panel?.getBoundingClientRect().width ?? 0,
      scrim: scrim?.getBoundingClientRect().width ?? 0,
      viewport: window.innerWidth,
    }
  })
  check(
    'the drawer is a side sheet, not a full screen',
    geometry.panel < geometry.viewport,
    `${Math.round(geometry.panel)}px of ${geometry.viewport}px`,
  )
  check(
    'a strip of the route screen stays exposed',
    geometry.viewport - geometry.panel > 24,
    `${Math.round(geometry.viewport - geometry.panel)}px strip`,
  )
  check('the exposed strip is the scrim, so tapping it dismisses', geometry.scrim === geometry.viewport)

  const header = await page.innerText(DRAWER)
  check('the account band is a header, not a row', !header.includes('undefined') && header.includes('This device'))
  check('help and settings are icon-only', (await page.locator(`${DRAWER} button[aria-label="Help"]`).count()) === 1)
  check('settings is present', (await page.locator(`${DRAWER} button[aria-label="Settings"]`).count()) === 1)

  // The migrated route carries three stops, one delivered — the summary line
  // is the improvement on Spoke, so it has to be real, not decorative.
  check('route rows carry a stop summary', header.includes('3 stops · 1 delivered'), header.match(/\d+ stops[^\n]*/)?.[0] ?? '')

  // ── dismissal ──
  await page.mouse.click(geometry.viewport - 8, 400)
  await settle(page)
  check('tapping the exposed strip closes the drawer', (await page.locator(DRAWER).count()) === 0)

  await openDrawer(page)
  await page.keyboard.press('Escape')
  await settle(page)
  check('Escape closes the drawer', (await page.locator(DRAWER).count()) === 0)

  // ───────────────────────────────────────────────────────────── create route
  console.log('\n━━━ create route ━━━\n')

  await openDrawer(page)
  await page.click(`${DRAWER} button:has-text("Create route")`)
  await settle(page)

  const modal = '[role="dialog"][aria-label="Create route"]'
  check('"+ Create route" opens the create modal', (await page.locator(modal).count()) === 1)
  check('the modal is dismissed with an X, not a back arrow', (await page.locator(`${modal} button[aria-label="Close"]`).count()) === 1)

  const placeholder = await page.getAttribute(`${modal} input[type="text"]`, 'placeholder')
  const expectedWeekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date())
  check('the name placeholder is the weekday', placeholder === expectedWeekday, `${placeholder} vs ${expectedWeekday}`)

  const options = await page.$$eval(`${modal} [role="radio"]`, (rows) =>
    rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
  )
  check('three date options', options.length === 3, options.join(' | '))
  check(
    'each label carries the relative word AND the absolute date',
    /^Today \w{3} \d{2} \w{3}$/.test(options[0]) && /^Tomorrow \w{3} \d{2} \w{3}$/.test(options[1]),
    options.slice(0, 2).join(' | '),
  )
  check('"Pick a date" is the third option', options[2].startsWith('Pick a date'))
  check(
    'Today is selected by default',
    (await page.getAttribute(`${modal} [role="radio"]:nth-of-type(1)`, 'aria-checked')) === 'true',
  )
  check('quick start options are present', (await page.innerText(modal)).includes('Pick past stops to carry over'))

  // Name it and date it tomorrow, so it must land in a different section.
  await page.fill(`${modal} input[type="text"]`, 'Nørrebro morning')
  await page.click(`${modal} [role="radio"]:has-text("Tomorrow")`)
  await page.click(`${modal} button:has-text("Confirm")`)
  await page.waitForTimeout(700)

  const afterCreate = await page.evaluate(() => location.hash)
  check('confirming navigates to the new route', afterCreate !== landedOn && afterCreate.startsWith('#/route/'), afterCreate)

  await openDrawer(page)
  let sections = await drawerSections(page)
  check(
    'the new route appears under the right section header',
    sections[0]?.title === 'Upcoming' && sections[0].routes.includes('Nørrebro morning'),
    sections.map((s) => `${s.title}: ${s.routes.join(', ')}`).join(' | '),
  )
  check('older routes are grouped separately', sections.length > 1 && sections[1].title === 'Earlier this week')

  // ────────────────────────────────────────────────────────── open and rename
  console.log('\n━━━ opening, renaming, duplicating ━━━\n')

  const migratedRow = `${DRAWER} [role="button"]:has-text("Imported session")`
  await page.click(migratedRow)
  await settle(page)
  const openedHash = await page.evaluate(() => location.hash)
  check('tapping a row opens that route', openedHash === landedOn, openedHash)
  check('the drawer closes when a route is opened', (await page.locator(DRAWER).count()) === 0)

  await openDrawer(page)
  const activeBg = await page.$eval(`${DRAWER} [role="button"]:has-text("Imported session")`, (el) =>
    getComputedStyle(el).backgroundColor,
  )
  check('the open route row is highlighted', activeBg !== 'rgba(0, 0, 0, 0)', activeBg)

  await page.click(`${DRAWER} [role="button"]:has-text("Imported session") button[aria-label^="More options"]`)
  await settle(page)
  const overflow = '[role="dialog"][aria-label^="Options for"]'
  const overflowText = await page.innerText(overflow)
  check(
    'the overflow offers exactly the three specified actions',
    overflowText.includes('Set name and date') &&
      overflowText.includes('Duplicate route') &&
      overflowText.includes('Delete route'),
  )
  const deleteColor = await page.$eval(`${overflow} button:has-text("Delete route")`, (el) => getComputedStyle(el).color)
  check('delete is red', deleteColor === 'rgb(198, 40, 40)', deleteColor)

  await page.click(`${overflow} button:has-text("Set name and date")`)
  await settle(page)
  const editModal = '[role="dialog"][aria-label="Set name and date"]'
  check('"Set name and date" opens the editor on that route', (await page.locator(editModal).count()) === 1)
  check(
    'the editor is pre-filled with the current name',
    (await page.inputValue(`${editModal} input[type="text"]`)) === 'Imported session',
  )
  check(
    'quick start options are hidden when editing',
    !(await page.innerText(editModal)).includes('Pick past stops to carry over'),
  )

  await page.fill(`${editModal} input[type="text"]`, 'Frederiksberg')
  await page.click(`${editModal} button:has-text("Confirm")`)
  await settle(page)

  sections = await drawerSections(page)
  check(
    'the rename is reflected in the drawer',
    sections.some((s) => s.routes.includes('Frederiksberg')),
    sections.map((s) => s.routes.join(', ')).join(' | '),
  )

  // ── duplicate ──
  await page.click(`${DRAWER} [role="button"]:has-text("Frederiksberg") button[aria-label^="More options"]`)
  await settle(page)
  await page.click(`${overflow} button:has-text("Duplicate route")`)
  await settle(page)

  const drawerText = await page.innerText(DRAWER)
  check('duplicating produces a copy', drawerText.includes('Frederiksberg (copy)'))
  const copySummary = await page.$eval(`${DRAWER} [role="button"]:has-text("Frederiksberg (copy)")`, (el) =>
    el.textContent.replace(/\s+/g, ' '),
  )
  check(
    'the copy keeps the stops and resets their statuses',
    copySummary.includes('3 stops') && !copySummary.includes('delivered'),
    copySummary.trim(),
  )

  // ────────────────────────────────────────────────────────────────── delete
  console.log('\n━━━ delete asks first ━━━\n')

  await page.click(`${DRAWER} [role="button"]:has-text("Frederiksberg (copy)") button[aria-label^="More options"]`)
  await settle(page)
  await page.click(`${overflow} button:has-text("Delete route")`)
  await settle(page)

  check('delete opens a confirmation', (await page.locator('[role="alertdialog"]').count()) === 1)
  const confirmText = await page.innerText('[role="alertdialog"]')
  check('the confirmation names what is being deleted', confirmText.includes('Frederiksberg (copy)'))
  check('the confirmation says it cannot be undone', confirmText.includes('cannot be undone'))
  const confirmColor = await page.$eval('[role="alertdialog"] button:has-text("Delete")', (el) =>
    getComputedStyle(el).backgroundColor,
  )
  check('the confirming action is red', confirmColor === 'rgb(198, 40, 40)', confirmColor)

  await page.click('[role="alertdialog"] button:has-text("Cancel")')
  await settle(page)
  check(
    'cancelling keeps the route',
    (await page.innerText(DRAWER)).includes('Frederiksberg (copy)'),
  )

  await page.click(`${DRAWER} [role="button"]:has-text("Frederiksberg (copy)") button[aria-label^="More options"]`)
  await settle(page)
  await page.click(`${overflow} button:has-text("Delete route")`)
  await settle(page)
  await page.click('[role="alertdialog"] button:has-text("Delete")')
  await settle(page)
  check('confirming deletes the route', !(await page.innerText(DRAWER)).includes('Frederiksberg (copy)'))

  // ── deleting every route must leave a usable app ──
  for (let i = 0; i < 6; i += 1) {
    const remaining = await page.locator(`${DRAWER} [role="button"][aria-checked]`).count()
    const rows = await page.locator(`${DRAWER} nav [role="button"]`).count()
    if (rows === 0 || remaining > 0) break
    await page.click(`${DRAWER} nav [role="button"] >> nth=0 >> button[aria-label^="More options"]`)
    await settle(page)
    await page.click(`${overflow} button:has-text("Delete route")`)
    await settle(page)
    await page.click('[role="alertdialog"] button:has-text("Delete")')
    await settle(page)
    if ((await page.locator(DRAWER).count()) === 0) await openDrawer(page)
  }
  const survivors = await page.locator(`${DRAWER} nav [role="button"]`).count()
  check('deleting every route leaves one behind rather than an empty app', survivors >= 1, `${survivors} route(s)`)
  check('the app is still on a real route', (await page.evaluate(() => location.hash)).startsWith('#/route/'))

  // ──────────────────────────────────────────────────────── one-handed use
  console.log('\n━━━ phone ergonomics and tokens ━━━\n')

  const targets = await page.evaluate(() => {
    const measure = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return Math.min(r.width, r.height)
    }
    return {
      createRoute: measure('[role="dialog"][aria-label="Your routes"] button:has(+ *), [role="dialog"][aria-label="Your routes"] button[type="button"]:last-of-type'),
      overflow: measure('[role="dialog"][aria-label="Your routes"] button[aria-label^="More options"]'),
      help: measure('[role="dialog"][aria-label="Your routes"] button[aria-label="Help"]'),
    }
  })
  check('the overflow control is a 44dp target', targets.overflow >= 44, `${targets.overflow}px`)
  check('the help control is a 44dp target', targets.help >= 44, `${targets.help}px`)

  await page.keyboard.press('Escape')
  await settle(page)
  const trigger = await page.$eval('[data-testid="drawer-trigger"]', (el) => {
    const r = el.getBoundingClientRect()
    return { size: Math.min(r.width, r.height), top: r.top, left: r.left }
  })
  check('the drawer trigger is a 44dp target', trigger.size >= 44, `${trigger.size}px`)

  // M3 checked the trigger cleared Leaflet's zoom control, which it had
  // originally landed on top of. M4 removed Leaflet, and MapLibre adds no
  // controls to that corner at all — so the original assertion has no subject.
  //
  // What still matters is the thing that check was really protecting: nothing
  // sits under the trigger where a thumb will land. Assert that directly —
  // with the drawer actually closed, since an open drawer covers the trigger
  // on purpose and the single Escape above only dismisses the topmost overlay.
  // Dismiss via the scrim, which this suite already proved works. Escape only
  // closes the topmost overlay and does not reliably reach the drawer from
  // this state — looping on it hangs.
  if ((await page.locator(DRAWER).count()) > 0) {
    await page.mouse.click(page.viewportSize().width - 8, 400)
    await settle(page)
  }
  check('the drawer is closed before measuring the trigger', (await page.locator(DRAWER).count()) === 0)

  const underTrigger = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="drawer-trigger"]')
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el.contains(hit) ? null : `${hit?.tagName}.${(hit?.className || '').toString().slice(0, 40)}`
  })
  check('nothing overlaps the drawer trigger', underTrigger === null, underTrigger ?? 'trigger is on top')

  const mapControls = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="drawer-trigger"]')
    const r = el.getBoundingClientRect()
    return [...document.querySelectorAll('.maplibregl-ctrl')].filter((c) => {
      const b = c.getBoundingClientRect()
      return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top
    }).length
  })
  check("no map control shares the trigger's corner", mapControls === 0, `${mapControls} overlapping`)

  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      primary: style.getPropertyValue('--color-primary').trim(),
      danger: style.getPropertyValue('--color-danger').trim(),
      success: style.getPropertyValue('--color-success').trim(),
      sheetRadius: style.getPropertyValue('--radius-sheet').trim(),
      row: style.getPropertyValue('--spacing-row').trim(),
    }
  })
  check('design tokens resolve from one place', Boolean(tokens.primary && tokens.danger && tokens.success), JSON.stringify(tokens))
  check('the 24dp sheet radius is a token', tokens.sheetRadius === '1.5rem', tokens.sheetRadius)
  check('the 72dp row height is a token', tokens.row === '4.5rem', tokens.row)

  check('no uncaught page errors during the whole flow', pageErrors.length === 0, pageErrors.join(' | '))

  await context.close()
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
  console.error('\nm3-smoke failed:', e)
  process.exit(1)
})
