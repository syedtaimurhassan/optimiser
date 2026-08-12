/**
 * The offline app shell.
 *
 * A driver in a basement car park, a tunnel, or a rural dead zone must still be
 * able to open the app and work the round they already have — M12 made the
 * SOLVE work without a network, and this is what makes getting to it work too.
 *
 * ── The one service worker ────────────────────────────────────────────────
 *
 * There is deliberately no COOP/COEP worker beside this one. M14 considered
 * merging `coi-serviceworker` into this file and rejected it on the data: no
 * tier-A engine has ever been built (registry.ts claims tier A when isolated,
 * but nothing is REGISTERED there, so selection always resolves down to B and
 * flags itself degraded), and M11 measured the shipped default with isolation
 * explicitly off — `wasm-workers`, 15/15 feasible, 0.27% mean gap, identical
 * to the isolated run. Cross-origin isolation currently buys nothing except a
 * badge claiming a tier the app cannot run, and it costs Safari, Firefox and a
 * forced reload on first load. If M15 ever ships a real tier-A engine, this is
 * the decision to revisit, and it should be revisited with a benchmark.
 *
 * ── Four caches, because they have four different lifetimes ───────────────
 *
 * SHELL and ASSETS are versioned and dropped wholesale on a new build. TILES
 * and HEAVY are NOT versioned: their contents are content-addressed or belong
 * to a third party, and wiping them on every deploy would re-download tens of
 * megabytes to no purpose. They are bounded by eviction instead.
 *
 *   SHELL   the precached app shell. Built by plugins/precache.ts, which
 *           derives it from the entry chunks and the closure of their STATIC
 *           imports — so anything behind `import()` is excluded by
 *           construction, not by a denylist somebody has to remember.
 *   ASSETS  hashed assets fetched on the way past that were not in the shell.
 *   HEAVY   the optional monsters: the ONNX runtime (26.8 MB), the OCR models
 *           (12 MB) and the barcode reader (1.1 MB). Cached only if the driver
 *           actually uses the feature, kept in their own cache so Settings can
 *           show what they cost and drop them in one tap.
 *   TILES   basemap tiles, glyphs and sprites. See the note above the host
 *           list before touching the policy.
 *
 * ── Why it does not skipWaiting on its own ────────────────────────────────
 *
 * A new worker taking over immediately swaps the asset map under a running
 * app: the page is executing last version's JavaScript and will ask for last
 * version's lazy chunks, which the new deploy no longer has. That is the
 * classic mid-session white screen, and it would land on a driver holding a
 * parcel. The update installs quietly, the app offers a reload, and the swap
 * happens when the driver says so — see the SKIP_WAITING message below.
 */

/** Bump on any change to this file's caching RULES. Not on every deploy. */
const VERSION = 'v2'

const SHELL = `optimiser-shell-${VERSION}`
const ASSETS = `optimiser-assets-${VERSION}`
/** Unversioned on purpose — see the header. */
const HEAVY = 'optimiser-heavy'
const TILES = 'optimiser-tiles'

/**
 * Not ours, and must survive us.
 *
 * lib/pwa/eviction.ts keeps its "there was data here" witness in a cache,
 * because a witness stored in IndexedDB is destroyed by the very event it
 * exists to report. This worker must therefore never sweep it up — deleting it
 * on activate would disarm the eviction check on every single deploy, silently.
 */
const WITNESS = 'optimiser-witness'

/** Caches this worker owns. Anything else under our origin is another era's. */
const OURS = new Set([SHELL, ASSETS, HEAVY, TILES, WITNESS])

/**
 * The shell, injected at build time by plugins/precache.ts.
 *
 * Paths are relative to the worker's scope so this file stays independent of
 * Vite's `base`, which differs between a local preview and GitHub Pages.
 */
const PRECACHE = __PRECACHE_MANIFEST__

const scoped = (path) => new URL(path, self.registration.scope).toString()

/** The document every navigation falls back to. */
const SHELL_DOC = scoped('index.html')

/**
 * The heavy optional payloads, by name.
 *
 * Matched on the path because Vite hashes them and because the OCR models are
 * served from `public/` rather than the bundle. Over-matching is harmless —
 * the worst case is a file being cached in the bucket a driver can clear
 * rather than the one they cannot.
 */
