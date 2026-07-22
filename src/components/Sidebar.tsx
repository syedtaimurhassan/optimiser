import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useRouteStore } from '../store/routeStore'
import { HeaderPanel } from './HeaderPanel'
import { ColdStartBanner } from './ColdStartBanner'
import { StopsPanel } from './StopsPanel'
import { DeliveredPanel } from './DeliveredPanel'
import { RouteSetupPanel } from './RouteSetupPanel'
import { ResultsPanel } from './ResultsPanel'
import { FavoritesPanel } from './FavoritesPanel'
import { CalculatePanel } from './CalculatePanel'

// How much of the sheet peeks above the bottom edge when collapsed (px).
const PEEK_PX = 116

/**
 * The controls sidebar. On desktop (md+) it's the fixed left column with the
 * pinned Calculate footer — unchanged. On phones it becomes a bottom sheet that
 * can be dragged (or tapped on its handle) between a peek and an expanded state,
 * letting the full-height map breathe underneath.
 */
export function Sidebar() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const placementMode = useRouteStore((s) => s.mapPlacementMode)

  const sheetRef = useRef<HTMLElement>(null)
  const [peekY, setPeekY] = useState(600)
  const [expanded, setExpanded] = useState(false)
  const [dragY, setDragY] = useState<number | null>(null)
  const dragStart = useRef<{ y: number; base: number } | null>(null)

  // Measure how far to slide down for the peek state (sheet height − PEEK_PX).
  useLayoutEffect(() => {
    if (!isMobile) return
    const measure = () => {
      const h = sheetRef.current?.offsetHeight ?? window.innerHeight * 0.88
      setPeekY(Math.max(h - PEEK_PX, 0))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isMobile])

  // Starting a map placement collapses the sheet so the map is tappable.
  useEffect(() => {
    if (isMobile && placementMode) setExpanded(false)
  }, [isMobile, placementMode])

  const baseY = expanded ? 0 : peekY
  const currentY = dragY ?? baseY

  function onPointerDown(e: ReactPointerEvent) {
    if (!isMobile) return
    dragStart.current = { y: e.clientY, base: baseY }
    setDragY(baseY)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!dragStart.current) return
    const delta = e.clientY - dragStart.current.y
    setDragY(Math.min(Math.max(dragStart.current.base + delta, 0), peekY))
  }
  function onPointerUp() {
    if (!dragStart.current) return
    const settled = dragY ?? baseY
    const moved = settled - dragStart.current.base
    if (Math.abs(moved) < 8) setExpanded((v) => !v) // treat as a tap → toggle
    else setExpanded(settled < peekY / 2)
    setDragY(null)
    dragStart.current = null
  }

  const sheetStyle = isMobile
    ? {
        transform: `translateY(${currentY}px)`,
        transition: dragStart.current ? 'none' : 'transform 0.3s ease',
      }
    : undefined

  return (
    <aside
      ref={sheetRef}
      style={sheetStyle}
      className="fixed inset-x-0 bottom-0 z-[1500] flex h-[88dvh] min-h-0 flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:static md:z-auto md:h-auto md:w-96 md:flex-none md:rounded-none md:border-0 md:border-r md:shadow-none md:order-1"
    >
      {/* Drag handle + peek header — mobile only */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="button"
        aria-label={expanded ? 'Collapse controls' : 'Expand controls'}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5 active:cursor-grabbing md:hidden"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" />
        <PeekHeader expanded={expanded} />
      </div>

      {/* Scrollable controls */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-28 pt-1 md:p-4">
        <HeaderPanel />
        <ColdStartBanner />
        <StopsPanel />
        <DeliveredPanel />
        <RouteSetupPanel />
        <ResultsPanel />
        <FavoritesPanel />
      </div>

      {/* Pinned Calculate footer — desktop only (mobile uses the FAB) */}
      <div className="hidden shrink-0 border-t border-slate-200 bg-white p-3 md:block">
        <CalculatePanel />
      </div>
    </aside>
  )
}

/** The always-visible summary shown in the collapsed sheet, so a tap target and
 *  a hint of state are present even in peek. */
function PeekHeader({ expanded }: { expanded: boolean }) {
  const activeStops = useRouteStore(
    (s) => s.waypoints.filter((w) => !w.delivered).length,
  )
  const hasRoute = useRouteStore((s) => Boolean(s.optimizedRoute))

  return (
    <div className="mt-1.5 flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-700">
        {activeStops} stop{activeStops === 1 ? '' : 's'}
        {hasRoute && <span className="ml-1.5 font-normal text-emerald-600">• routed</span>}
      </span>
      <span className="text-xs text-slate-400">{expanded ? 'drag down to close' : 'tap to edit route'}</span>
    </div>
  )
}
