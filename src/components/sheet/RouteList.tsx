import { useCallback, useEffect, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Route } from '../../types'
import type { RouteRow } from '../../lib/routeList'
import { useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { BreakRow, EndRow, FooterRow, HeaderRow, StartRow } from './ListRows'
import { StopRow } from './StopRow'

/**
 * The route list, windowed.
 *
 * ── Why a virtualiser and not 300 divs ────────────────────────────────────
 *
 * A round is hundreds of stops, and M7 adds photos to the rows. Every row is
 * ~10 elements, so the naive list is several thousand nodes that the browser
 * lays out, styles and keeps in memory on a phone that is also running a WebGL
 * map. Windowing keeps roughly fifteen rows alive regardless of route length,
 * which is what makes the cost of scrolling independent of the size of the
 * round.
 *
 * ── Why THIS virtualiser ──────────────────────────────────────────────────
 *
 * Rows are not a fixed height: a note or a tag turns a 72dp row into a 96dp
 * one, and a two-line address does it again. `measureElement` reports each
 * row's real height back after it renders and reflows the ones below it, so
 * the list does not need to be told heights it cannot know. The alternative —
 * estimating and hoping — puts the scrollbar and the content out of step, and
 * the error accumulates over 300 rows.
 *
 * The estimates below still matter: they decide how far the two-pass measure
 * has to correct, and a good estimate is the difference between a smooth
 * scroll and rows that visibly settle.
 */
export interface RouteListProps {
  route: Route
  rows: RouteRow[]
  /** The sheet's scroll container. The list does not own it — the sheet does. */
  scrollElementRef: RefObject<HTMLDivElement | null>
  /** Published so the jump FAB, which lives outside this component, can scroll. */
  scrollToIndexRef: RefObject<((index: number) => void) | null>
}

/** Starting heights, in px. Deliberately close to the real thing. */
function estimateFor(row: RouteRow): number {
  switch (row.kind) {
    case 'header':
      return 116
    case 'break':
      return 56
    case 'start':
    case 'end':
      return 72
    case 'footer':
      return 92
    case 'stop':
      // A tag row and a note line each add roughly a line of text. Guessing 72
      // for all of them would mean every decorated row corrects downwards on
      // first paint, which is the visible "settling" this avoids.
      return 72 + (row.tags.length > 0 ? 24 : 0) + (row.note ? 20 : 0)
  }
}

export function RouteList({ route, rows, scrollElementRef, scrollToIndexRef }: RouteListProps) {
  const selectedStopId = useUiStore((s) => s.selectedStopId)
  const setSelectedStopId = useUiStore((s) => s.setSelectedStopId)
  const setSetupOpen = useUiStore((s) => s.setSetupOpen)
  const setRouteStatus = useRoutesStore((s) => s.setRouteStatus)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: (index) => estimateFor(rows[index]),
    // Keyed by row id, not index: a stop marked delivered can reorder the list,
    // and an index key would recycle a measured height onto a different row.
    getItemKey: (index) => rows[index].id,
    overscan: 6,
  })

  useEffect(() => {
    scrollToIndexRef.current = (index: number) =>
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
    return () => {
      scrollToIndexRef.current = null
    }
  }, [virtualizer, scrollToIndexRef])

  const onSelect = useCallback(
    (id: string) => setSelectedStopId(selectedStopId === id ? null : id),
    [selectedStopId, setSelectedStopId],
  )

  /**
   * The break, the endpoints and the two header chips are not built yet, so
   * every one of them opens the panel that CAN do the job today rather than
   * doing nothing. A control that visibly does nothing teaches a driver to
   * stop trying it; one that lands somewhere useful does not.
   */
  const toSetup = useCallback(() => setSetupOpen(true), [setSetupOpen])

  return (
    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }} data-testid="route-list">
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]
        return (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            data-row-kind={row.kind}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {renderRow(row)}
          </div>
        )
      })}
    </div>
  )

  function renderRow(row: RouteRow) {
    switch (row.kind) {
      case 'header':
        return <HeaderRow title={row.title} />
      case 'break':
        return <BreakRow label={row.label} planned={row.planned} onPlan={toSetup} />
      case 'start':
        return (
          <StartRow
            time={row.time}
            subtitle={row.subtitle}
            hasAnchor={row.hasAnchor}
            onSetHome={toSetup}
          />
        )
      case 'stop':
        return <StopRow row={row} selected={row.id === selectedStopId} onSelect={onSelect} />
      case 'end':
        return <EndRow time={row.time} hasAnchor={row.hasAnchor} onSetEnd={toSetup} />
      case 'footer':
        return (
          <FooterRow
            completed={row.completed}
            onComplete={() => setRouteStatus(route.id, 'completed')}
          />
        )
    }
  }
}
