import { useEffect, useRef, useState } from 'react'
import { clearWitness, hasWitness, isDataLoss, setWitness } from '../lib/pwa/eviction'
import { useRoutesStore } from '../store/routesStore'

/**
 * "Did the browser throw my round away?" — asked once, at boot.
 *
 * ── Why the check runs exactly once, before anything else ─────────────────
 *
 * An eviction and a driver deliberately deleting every stop produce the SAME
 * two facts: a witness saying there used to be data, and a store saying there
 * is none. Only the timing separates them. At boot, before the driver has
 * touched anything, that combination can only be an eviction; a second later
 * it could be a Friday afternoon tidy-up.
 *
 * So `checked` latches after the first run and the witness is kept in sync
 * afterwards. Re-running the check on every change of `hasData` would fire the
 * banner at the driver the moment they cleared their last stop.
 *
 * This runs after hydration because the banner is rendered after it — see
 * App.tsx — so `hasData` is the rehydrated answer rather than the initial one.
 */
export function useDataLoss(): { lost: boolean; acknowledge: () => void } {
  const [lost, setLost] = useState(false)
  const checked = useRef(false)
  const hasData = useRoutesStore((s) =>
    Object.values(s.routes).some((r) => r.stops.length > 0),
  )

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    void (async () => {
      const witness = await hasWitness()
      if (isDataLoss({ hasWitness: witness, hasData })) {
        setLost(true)
        // Clear it immediately: the news is delivered once, and leaving the
        // witness would repeat it on every launch until data reappeared.
        await clearWitness()
      }
    })()
  }, [hasData])

  // Keep the witness honest for next time. Emptying the app on purpose must
  // not look like an eviction tomorrow morning.
  useEffect(() => {
    if (!checked.current) return
    void (hasData ? setWitness() : clearWitness())
  }, [hasData])

  return { lost, acknowledge: () => setLost(false) }
}
