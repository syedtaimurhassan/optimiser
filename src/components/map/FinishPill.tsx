import type { AddressedStop, OptimizedRoute } from '../../types'
import { remainingRoute } from '../../lib/routeSummary'
import { useNowTicker } from '../../hooks/useNowTicker'
import { FlagIcon } from '../ui/icons'

/**
 * "You'll finish at 16:42" — top-right, over the map, always.
 *
 * It persists across every map state on purpose. Finish time is the one
 * number that answers the question a driver actually has all day, and a pill
 * that came and went with the selection would make them hunt for it.
 *
 * The estimate itself belongs to `lib/routeSummary.ts`, which documents what
 * it is and is not — M5 puts the same number on the sheet's summary strip, and
 * two finish times on one screen that disagree would be worse than one rough
 * one.
 */
export interface FinishPillProps {
  stops: readonly AddressedStop[]
  optimized: OptimizedRoute | undefined
}

export function FinishPill({ stops, optimized }: FinishPillProps) {
  const now = useNowTicker()
  const { finishClock: time } = remainingRoute({ stops, optimized, nowMs: now })

  if (!time) return null

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
