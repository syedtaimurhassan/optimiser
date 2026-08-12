/**
 * M14 acceptance checks, in a real browser, against the PRODUCTION build.
 *
 *   npm run smoke:m14                 (builds dist, then checks it)
 *   node bench/m14-smoke.mjs --headed
 *
 * ── What this suite is actually for ───────────────────────────────────────
 *
 * One check here matters more than the rest: COLD OFFLINE LAUNCH. Everything
 * else in this milestone is arguable from the source; that one is not, because
 * the M13 worker looked completely correct and did not work. It precached the
 * HTML and trusted its fetch handler to pick up the rest "on the way past" —
 * which never happens, because a newly installed worker does not control the
 * page that registered it and registration happens after every asset is
 * already fetched. Reading the code did not reveal that. Closing the page,
 * going offline and opening it again did.
 *
 * So the sequence below is deliberately the real one: load once online, close
 * the page, cut the network, open a NEW page against the same storage. That is
 * airplane mode and a force-quit, which is the DoD line item.
 *
 * Launch flags are decided by `lib/launch.mjs`; nothing here needs configuring.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { startServer } from './lib/server.mjs'
import { launchChromium } from './lib/launch.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, process.argv.find((a) => a.startsWith('--dist='))?.split('=')[1] ?? 'dist')
const HEADED = process.argv.includes('--headed')

const PHONE = { width: 390, height: 844 }

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

/** Wait for the worker to be active AND finished precaching. */
const swReady = (page) =>
  page.evaluate(async () => {
    // `ready` resolves on ACTIVE, and a worker only activates once its install
    // handler's waitUntil has settled — so this also means the precache is in.
    const reg = await navigator.serviceWorker.ready
    return Boolean(reg.active)
  })

const appRendered = async (page) => {
  await page
    .waitForFunction(() => !document.body.innerText.includes('Loading your route'), null, {
      timeout: 20_000,
    })
    .catch(() => {})
  return page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)
}

