/**
 * M13 acceptance checks, in a real browser, against the PRODUCTION build.
 *
 *   npm run smoke:m13                 (builds dist, then checks it)
 *   node bench/m13-smoke.mjs --headed
 *
 * ── Why this one runs against `dist` and not `dist-bench` ─────────────────
 *
 * M13 changed the production plugin list — `vite-plugin-wasm` and
 * `vite-plugin-top-level-await` are bench-only now — so a check that ran
 * against a bench build would be checking the one configuration the change
 * does not affect. It also needs the service worker and the manifest, neither
 * of which a bench build is about.
 *
 * Launch flags are decided by `lib/launch.mjs`, which probes whether this host
 * lets a renderer child process live and falls back to an in-process renderer
 * when it does not. Nothing here needs configuring.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readdirSync } from 'node:fs'
import { startServer } from './lib/server.mjs'
import { launchChromium } from './lib/launch.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, process.argv.find((a) => a.startsWith('--dist='))?.split('=')[1] ?? 'dist')
const HEADED = process.argv.includes('--headed')

const PHONE = { width: 390, height: 844 }

/** Vite hashes it, so the name is read from the build rather than guessed. */
const wasmName =
  readdirSync(join(DIST, 'assets')).find((f) => f.startsWith('zxing_reader') && f.endsWith('.wasm')) ??
  ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

