import type { AddressedStop, OptimizedRoute } from '../../types'
import { formatKm, remainingRoute } from '../../lib/routeSummary'
import { useNowTicker } from '../../hooks/useNowTicker'

/**
 * "Finish 17:07 · 0 stops · 11 km" — the collapsed sheet's entire content.
 *
 * ── These are REMAINING values, and that is the whole point ───────────────
 *
 * On a 44-stop round that reads "0 stops · 11 km" when the driver is finished
 * delivering and has only the drive home left. Totals would be useless here:
 * a driver at 16:30 does not need to be told they set out with 44 stops, they
 * need to know what is left of the day. Three facts, no labels, no chrome —
 * this is the one thing visible when the sheet is down, so it has to be
 * readable at a glance from a cradle.
 *
 * The estimate behind the finish time lives in `lib/routeSummary.ts`, shared
 * with the map's finish pill so the two can never print different times.
 */
export interface SummaryStripProps {
  stops: readonly AddressedStop[]
  optimized: OptimizedRoute | undefined
}

export function SummaryStrip({ stops, optimized }: SummaryStripProps) {
  const now = useNowTicker()
  const remaining = remainingRoute({ stops, optimized, nowMs: now })
  const distance = formatKm(remaining.metresLeft)

  return (
    <div
      data-testid="summary-strip"
      className="flex min-w-0 items-baseline gap-1.5 text-row text-on-surface"
    >
      {remaining.finishClock && (
        <>
          <span className="shrink-0">
            <span className="text-on-surface-variant">Finish </span>
            <span className="font-semibold tabular-nums">{remaining.finishClock}</span>
          </span>
          <Bullet />
        </>
      )}

      <span className="shrink-0 font-semibold tabular-nums">
        {remaining.stopsLeft} <span className="font-normal">stop{remaining.stopsLeft === 1 ? '' : 's'}</span>
      </span>

      {distance && (
        <>
          <Bullet />
          <span className="truncate font-semibold tabular-nums">{distance}</span>
        </>
      )}
    </div>
  )
}

/** Hidden from the accessibility tree — a screen reader reads three facts, not two dots. */
function Bullet() {
  return (
    <span aria-hidden="true" className="shrink-0 text-on-surface-variant">
      ·
    </span>
  )
}
