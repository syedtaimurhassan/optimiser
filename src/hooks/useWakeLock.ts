import { useEffect, useRef, useState } from 'react'

/**
 * Keep the screen awake while a route is being driven.
 *
 * ── Why this is in a routing app at all ───────────────────────────────────
 *
 * Background geolocation is impossible on the web: the Geolocation API is not
 * exposed to service workers and `watchPosition` stops delivering the moment
 * the page is backgrounded. The nearest honest substitute is to keep the page
 * in the foreground, which is exactly what a wake lock does. It is not a
 * comfort feature; it is the reason live position tracking works at all.
 *
 * ── Re-acquisition is not optional ────────────────────────────────────────
 *
 * The lock is released by the browser whenever the document is hidden — every
 * app switch, every incoming call, every time the driver checks a message. It
 * does NOT come back on its own. A hook that acquires once works until the
 * first interruption and then silently stops, which is the worst kind of
 * broken: it looks fine in a five-minute test and fails on a real round.
 */

interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

export interface WakeLockState {
  /** True while a lock is actually held — not merely requested. */
  held: boolean
  /** The API exists here. False on any browser that has never shipped it. */
  supported: boolean
}

export function useWakeLock(active: boolean): WakeLockState {
  const supported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [held, setHeld] = useState(false)
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    if (!active || !supported) {
      setHeld(false)
      return
    }

    let cancelled = false

    const acquire = async () => {
      // Requesting while hidden always rejects, so do not even try — an
      // exception per visibility change is noise, not information.
      if (cancelled || document.visibilityState !== 'visible') return
      if (sentinelRef.current && !sentinelRef.current.released) return
      try {
        const lock = await (navigator as unknown as { wakeLock: WakeLockLike }).wakeLock.request(
          'screen',
        )
        if (cancelled) {
          void lock.release()
          return
        }
        sentinelRef.current = lock
        setHeld(true)
        lock.addEventListener('release', () => {
          if (!cancelled) setHeld(false)
        })
      } catch {
        // Denied, or the battery saver refused it. Nothing to tell the driver:
        // the screen dimming is not an error, it is the default behaviour.
        setHeld(false)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
      else setHeld(false)
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      const lock = sentinelRef.current
      sentinelRef.current = null
      setHeld(false)
      if (lock && !lock.released) void lock.release().catch(() => {})
    }
  }, [active, supported])

  return { held, supported }
}
