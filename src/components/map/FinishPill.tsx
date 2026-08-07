import { useEffect, useState } from 'react'
import { FlagIcon } from '../ui/icons'

/**
 * "You'll finish at 16:42" — top-right, over the map, always.
 *
 * It persists across every map state on purpose. Finish time is the one
 * number that answers the question a driver actually has all day, and a pill
 * that came and went with the selection would make them hunt for it.
 *
 * ── What this estimate is, and is not ─────────────────────────────────────
 *
 * The pipeline does not yet produce per-stop arrival times — `arrivalSec` is
 * still empty, and filling it is M7's job. Until then the remaining drive is
 * approximated by scaling the solved total by the share of stops still
 * pending. That is a straight line through a curve: it ignores where in the
 * route the driver is, and it will read optimistically on a round whose long
 * legs come last.
 *
 * It is shown anyway because a rough finish time beats no finish time, but it
 * is deliberately labelled as approximate and should be replaced, not
 * refined, once real arrivals exist.
 */
export interface FinishPillProps {
  /** Total solved drive time, seconds. Undefined on an unsolved route. */
  durationSeconds: number | undefined
  pendingCount: number
  totalCount: number
}

export function FinishPill({ durationSeconds, pendingCount, totalCount }: FinishPillProps) {
  const [now, setNow] = useState(() => Date.now())

  // A finish time that silently goes stale is worse than none. Re-tick every
  // 30s so the displayed minute is never more than a minute wrong.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (durationSeconds === undefined || !Number.isFinite(durationSeconds)) return null

  const share = totalCount > 0 ? pendingCount / totalCount : 1
  const finish = new Date(now + durationSeconds * share * 1000)
  const time = `${String(finish.getHours()).padStart(2, '0')}:${String(
    finish.getMinutes(),
  ).padStart(2, '0')}`

  return (
    <div
      className="pointer-events-auto absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-pill border border-outline bg-surface px-3 py-2 shadow-md"
      data-testid="finish-pill"
    >
      <FlagIcon className="h-4 w-4 text-on-surface-variant" />
      <span className="text-label font-semibold tabular-nums text-on-surface">{time}</span>
      <span className="sr-only">estimated finish time</span>
    </div>
  )
}
