/**
 * Whether the network is actually reachable.
 *
 * ── Why `navigator.onLine` is not enough ──────────────────────────────────
 *
 * It answers "is there a network interface up", not "can I reach anything".
 * A phone attached to a hotel captive portal, a van in a tunnel with one bar
 * of a cell that never completes a handshake, and a laptop on a wifi network
 * with no upstream all report `true`. A driver told they are online while
 * every request times out is worse off than one told nothing.
 *
 * So it is one input of two. `navigator.onLine` going FALSE is trusted
 * immediately — the OS knows there is no interface, and there is no point
 * trying. Going true only means "worth a try". What settles it is the outcome
 * of real requests, reported by the routing service as they succeed and fail.
 *
 * ── One failure is not an outage ──────────────────────────────────────────
 *
 * The demo servers this app runs on are shared and occasionally answer a 500
 * on a perfectly good connection. Declaring a driver offline because one
 * request failed would make the indicator flicker, and an indicator that
 * flickers is one nobody reads. It takes `FAILURES_BEFORE_OFFLINE` in a row;
 * a single success clears the count.
 *
 * Pure module: no React, no store. Reads two browser globals, both guarded so
 * it runs under `node --test`.
 */

/**
 * A hint about the connection, for LABELLING ONLY.
 *
 * Deliberately not an input to the decision above. The Network Information API
 * describes the radio, not whether anything answers — a van parked under a
 * strong 4G cell whose backhaul is down reports '4g' — and it exists in no
 * WebKit browser at all, so half our target devices would be labelled by one
 * rule and half by another if it ever decided anything.
 *
 * What it is good for is the second sentence: telling a driver whose requests
 * are merely SLOW that the app is working rather than stuck.
 */
export type ConnectionHint = 'slow' | 'saveData' | null

export function connectionHint(): ConnectionHint {
  if (typeof navigator === 'undefined') return null
  const conn = (navigator as { connection?: { effectiveType?: string; saveData?: boolean } })
    .connection
  if (!conn) return null
  if (conn.saveData) return 'saveData'
  if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return 'slow'
  return null
}

export interface Reachability {
  online: boolean
  /** Outcome of a REAL request. The strongest signal there is. */
  report(reached: boolean): void
  subscribe(listener: (online: boolean) => void): () => void
  /** Detach the browser listeners. Tests and hot reload. */
  stop(): void
}

/** Consecutive network failures before we call it an outage. */
export const FAILURES_BEFORE_OFFLINE = 2

export function createReachability(): Reachability {
  const listeners = new Set<(online: boolean) => void>()
  let failures = 0

  const state = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  }

  const set = (next: boolean) => {
    if (state.online === next) return
    state.online = next
    for (const listener of listeners) listener(next)
  }

  const wentOffline = () => {
    failures = FAILURES_BEFORE_OFFLINE
    set(false)
  }
  // The OS says an interface came back. That is permission to try, not proof
  // it worked: the next real request decides.
  const wentOnline = () => {
    failures = 0
    set(true)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', wentOffline)
    window.addEventListener('online', wentOnline)
  }

  return {
    get online() {
      return state.online
    },
    report(reached) {
      if (reached) {
        failures = 0
        set(true)
        return
      }
      failures++
      if (failures >= FAILURES_BEFORE_OFFLINE) set(false)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stop() {
      listeners.clear()
      if (typeof window === 'undefined') return
      window.removeEventListener('offline', wentOffline)
      window.removeEventListener('online', wentOnline)
    },
  }
}

let singleton: Reachability | null = null

/** The app's shared signal. Lazy, so importing a type starts no listeners. */
export function getReachability(): Reachability {
  if (!singleton) singleton = createReachability()
  return singleton
}

/** Test seam. */
export function resetReachability(): void {
  singleton?.stop()
  singleton = null
}