async function main() {
  // ───────────────────────────────────────────── static checks, no browser
  console.log('\n━━━ the build ━━━\n')

  const swSource = readFileSync(join(DIST, 'sw.js'), 'utf8')

  check(
    'the COOP/COEP worker is not deployed',
    !existsSync(join(DIST, 'coi-serviceworker.js')),
    'a registerable SW script at a stable URL can claim our scope',
  )
  check(
    'the precache manifest was injected',
    !swSource.includes('__PRECACHE_MANIFEST__'),
    'the placeholder survived the build',
  )

  const precache = JSON.parse(swSource.match(/const PRECACHE = (\[[^\]]*\])/)?.[1] ?? '[]')
  check('the shell names the entry chunk', precache.some((f) => /^assets\/index-.*\.js$/.test(f)))
  check('the shell names the stylesheet', precache.some((f) => f.endsWith('.css')))
  check(
    'the shell names both engines and the solver worker',
    precache.some((f) => /engine-(?!simd)/.test(f)) &&
      precache.some((f) => /engine-simd-/.test(f)) &&
      precache.some((f) => /solveWorker-/.test(f)),
    'an app that opens offline and cannot solve is worse than one that does not open',
  )

  /*
    The size rule. dist/assets is ~30 MB and the shell is ~2 MB of it; the
    difference is the ONNX runtime, the OCR models and the barcode reader, all
    behind dynamic imports and all optional. Precaching them would make a
    driver who has never opened the scanner download 30 MB before the app
    would open offline.
  */
  check(
    'the shell excludes the optional payloads',
    !precache.some((f) => /ort-wasm|ort\.bundle|zxing_reader|models\/ocr/.test(f)),
    precache.filter((f) => /ort|zxing|models/.test(f)).join(' ') || 'none present',
  )

  const shellBytes = precache.reduce((sum, f) => {
    try {
      return sum + readFileSync(join(DIST, f)).length
    } catch {
      return sum
    }
  }, 0)
  check(
    'the shell is small enough to precache on a phone',
    shellBytes < 4_000_000,
    `${(shellBytes / 1e6).toFixed(2)} MB`,
  )

  check(
    'the worker never calls skipWaiting unprompted',
    /SKIP_WAITING/.test(swSource) &&
      !/self\.addEventListener\(\s*'install'[\s\S]{0,400}?skipWaiting/.test(swSource),
    'an unprompted takeover swaps the asset map under a driver mid-round',
  )

  const browser = await launchChromium({ headless: !HEADED })
  const server = await startServer({ root: DIST })

  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
    permissions: [],
  })

  try {
    // ─────────────────────────────────────────────────────── installability
    console.log('\n━━━ installability ━━━\n')
    let page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await page.goto(server.url, { waitUntil: 'load', timeout: 30_000 })
    check('the app renders online', (await appRendered(page)) > 0)
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

    const manifestHref = await page.getAttribute('link[rel=manifest]', 'href')
    const manifest = await page.evaluate(async (href) => {
      const r = await fetch(href)
      return r.ok ? await r.json() : null
    }, manifestHref)

    check('the manifest parses', manifest !== null)
    check('it is standalone', manifest?.display === 'standalone', manifest?.display)
    /*
      `id` pins app identity. Without it a browser derives identity from
      start_url, so changing start_url orphans every existing install rather
      than updating it.
    */
    check('it pins an explicit id', typeof manifest?.id === 'string', manifest?.id ?? 'absent')

    /*
      Hash routing means start_url must land on a fragment the router
      understands. "." happens to work because useHashLocation normalises an
      empty fragment; "./#/" says so without depending on that.
    */
    check('start_url names the hash route', String(manifest?.start_url).includes('#/'), manifest?.start_url)

    const purposes = (manifest?.icons ?? []).map((i) => i.purpose)
    check(
      'any and maskable are separate entries',
      purposes.includes('any') &&
        purposes.includes('maskable') &&
        !purposes.some((p) => String(p).split(/\s+/).length > 1),
      purposes.join(' | '),
      )

    const icons = await page.evaluate(async (m) => {
      const base = location.href.replace(/[^/]*$/, '') + 'manifest.webmanifest'
      const out = []
      for (const icon of m.icons) {
        const r = await fetch(new URL(icon.src, base))
        out.push({ src: icon.src, ok: r.ok, type: r.headers.get('content-type') })
      }
      return out
    }, manifest)
    check(
      'every icon resolves as a png',
      icons.every((i) => i.ok && String(i.type).includes('png')),
      icons.filter((i) => !i.ok).map((i) => i.src).join(' ') || `${icons.length} ok`,
    )

    const appleIcon = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
      if (!href) return null
      return (await fetch(href)).ok
    })
    check('the apple-touch-icon resolves', appleIcon === true)

    // ───────────────────────────────────────────────────── the service worker
    console.log('\n━━━ the shell ━━━\n')
    check('the worker activates', (await swReady(page)) === true)

    const cached = await page.evaluate(async () => {
      const names = await caches.keys()
      const out = {}
      for (const name of names) {
        out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname)
      }
      return out
    })
    const allCached = Object.values(cached).flat()

    check(
      'the shell cache holds the entry chunk after ONE visit',
      allCached.some((p) => /\/assets\/index-.*\.js$/.test(p)),
      `${allCached.length} entries across ${Object.keys(cached).length} cache(s)`,
    )
    check(
      'and the document it is named by',
      allCached.some((p) => p.endsWith('index.html')),
    )
    /*
      The regression that would silently cost 27 MB: a blanket /assets/ rule
      pulling the ONNX runtime in behind a feature that is off by default.
    */
    check(
      'nothing optional was cached',
      !allCached.some((p) => /ort-wasm|zxing_reader|models\/ocr/.test(p)),
      allCached.filter((p) => /ort|zxing|models/.test(p)).join(' ') || 'none',
    )

    // ─────────────────────────────────────────────── cold offline launch
    console.log('\n━━━ cold offline launch (the DoD line) ━━━\n')

    // Force-quit, then airplane mode. Order matters: closing first means the
    // new page is a genuine cold start rather than a reload of a warm one.
    await page.close()
    await context.setOffline(true)

    page = await context.newPage()
    const offlineErrors = []
    page.on('pageerror', (e) => offlineErrors.push(e.message))

    let navigated = true
    await page
      .goto(server.url, { waitUntil: 'load', timeout: 30_000 })
      .catch(() => {
        navigated = false
      })

    check('the document loads with no network', navigated)
    const offlineChildren = await appRendered(page)
    check(
      'the app renders offline from a cold start',
      offlineChildren > 0,
      `${offlineChildren} root children`,
    )
    check(
      'and does so without throwing',
      offlineErrors.length === 0,
      offlineErrors.slice(0, 2).join(' | '),
    )

    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200))
    check(
      'it is the app, not a browser error page',
      !/ERR_INTERNET_DISCONNECTED|No internet|can.t be reached/i.test(bodyText),
      bodyText.replace(/\s+/g, ' ').slice(0, 80),
    )

    /*
      The regression this suite already caught once. The first witness was "a
      shell cache exists", which is true from the FIRST visit — before any data
      has ever been saved — so a normal second launch told every driver with an
      empty round that their data had been cleared. Nothing has been lost here:
      the banner must be absent.
    */
    check(
      'no false alarm about lost data',
      (await page.locator('[data-testid="data-loss-banner"]').count()) === 0,
      'an empty app on its second launch has not been evicted',
    )

    /*
      Hash routing's dividend: the fragment never reaches the server, so every
      deep link is a request for the same cached document. If this works, every
      route in the app works offline.
    */
    await page.goto(`${server.url}#/settings`, { waitUntil: 'load', timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(500)
    const settingsOffline = await page.locator('[data-testid="settings-storage"]').count()
    check('a deep link resolves offline too', settingsOffline > 0, '#/settings')

    // ────────────────────────────────────────────────────────── storage UI
    console.log('\n━━━ storage ━━━\n')
    await context.setOffline(false)
    await page.goto(`${server.url}#/settings`, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForTimeout(800)

    check(
      'settings reports storage',
      (await page.locator('[data-testid="settings-storage"]').count()) > 0,
    )
    const verdict = await page.locator('[data-testid="storage-verdict"]').innerText().catch(() => '')
    check('and says what it means in words', verdict.trim().length > 10, verdict.slice(0, 70))
    const figures = await page.locator('[data-testid="storage-figures"]').innerText().catch(() => '')
    check('and shows usage against quota', /of/.test(figures) || /checking/.test(figures), figures)

    check(
      'the install card is reachable from settings',
      (await page.locator('[data-testid="install-card"]').count()) > 0,
    )
  } finally {
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
    await server.close()

    const passed = results.filter((r) => r.pass).length
    console.log(`\n${passed}/${results.length} checks passed`)
    if (passed !== results.length) {
      console.log('\nfailed:')
      for (const r of results.filter((x) => !x.pass)) console.log(`  ✗ ${r.name}  ${r.detail}`)
      process.exitCode = 1
    }
  }
}

await main()