const IS_HEAVY = /\/(ort-wasm|ort\.bundle|zxing_reader|models\/ocr)/

/**
 * Basemap hosts, and the only cross-origin traffic this worker touches.
 *
 * ── Why these are cached and the rest are not ─────────────────────────────
 *
 * OpenFreeMap's public instance has no request cap, no key and permits
 * commercial use; Stadia is the keyless fallback. What every free tile service
 * does ask is that clients neither bulk-download nor prefetch, so this caches
 * ONLY what the map actually asked for while panning, and never warms anything
 * in advance.
 *
 * It is deliberately cache-first with NO background revalidation. The
 * stale-while-revalidate shape would send a second request for every tile the
 * driver has already seen, which on a donation-funded server is the opposite
 * of respectful. Basemaps change on the order of weeks; the LRU below is what
 * keeps them from going permanently stale.
 *
 * Everything else cross-origin — OSRM, Valhalla, the geocoders — is passed
 * straight through and never stored. Those are other people's rate limits and
 * freshness rules, and a routing response cached behind the app's back is a
 * wrong answer waiting to be given. Geocoding is already cached properly one
 * layer up, in lib/geocoding/cache.ts, which keys on a normalised query rather
 * than a raw URL and so actually protects the shared quota.
 */
const TILE_HOSTS = new Set(['tiles.openfreemap.org', 'tiles.stadiamaps.com'])

/** Roughly 30–60 MB of vector tiles. Bounded so a long day cannot fill a phone. */
const TILE_MAX_ENTRIES = 800
/** A handful of files; enough headroom for one deploy's worth of stale hashes. */
const HEAVY_MAX_ENTRIES = 12

// ---------------------------------------------------------------- install

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      // Individually rather than `addAll`, which is all-or-nothing: one 404
      // from a half-finished deploy would leave the app with no shell at all.
      // A partial shell still opens; a missing one is a white screen.
      const results = await Promise.allSettled(
        PRECACHE.map((path) => cache.add(new Request(scoped(path), { cache: 'reload' }))),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) console.warn(`[sw] precache: ${failed}/${PRECACHE.length} failed`)
    })(),
  )
})

// --------------------------------------------------------------- activate

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()

      // A FIRST install has no previous cache of ours to be stale against, so
      // there is no asset map to swap and claiming the open page is safe. It
      // is also the only way anything this session loads lazily gets cached —
      // an uncontrolled page's fetches never reach this worker at all.
      //
      // On an UPDATE the opposite holds, and claiming is exactly the
      // mid-session white screen the header warns about. So: only when we are
      // new here.
      // Specifically a SHELL cache, not any cache of ours: the witness above
      // can outlive a storage clear that took the shell with it, and treating
      // that as "not a first install" would skip the claim that makes this
      // session's lazy chunks cacheable.
      const firstInstall = !names.some((n) => n.startsWith('optimiser-shell'))

      await Promise.all(names.filter((n) => n.startsWith('optimiser-') && !OURS.has(n)).map((n) => caches.delete(n)))

      if (firstInstall) await self.clients.claim()
    })(),
  )
})

// ---------------------------------------------------------------- messages

self.addEventListener('message', (event) => {
  // The driver tapped "Reload to update". Only then.
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()

  // Settings asked what the optional downloads cost, or asked to drop them.
  if (event.data?.type === 'CACHE_USAGE') {
    event.waitUntil(
      (async () => {
        event.ports[0]?.postMessage(await cacheUsage())
      })(),
    )
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      (async () => {
        await caches.delete(event.data.name === 'tiles' ? TILES : HEAVY)
        event.ports[0]?.postMessage({ ok: true })
      })(),
    )
  }
})

/**
 * Bytes held by the two caches a driver is allowed to drop.
 *
 * Read by summing the bodies rather than asked for, because
 * `navigator.storage.estimate()` reports one number for the whole origin and
 * cannot say how much of it is a barcode reader the driver never uses.
 */
