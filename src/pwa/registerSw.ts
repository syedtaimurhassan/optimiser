/**
 * Register the offline app shell.
 *
 * Production only. In dev a service worker sits between Vite and the browser
 * and turns "why is my change not showing" into a daily question, which is a
 * poor trade for offline support on a machine that is never offline.
 *
 * Deliberately quiet: a failed registration is not something a driver can act
 * on, and the app works without it. Where it shows up is the diagnostics
 * panel, which reports whether a controller is present.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // After load, not during: registration competes with the app's own boot for
  // the same connection, and the shell is only needed on the NEXT visit.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // Private browsing, an unsupported context, or a user who has disabled
        // storage. All survivable; none worth a message.
      })
  })
}
