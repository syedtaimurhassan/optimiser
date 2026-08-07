import type { Route } from '../../types'
import { ListRow } from '../ui'
import { MoreIcon } from '../ui/icons'
import { formatShortDate, formatStopSummary, summariseStops } from '../../lib/routeGrouping'

export interface RouteListRowProps {
  route: Route
  /** The route currently open behind the drawer. */
  active: boolean
  onOpen: () => void
  onOverflow: () => void
}

/**
 * One route in the drawer: date, name, and a summary of how it went.
 *
 * The summary line is an addition to Spoke, which shows date and name only.
 * That omission means the only way to find out whether Tuesday's round was
 * finished is to open Tuesday's round — the drawer knows the answer and
 * declines to say. It is deliberately the quietest thing in the row: meta
 * type, on-surface-variant, and the only colour is red on a non-zero failed
 * count, because that is the one number worth interrupting someone for.
 */
export function RouteListRow({ route, active, onOpen, onOverflow }: RouteListRowProps) {
  const summary = summariseStops(route.stops)

  return (
    <ListRow
      size="row-lg"
      selected={active}
      onClick={onOpen}
      title={
        <span className="flex items-baseline gap-2 text-primary">
          <span className="shrink-0 font-normal tabular-nums">{formatShortDate(route.dateISO)}</span>
          <span className="truncate font-bold">{route.name}</span>
        </span>
      }
      meta={
        <span aria-label={formatStopSummary(summary)}>
          {summary.total === 0 ? (
            'No stops yet'
          ) : (
            <>
              {summary.total} stop{summary.total === 1 ? '' : 's'}
              {summary.delivered > 0 && ` · ${summary.delivered} delivered`}
              {summary.failed > 0 && <span className="text-danger"> · {summary.failed} failed</span>}
            </>
          )}
        </span>
      }
      trailing={
        <button
          type="button"
          onClick={onOverflow}
          aria-label={`More options for ${route.name}`}
          className="flex h-touch w-touch items-center justify-center rounded-pill text-on-surface-variant"
        >
          <MoreIcon className="h-5 w-5" />
        </button>
      }
    />
  )
}
