import { useEffect, useState } from 'react'
import { clearDataLossMarker, detectDataLoss, markKnownGood } from '../lib/pwa/eviction'
import { useRoutesStore } from '../store/routesStore'

/**
 * "Did the browser throw my round away?" — asked once, after hydration.
 *
 * ── Why it runs after hydration and not at boot ───────────────────────────
 *
 * The check compares "we have been here before" (a surviving shell cache)
 * against "and IndexedDB was intact" (a marker inside it). Asking before the
 * store has rehydrated would race the very read it is asking about, and a race
 * that resolves the wrong way tells a driver their data is gone while it is
 * loading in front of them.
 *
 * The marker is written only when there is something to lose. Writing it
 * unconditionally would set it on a first run and permanently disarm the
 * check — see lib/pwa/eviction.ts for what is and is not detectable at all.
 */
export function useDataLoss(): { lost: boolean; acknowledge: () => void } {
  const [lost, setLost] = useState(false)
  const hasData = useRoutesStore((s) =>
    Object.values(s.routes).some((r) => r.stops.length > 0),
  )

  useEffect(() => {
    let cancelled = false
    void detectDataLoss().then((result) => {
      if (!cancelled) setLost(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (hasData) void markKnownGood()
  }, [hasData])

  return {
    lost,
    acknowledge: () => {
      setLost(false)
      void clearDataLossMarker()
    },
  }
}
