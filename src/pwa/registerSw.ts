/**
 * Register the offline app shell, and notice when a new one is ready.
 *
 * Production only. In dev a service worker sits between Vite and the browser
 * and turns "why is my change not showing" into a daily question, which is a
 * poor trade for offline support on a machine that is never offline.
 *
 * ── Why the update is offered rather than applied ─────────────────────────
 *
 * The worker does not call `skipWaiting()` on its own, so a new version
 * installs and then waits. That is deliberate: taking over immediately swaps
 * the asset map under a running page, which then asks for the previous
 * version's lazy chunks and gets a 404 from the new deploy. It is the classic
 * mid-session white screen, and here it lands on a driver holding a parcel
 * halfway through a round.
 *
 * So the swap happens on a tap, and the tap reloads. Everything below exists
 * to make that tap possible and to make sure it happens exactly once.
 */

type Listener = (waiting: boolean) => void

const listeners = new Set<Listener>()
let updateWaiting = false
let registration: ServiceWorkerRegistration | null = null

/**
 * Guards the reload.
 *
 * `controllerchange` fires for reasons other than our own skipWaiting — a
 * first-install `clients.claim()` among them — and reloading on every one of
 * those is an infinite refresh loop on a driver's phone. Only a reload we
 * asked for is honoured.
 */
let applying = false

function setWaiting(value: boolean): void {
  if (updateWaiting === value) return
  updateWaiting = value
  for (const listener of listeners) listener(value)
}

/** Subscribe to "a new version is ready". Returns an unsubscribe. */
export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener)
  // Late subscribers still hear about an update that landed before they
  // mounted — the app's first paint waits on hydration, so this is normal
  // rather than an edge case.
  if (updateWaiting) listener(true)
  return () => listeners.delete(listener)
}

export function isUpdateWaiting(): boolean {
  return updateWaiting
}

/**
 * Take the update: tell the waiting worker to activate, and reload when it
 * has. The reload is what makes the new asset map and the running page agree.
 */
export function applyUpdate(): void {
  const waiting = registration?.waiting
  if (!waiting) {
    // Nothing waiting but the app thinks there is. A plain reload is still the
    // right answer — it is what the driver asked for and it cannot make
    // anything worse.
    window.location.reload()
    return
  }
  applying = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

/** How often a long-running session re-checks. A round can last all day. */
const UPDATE_CHECK_MS = 60 * 60 * 1000
let lastCheck = 0

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) window.location.reload()
  })

  // After load, not during: registration competes with the app's own boot for
  // the same connection, and the shell is only needed on the NEXT visit.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        registration = reg

        // Already waiting: the update installed during a previous session and
        // the driver closed the app before taking it.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(true)

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // `controller` is null on a FIRST install, which is not an update
            // and must not prompt — there is no previous version to disturb.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(true)
            }
          })
        })
      })
      .catch(() => {
        // Private browsing, an unsupported context, or a user who has disabled
        // storage. All survivable; none worth a message.
      })
  })

  // A driver may not reload for days. Checking when the app comes back to the
  // foreground is what makes an update reachable at all in that session —
  // throttled, because backgrounding and foregrounding a phone is constant.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastCheck < UPDATE_CHECK_MS) return
    lastCheck = Date.now()
    void registration?.update().catch(() => undefined)
  })
}

// ------------------------------------------------------- cache interrogation

export interface CacheUsage {
  heavy: { bytes: number; count: number }
  tiles: { bytes: number; count: number }
}

/**
 * Ask the worker what the two droppable caches cost.
 *
 * Via `MessageChannel` rather than a broadcast because this is a question with
 * an answer, and the reply belongs to the asker. `navigator.storage.estimate()`
 * cannot substitute: it reports one number for the whole origin and cannot say
 * how much of it is a barcode reader the driver never uses.
 */
export function cacheUsage(): Promise<CacheUsage | null> {
  return ask({ type: 'CACHE_USAGE' })
}

/** Drop one of the two caches a driver is allowed to drop. */
export function clearCache(name: 'heavy' | 'tiles'): Promise<{ ok: boolean } | null> {
  return ask({ type: 'CLEAR_CACHE', name })
}

/** A timeout, because a worker that never answers must not hang Settings. */
const REPLY_TIMEOUT_MS = 4000

function ask<T>(message: unknown): Promise<T | null> {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker?.controller
    if (!controller) {
      resolve(null)
      return
    }

    const channel = new MessageChannel()
    const timer = setTimeout(() => {
      channel.port1.close()
      resolve(null)
    }, REPLY_TIMEOUT_MS)

    channel.port1.onmessage = (event) => {
      clearTimeout(timer)
      channel.port1.close()
      resolve(event.data as T)
    }
    controller.postMessage(message, [channel.port2])
  })
}
