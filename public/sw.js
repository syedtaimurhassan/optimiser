/**
 * The offline app shell.
 *
 * A driver in a basement car park, a tunnel, or a rural dead zone must still be
 * able to open the app and work the round they already have — M12 made the
 * SOLVE work without a network, and this is what makes getting to it work too.
 *
 * ── Two strategies, chosen by what can go stale ───────────────────────────
 *
 * Everything under /assets/ is content-hashed by Vite: the name changes when
 * the bytes change, so a cached copy can never be wrong. Cache-first, forever.
 *
 * The HTML cannot be hashed — it is the thing that names the hashes — so it is
 * network-first with a cached fallback. Online, a deploy is picked up on the
 * next load. Offline, the last known-good shell opens. Cache-first here would
 * mean a driver running last week's HTML pointing at assets that were deleted
 * from the server, which is a white screen with no way out.
 *
 * Anything cross-origin — OSRM, the geocoders, map tiles — is not touched at
 * all. Those are other people's rate limits and freshness rules, and a routing
 * response cached behind the app's back is a wrong answer waiting to be given.
 *
 * ── Why it does not skipWaiting ───────────────────────────────────────────
 *
 * A new worker taking over immediately swaps the asset map under a running
 * app: the page is executing last version's JavaScript and will ask for last
 * version's lazy chunks, which the new deploy no longer has. That is the
 * classic mid-session white screen, and it would land on a driver holding a
 * parcel. The update installs quietly and takes effect the next time the app
 * is opened fresh.
 */

/** Bump on any change to this file's caching rules. */
const CACHE = 'optimiser-shell-v1'

/** The one URL worth having before it is asked for. */
const SHELL = new URL('./index.html', self.registration.scope).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(SHELL, { cache: 'reload' })))
      // A failed precache must not fail the install: the app still works
      // online, and the fetch handler fills the cache as pages are visited.
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations: network first, last-good shell when there is no network.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
          return response
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    )
    return
  }

  // Hashed assets: cache first, and fill on the way past.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            // Opaque and error responses are not worth keeping; a cached 404
            // is indistinguishable from a cached asset on the next request.
            if (response.ok) {
              const copy = response.clone()
              void caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