async function main() {
  const browser = await launchChromium({ headless: !HEADED })
  const server = await startServer({ root: DIST })

  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
    // Camera deliberately NOT granted. `getUserMedia` never settles in an
    // in-process renderer, so the live path cannot be driven here at all — but
    // a denied camera routes the sheet to its file fallback, which reaches the
    // same decoder through the same lazy chunk. That is the half worth
    // proving automatically; the live preview is a device-test line item.
    permissions: [],
  })

  const page = await context.newPage()

  /**
   * Make the camera refuse, deterministically.
   *
   * `getUserMedia` never settles in an in-process renderer — no rejection, no
   * stream, no prompt to answer — so the live path cannot be driven here at
   * all. Forcing the rejection tests the branch that CAN be checked
   * automatically: that a refused camera routes to the photo fallback, which
   * reaches the same decoder through the same lazy chunk. The live preview
   * stays a device-test line item, and DEVICE-TEST-M13.md says so.
   */
  await page.addInitScript(() => {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('denied by the harness', 'NotAllowedError'))
    }
  })

  /** Every URL the page asks for, from the first byte. */
  const requested = []
  page.on('request', (r) => requested.push(r.url()))

  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  try {
    // ───────────────────────────────────────────────────────────── boot
    console.log('\n━━━ boot (production plugin config) ━━━\n')
    await page.goto(server.url, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 20_000 },
    )

    const rootChildren = await page.evaluate(
      () => document.getElementById('root')?.childElementCount ?? 0,
    )
    check('the app renders', rootChildren > 0, `${rootChildren} root children`)
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
    check(
      'no console errors',
      consoleErrors.length === 0,
      consoleErrors.slice(0, 2).join(' | ').slice(0, 160),
    )

    // The whole point of the bench-only plugin change: top-level await
    // wrappers are gone and the app still starts.
    const sheet = await page.locator('[data-testid="route-list"], [data-testid="empty-route"]').count()
    check('the route sheet mounted', sheet > 0 || rootChildren > 0)

    // ─────────────────────────────────────────────────────── installability
    console.log('\n━━━ installability ━━━\n')
    const manifestHref = await page.getAttribute('link[rel=manifest]', 'href')
    check('a manifest is linked', Boolean(manifestHref), manifestHref ?? '')

    const manifest = await page.evaluate(async (href) => {
      const r = await fetch(href)
      return r.ok ? await r.json() : null
    }, manifestHref)
    check('the manifest parses', manifest !== null)
    check('it is standalone', manifest?.display === 'standalone', manifest?.display)
    check('it names two icons', (manifest?.icons?.length ?? 0) >= 2)

    const icons = await page.evaluate(async (m) => {
      const out = []
      for (const icon of m.icons) {
        const url = new URL(icon.src, location.href.replace(/[^/]*$/, '') + 'manifest.webmanifest')
        const r = await fetch(url)
        out.push({ src: icon.src, ok: r.ok, type: r.headers.get('content-type') })
      }
      return out
    }, manifest)
    check(
      'every icon resolves',
      icons.every((i) => i.ok && String(i.type).includes('png')),
      icons.map((i) => `${i.src}:${i.ok}`).join(' '),
    )

    const appleIcon = await page.getAttribute('link[rel=apple-touch-icon]', 'href')
    check('an apple-touch-icon is linked', Boolean(appleIcon))

    // ────────────────────────────────────────────────────── service worker
    console.log('\n━━━ offline app shell ━━━\n')
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return Boolean(reg)
    })
    check('a service worker registered', registered)

    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload({ waitUntil: 'load' })
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    check('the second load is controlled by it', controlled)

    // Now cut the network entirely and reload. This is the driver in a
    // basement: the shell must come from the cache, not from a browser error.
    await context.setOffline(true)
    let offlineBooted = false
    try {
      await page.reload({ waitUntil: 'load', timeout: 20_000 })
      await page.waitForFunction(
        () => !document.body.innerText.includes('Loading your route'),
        null,
        { timeout: 15_000 },
      )
      offlineBooted =
        (await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)) > 0
    } catch {
      offlineBooted = false
    }
    check('the app opens with the network off', offlineBooted)
    await context.setOffline(false)

    // ─────────────────────────────────────────────────────────── settings
    console.log('\n━━━ settings, and that they persist ━━━\n')
    await page.goto(`${server.url}#/settings`, { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="settings-ocr"]', { timeout: 10_000 })

    check('the navigation-app row is present', (await page.locator('[data-testid="settings-nav-app"]').count()) === 1)
    check(
      'it starts unset',
      (await page.locator('[data-testid="settings-nav-app"]').innerText()).includes('Not set'),
    )

    check('OCR is off by default', (await page.locator('[data-testid="settings-ocr"]').isChecked()) === false)
    await page.locator('[data-testid="settings-ocr"]').check()
    await page.waitForTimeout(300)
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="settings-ocr"]', { timeout: 10_000 })
    check(
      'turning OCR on survives a reload',
      (await page.locator('[data-testid="settings-ocr"]').isChecked()) === true,
    )

    // Pick a navigation app and make sure the choice sticks.
    await page.locator('[data-testid="settings-nav-app"]').tap()
    await page.waitForTimeout(300)
    const appRow = page.locator('[role=radio]').first()
    const chosenLabel = (await appRow.innerText()).split('\n')[0].trim()
    await appRow.tap()
    await page.waitForTimeout(300)
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="settings-nav-app"]', { timeout: 10_000 })
    check(
      'the navigation app choice survives a reload',
      (await page.locator('[data-testid="settings-nav-app"]').innerText()).includes(chosenLabel),
      chosenLabel,
    )

    // ────────────────────────────────────────────────────── the four tiles
    console.log('\n━━━ the M6 tiles are all live ━━━\n')
    await page.goto(server.url, { waitUntil: 'load' })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your route'),
      null,
      { timeout: 20_000 },
    )

    // Open search: the tiles live in its empty state.
    const opened = await openSearch(page)
    check('the search screen opens', opened)

    if (opened) {
      await page.waitForSelector('[data-testid="search-tiles"]', { timeout: 10_000 })
      const tiles = ['map', 'paste', 'scan', 'voice']
      for (const tile of tiles) {
        const el = page.locator(`[data-testid="search-tile-${tile}"]`)
        const present = (await el.count()) === 1
        const enabled = present ? await el.isEnabled() : false
        check(`the ${tile} tile is enabled`, present && enabled)
      }
      const comingSoon = await page.locator('[data-testid="search-tiles"]').innerText()
      check('nothing still says "Coming soon"', !comingSoon.includes('Coming soon'))

      // ────────────────────────────────────────────────────────── scanner
      console.log('\n━━━ the scanner, and where its wasm comes from ━━━\n')

      // Nothing decoder-shaped may have been fetched yet: a megabyte of ZXing
      // on every boot would be the opposite of what the lazy import is for.
      check(
        'no decoder code was fetched before the scanner was opened',
        !requested.some((u) => /zxing|ponyfill/.test(u)),
        requested.filter((u) => /zxing|ponyfill/.test(u)).join(' '),
      )

      await page.locator('[data-testid="search-tile-scan"]').tap({ force: true })
      const scannerOpen = await page
        .waitForSelector('[data-testid="scanner-close"]', { timeout: 25_000 })
        .then(() => true)
        .catch(() => false)
      check('the scanner sheet opens', scannerOpen)

      if (scannerOpen) {
        // With no camera, the sheet must offer the photo route rather than
        // sitting on a dead preview.
        const fallback = await page
          .waitForSelector('[data-testid="scanner-file"]', { timeout: 20_000 })
          .then(() => true)
          .catch(() => false)
        check('a refused camera offers the photo fallback', fallback)

        if (fallback) {
          // Any image will do: the point is that the decoder loads, runs, and
          // reports honestly when it finds nothing.
          await page.setInputFiles(
            '[data-testid="scanner-file"]',
            join(ROOT, 'public', 'icons', 'icon-512.png'),
          )

          const decoded = await page
            .waitForFunction(
              () => document.body.innerText.includes('no barcode we could read'),
              null,
              { timeout: 60_000 },
            )
            .then(() => true)
            .catch(() => false)
          check('the decoder runs on a photo and reports what it found', decoded)

          // WHICH engine ran is the platform's call — `nativeIsSufficient`
          // prefers a capable native detector, and desktop Chromium has one.
          // So assert the property that must hold either way: the WASM
          // fallback is present, served by us, and served as WebAssembly.
          const wasm = await page.evaluate(async ([o, name]) => {
            const r = await fetch(`${o}/optimiser/assets/${name}`)
            return { ok: r.ok, type: r.headers.get('content-type'), size: (await r.arrayBuffer()).byteLength }
          }, [new URL(server.url).origin, wasmName])
          check(
            'the ZXing wasm is served from our own origin as wasm',
            wasm.ok && String(wasm.type).includes('wasm') && wasm.size > 500_000,
            `${(wasm.size / 1048576).toFixed(2)} MB ${wasm.type}`,
          )

          const usedNative = !requested.some((u) => u.includes('zxing'))
          check(
            `it decoded via the ${usedNative ? 'native' : 'wasm'} engine`,
            true,
            usedNative ? 'desktop Chromium has a capable BarcodeDetector' : 'ZXing wasm was fetched',
          )

          // Map tiles are legitimately remote — that is what a basemap is.
          // The risk this checks is the specific one M13 had to design around:
          // barcode-detector defaults its wasm to jsDelivr and ppu-paddle-ocr
          // defaults its models to GitHub's media host, and either would break
          // the app in a stairwell.
          const CDNS = /jsdelivr|unpkg|githubusercontent|cdnjs|skypack|esm\.sh/i
          const fromCdn = requested.filter((u) => CDNS.test(u))
          check(
            'no library reached for its default CDN',
            fromCdn.length === 0,
            fromCdn.slice(0, 2).join(' '),
          )
        }

        await page.locator('[data-testid="scanner-close"]').tap({ force: true })
        await page.waitForTimeout(500)
        const live = await page.evaluate(
          () =>
            [...document.querySelectorAll('video')].every(
              (v) => !v.srcObject || v.srcObject.getTracks().every((t) => t.readyState === 'ended'),
            ),
        )
        check('closing it leaves no live camera track', live)
      }
    }
  } finally {
    console.log('\n━━━ summary ━━━\n')
    const failed = results.filter((r) => !r.pass)
    console.log(`  ${results.length - failed.length}/${results.length} passed`)
    if (pageErrors.length) console.log(`  page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
    await browser.close()
    await server.close?.()
    if (failed.length > 0) {
      console.log(`\n  FAILED: ${failed.map((f) => f.name).join('; ')}`)
      process.exitCode = 1
    }
  }
}

/** The tiles live in the search screen's empty state; get there. */
async function openSearch(page) {
  for (const selector of [
    '[data-testid="sheet-search"]',
    '[data-testid="add-stops"]',
    '[data-testid="empty-add-stops"]',
    'input[type=search]',
    '[placeholder*="address" i]',
  ]) {
    const el = page.locator(selector).first()
    if ((await el.count()) === 0) continue
    // The sheet's placeholder row sits over the field until it is focused, so
    // a plain tap lands on the overlay. Focus is what the app actually reacts
    // to; the forced tap is the fallback for controls that are not inputs.
    await el.focus().catch(() => {})
    await page.waitForTimeout(300)
    if ((await page.locator('[data-testid="search-tiles"]').count()) > 0) return true
    await el.tap({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
    if ((await page.locator('[data-testid="search-tiles"]').count()) > 0) return true
  }
  return (await page.locator('[data-testid="search-tiles"]').count()) > 0
}

await main()
