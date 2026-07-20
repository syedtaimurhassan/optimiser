/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT
 *  Adapted: forces COEP "credentialless" so cross-origin resources (OpenStreetMap
 *  tiles, OSRM API) keep working while the page becomes crossOriginIsolated,
 *  which OR-Tools' threaded WebAssembly (SharedArrayBuffer) requires.
 *
 *  GitHub Pages can't send COOP/COEP response headers, so this service worker
 *  re-adds them to every response on the client. It reloads the page once on
 *  first visit to take control.
 */
let coepCredentialless = true

if (typeof window === 'undefined') {
  // ---- Service worker context ----
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', (event) =>
    event.waitUntil(self.clients.claim()),
  )

  self.addEventListener('message', (ev) => {
    if (!ev.data) return
    if (ev.data.type === 'deregister') {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => clients.forEach((client) => client.navigate(client.url)))
    } else if (ev.data.type === 'coepCredentialless') {
      coepCredentialless = ev.data.value
    }
  })

  self.addEventListener('fetch', (event) => {
    const r = event.request
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return

    const request =
      coepCredentialless && r.mode === 'no-cors'
        ? new Request(r, { credentials: 'omit' })
        : r

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) return response
          const newHeaders = new Headers(response.headers)
          newHeaders.set(
            'Cross-Origin-Embedder-Policy',
            coepCredentialless ? 'credentialless' : 'require-corp',
          )
          if (!coepCredentialless) {
            newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin')
          }
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin')
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          })
        })
        .catch((e) => console.error(e)),
    )
  })
} else {
  // ---- Page context: register self as a service worker ----
  // `document.currentScript` is only valid during synchronous execution, so
  // capture the URL now (not inside a later callback).
  const swUrl = window.document.currentScript.src
  ;(() => {
    const n = navigator

    // Already isolated (SW controlling, or real headers present): clean up and stop.
    if (window.crossOriginIsolated) {
      window.sessionStorage.removeItem('coiReloadedBySelf')
      return
    }
    if (!window.isSecureContext || !n.serviceWorker) {
      console.log(
        'COOP/COEP Service Worker not active: a secure context with service' +
          ' worker support is required.',
      )
      return
    }

    n.serviceWorker.register(swUrl).then(
      () => console.log('COOP/COEP Service Worker registered'),
      (err) => console.error('COOP/COEP Service Worker failed to register:', err),
    )

    // Deterministic first-visit handling: once the SW is active (`ready`), the
    // page still isn't controlled yet, so reload exactly once to load under the
    // SW and gain cross-origin isolation. The sessionStorage guard prevents a
    // reload loop if isolation still doesn't stick.
    n.serviceWorker.ready.then(() => {
      if (
        !window.crossOriginIsolated &&
        !window.sessionStorage.getItem('coiReloadedBySelf')
      ) {
        window.sessionStorage.setItem('coiReloadedBySelf', '1')
        window.location.reload()
      }
    })
  })()
}
