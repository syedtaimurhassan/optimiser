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
  ;(() => {
    const reloadedBySelf = window.sessionStorage.getItem('coiReloadedBySelf')
    window.sessionStorage.removeItem('coiReloadedBySelf')
    const coi = {
      shouldRegister: () => !reloadedBySelf,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      coepDegrade: () => true,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    }

    const n = navigator
    if (n.serviceWorker && n.serviceWorker.controller) {
      n.serviceWorker.controller.postMessage({
        type: 'coepCredentialless',
        value: coi.coepCredentialless(),
      })
      if (coi.shouldDeregister()) {
        n.serviceWorker.controller.postMessage({ type: 'deregister' })
      }
    }

    // If already isolated (e.g. real headers present) or told not to, do nothing.
    if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return
    if (!window.isSecureContext) {
      !coi.quiet &&
        console.log(
          'COOP/COEP Service Worker not registered: a secure context (HTTPS or localhost) is required.',
        )
      return
    }

    if (n.serviceWorker) {
      n.serviceWorker
        .register(window.document.currentScript.src)
        .then((registration) => {
          !coi.quiet &&
            console.log('COOP/COEP Service Worker registered', registration.scope)
          registration.addEventListener('updatefound', () => {
            window.sessionStorage.setItem('coiReloadedBySelf', 'updatefound')
            coi.doReload()
          })
          if (registration.active && !n.serviceWorker.controller) {
            window.sessionStorage.setItem('coiReloadedBySelf', 'notyetcontrolled')
            coi.doReload()
          }
        })
        .catch(
          (err) =>
            !coi.quiet &&
            console.error('COOP/COEP Service Worker failed to register:', err),
        )
    }
  })()
}
