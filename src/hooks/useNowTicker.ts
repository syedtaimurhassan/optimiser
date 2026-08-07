import { useEffect, useState } from 'react'

/** How often a displayed clock is refreshed. */
const TICK_MS = 30_000

/**
 * Now, in epoch ms, re-read every 30 seconds.
 *
 * Anything showing a finish time needs this: a clock that silently goes stale
 * is worse than no clock, because it looks live. 30s means the displayed
 * minute is never more than a minute wrong, at one render a minute — cheap
 * enough that both the finish pill and the sheet's summary strip can hold one
 * without either of them driving a re-render of the map or the list.
 */
export function useNowTicker(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  return now
}