async function cacheUsage() {
  const out = {}
  for (const [label, name] of [['heavy', HEAVY], ['tiles', TILES]]) {
    let bytes = 0
    let count = 0
    try {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        if (!response) continue
        count++
        // `Content-Length` is absent on some responses; falling back to the
        // body costs a read but is the only honest answer.
        const declared = Number(response.headers.get('content-length'))
        bytes += Number.isFinite(declared) && declared > 0
          ? declared
          : (await response.clone().arrayBuffer()).byteLength
      }
    } catch {
      // A cache that will not open reports zero rather than breaking Settings.
    }
    out[label] = { bytes, count }
  }
  return out
}

// ------------------------------------------------------------------- fetch

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    if (TILE_HOSTS.has(url.hostname)) event.respondWith(cacheFirst(request, TILES, TILE_MAX_ENTRIES))
    return
  }

  // Navigations: network first, last-good shell when there is no network.
  //
  // M1's hash routing is what makes this a single line rather than a routing
  // table. A fragment is never sent to the server, so EVERY deep link —
  // #/route/abc/stop/xyz included — arrives here as a request for the same
  // document, and one cached file answers all of them.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep the fallback current, but only from a real answer. Caching a
          // 404 here would replace a working shell with GitHub's error page.
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(SHELL).then((c) => c.put(SHELL_DOC, copy)))
          }
          return response
        })
        .catch(async () => (await caches.match(SHELL_DOC)) ?? Response.error()),
    )
    return
  }

  if (IS_HEAVY.test(url.pathname)) {
    event.respondWith(cacheFirst(request, HEAVY, HEAVY_MAX_ENTRIES))
    return
  }

  // Hashed assets, and the small same-origin files the shell precached. A
  // content-hashed name cannot go stale, so cache-first is always right here.
  if (url.pathname.includes('/assets/') || PRECACHE.some((p) => scoped(p) === url.href)) {
    event.respondWith(cacheFirst(request, ASSETS))
  }
})

/**
 * Serve from any cache, fall back to the network, and keep what comes back.
 *
 * `caches.match` searches every cache, so a precached shell file is found
 * without this needing to know which bucket it landed in; new bodies are
 * written to `cacheName`, which is what keeps the buckets meaningful.
 */
async function cacheFirst(request, cacheName, maxEntries) {
  const hit = await caches.match(request)
  if (hit) return hit

  const response = await fetch(request)
  // Opaque and error responses are not worth keeping: a cached 404 is
  // indistinguishable from a cached asset on the next request, and an opaque
  // body cannot be inspected or measured.
  if (response.ok && response.type !== 'opaque') {
    const copy = response.clone()
    const cache = await caches.open(cacheName)
    await cache.put(request, copy)
    if (maxEntries) await trim(cache, cacheName, maxEntries)
  }
  return response
}

/**
 * Keep a cache bounded, oldest first.
 *
 * Cache Storage returns keys in insertion order, so this is a true FIFO rather
 * than an LRU — a tile re-requested after a pan keeps its original position
 * and can be evicted while still on screen, at the cost of one refetch. A real
 * LRU needs a side index of access times, which is a schema and a write on
 * every read to save a request the driver will not notice.
 *
 * ── Why the check is throttled, and why not for every cache ───────────────
 *
 * `keys()` walks the whole cache. Panning a vector map puts dozens of tiles a
 * second, so checking 800 keys on each one would cost more than the eviction
 * saves — hence the write counter.
 *
 * But that throttle is wrong for a cache that is written to rarely. HEAVY
 * takes about six writes in its entire life, so a 50-write interval would mean
 * it NEVER trimmed and grew by a full set of stale hashes on every deploy.
 * Small caches are therefore checked on every write, where the walk is trivial
 * anyway.
 */
const THROTTLE_ABOVE = 100
const TRIM_INTERVAL = 50
const writesSince = new Map()

async function trim(cache, cacheName, maxEntries) {
  if (maxEntries > THROTTLE_ABOVE) {
    const n = (writesSince.get(cacheName) ?? 0) + 1
    if (n < TRIM_INTERVAL) {
      writesSince.set(cacheName, n)
      return
    }
    writesSince.set(cacheName, 0)
  }

  const keys = await cache.keys()
  const excess = keys.length - maxEntries
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)))
}
