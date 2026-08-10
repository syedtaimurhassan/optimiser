import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'wouter'
import {
  clampOffset,
  listScrolls,
  nextSnapUp,
  snapFor,
  snapOffsets,
  type SheetSnap,
  type SnapOffsets,
} from '../../lib/sheetSnap'
import { buildRouteRows, nextStopRowIndex } from '../../lib/routeList'
import { buildReviewRows } from '../../lib/reviewList'
import { changeCount, stagedRoute } from '../../lib/staging'
import { planIsStale } from '../../lib/routeSummary'
import { GROUP_COLORS } from '../../lib/map/palette'
import { liveEta } from '../../lib/arrivals'
import { useNowTicker } from '../../hooks/useNowTicker'
import { searchPlaceholder } from '../../lib/searchScreen'
import { selectActiveRoute, useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { ChevronDownIcon } from '../ui/icons'
import { SheetHeader } from './SheetHeader'
import { RouteList } from './RouteList'
import { SearchScreen } from '../search/SearchScreen'
import { EmptyRouteState } from './EmptyRouteState'
import { CopyStopsSheet } from '../routes/CopyStopsSheet'
import { RouteMenuSheet } from '../routes/RouteMenuSheet'
import { ImportStopsSheet } from '../search/ImportStopsSheet'
import { ScannerSheet } from '../scan/ScannerSheet'
import { ScanMatchSheet } from '../scan/ScanMatchSheet'
import { matchScan, type ScanMatch } from '../../lib/scan'
import { copySourceRoutes } from '../../lib/copyStops'
import { useAddStops } from '../../hooks/useAddStops'
import { StopPages } from '../stop/StopPages'
import { ReviewChanges } from '../review/ReviewChanges'
import { StagedBanner } from '../review/StagedBanner'
import { ReviewHeader } from '../review/ReviewHeader'
import { ReviewBottomBar } from '../review/ReviewBottomBar'
import { ApplyChangesSheet } from '../review/ApplyChangesSheet'
import type { ProvisionalState } from '../../hooks/useProvisionalRoute'
import type { StopPage } from '../../lib/stopPages'

/**
 * The persistent bottom sheet.
 *
 * Not a modal — it is over the map on every route screen, at one of four
 * detents, and it is never dismissed. `ui/Sheet.tsx` remains the modal sheet
 * (scrim, focus trap, Escape); this one shares none of that machinery because
 * it shares none of those jobs.
 *
 * ── The nested-scroll problem, and how it is actually solved ──────────────
 *
 * A draggable sheet containing a scrollable list has two things that both want
 * a vertical drag. Getting it wrong gives you the two classic failures: a list
 * that drags the sheet instead of scrolling, or a sheet that cannot be closed
 * without first scrolling the list to the top.
 *
 * The fix is two rules, and the second one matters more than it looks:
 *
 *  1. Below `expanded`, the list simply does not scroll (`listScrolls`). With
 *     no competing scroller there is nothing to arbitrate, so every drag on a
 *     half-open sheet is unambiguously the sheet's.
 *  2. At `expanded` and `full`, the gesture is classified ONCE, on the first
 *     move past the slop threshold, and never reclassified: the sheet takes it
 *     only if the list is already at the top AND the finger is moving down.
 *     Anything else belongs to the list for the rest of that gesture.
 *
 * Deciding once is the part that is easy to skip and impossible to live with.
 * A handler that re-evaluates on every move will hand the gesture back and
 * forth mid-drag as `scrollTop` crosses zero, and the sheet judders.
 *
 * `overscroll-behavior: contain` on the list does the rest: at `scrollTop` 0
 * with a downward drag the browser has no scrolling left to do and will not
 * chain to the document, so moving the sheet by transform is uncontested.
 *
 * ── Why the drag never enters React state ─────────────────────────────────
 *
 * A pointermove writing to state would re-render this component — and the list
 * inside it — up to 120 times a second. The offset is therefore a ref, written
 * straight to `style.transform`, and React only hears about the RESULT when
 * the finger lifts. React decides which detent; the browser animates to it.
 */

/** Movement before a gesture is classified. Below this it is still a tap. */
const SLOP_PX = 4
/** Total movement under which a gesture counts as a tap on release. */
const TAP_PX = 8
const SETTLE_MS = 260
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

export interface RouteSheetProps {
  /** The carousel's pages, built by the screen from the URL's route. */
  pages: StopPage[]
  /** Which page the URL names, or -1 when no stop is open. */
  pageIndex: number
  /** The URL is on `/review`: the sheet shows the diff and the two actions. */
  reviewing: boolean
  provisional: ProvisionalState
}

export function RouteSheet({ pages, pageIndex, reviewing, provisional }: RouteSheetProps) {
  const [, navigate] = useLocation()
  const route = useRoutesStore(selectActiveRoute)
  const snap = useUiStore((s) => s.sheetSnap)
  const setSnap = useUiStore((s) => s.setSheetSnap)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)
  const searchQuery = useUiStore((s) => s.searchQuery)
  const setSearchQuery = useUiStore((s) => s.setSearchQuery)
  const searchOpen = useUiStore((s) => s.searchOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const setAddByPinOpen = useUiStore((s) => s.setAddByPinOpen)
  const { addSuggestion, addFromClipboard } = useAddStops()
  const addStops = useRoutesStore((s) => s.addStops)
  const allRoutes = useRoutesStore((s) => s.routes)
  const [copyOpen, setCopyOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  /** A scan that needs the driver to decide something. Null the rest of the time. */
  const [scanQuestion, setScanQuestion] = useState<ScanMatch | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const dropPendingChange = useRoutesStore((s) => s.dropPendingChange)
  const clearPending = useRoutesStore((s) => s.clearPending)
  const ensureGroup = useRoutesStore((s) => s.ensureGroup)
  const updateStop = useRoutesStore((s) => s.updateStop)

  const sheetRef = useRef<HTMLElement>(null)
  const headerBlockRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** Set by RouteList; called by the jump FAB, which lives outside the scroller. */
  const scrollToIndexRef = useRef<((index: number) => void) | null>(null)

  // The rows are built HERE rather than inside the list because two things
  // need them: the list renders them, and the jump FAB needs to know whether
  // there is a next stop to jump to. Building them twice would be building
  // 300 rows twice.
  /*
    ETAs, computed ONCE per tick and shared.

    The rows want them, the stop card wants them, and computing them twice
    would anchor the two to two different instants — so a row could read 16:03
    while the card for the same stop read 16:04. The ticker is the same one the
    finish pill uses, so every clock on the screen moves together.
  */
  const nowMs = useNowTicker()
  /*
    The STAGED view, and everything on the screen reads it.

    The map already draws the provisional polyline and the finish pill already
    reads the provisional plan, so a sheet still reading the committed one put
    two different clocks on one screen — the end card saying 07:26 while the
    pill said 07:25. That is the exact failure M7 recorded and solved by
    computing the ETAs once; staging reintroduced it by giving the two halves
    of the screen different plans to compute from.

    Note what this does NOT do: it does not reorder anything. The frozen
    sequence is preserved by construction, so the list looks the same with the
    new stop inserted where the preview puts it. What is held back is the
    COMMIT — the authoritative route is untouched, Discard is one assignment,
    and no stop is renumbered until the driver says so.
  */
  const view = useMemo(() => (route ? stagedRoute(route) : null), [route])
  const etaByStopId = useMemo(
    () =>
      view?.optimized
        ? liveEta({ optimized: view.optimized, stops: view.stops, nowMs }).byStopId
        : undefined,
    [view, nowMs],
  )

  const rows = useMemo(
    () => (view ? buildRouteRows({ route: view, etaByStopId }) : []),
    [view, etaByStopId],
  )
  const nextIndex = useMemo(() => nextStopRowIndex(rows), [rows])

  // The diff. Built only while it is on screen — a staged route spends most of
  // its life not being reviewed, and these rows are not free at 300 stops.
  const reviewRows = useMemo(
    () => (route && reviewing ? buildReviewRows({ route, nowMs }) : []),
    [route, reviewing, nowMs],
  )
  const changes = changeCount(route?.pending)

  /**
   * Reviewing means the sheet is all the way up, and stays there.
   *
   * The diff is the screen at that moment. Leaving it draggable would let a
   * driver pull it down over the map and lose the bottom bar, which is the
   * only way to resolve the state they are in.
   */
  useEffect(() => {
    if (reviewing) setSnap('full')
  }, [reviewing, setSnap])

  /**
   * A review with nothing left in it is not a screen. Undoing the last change
   * — or discarding — lands back on the route rather than on an empty diff
   * with an Apply button that cannot do anything.
   */
  useEffect(() => {
    if (reviewing && route && changes === 0) navigate(`/route/${route.id}`, { replace: true })
  }, [reviewing, route, changes, navigate])

  // Routes worth offering as a copy source. Computed here rather than inside
  // the sheet because the empty state needs the COUNT to decide whether to
  // offer the button at all.
  const copySources = useMemo(
    () => copySourceRoutes(Object.values(allRoutes), route?.id),
    [allRoutes, route?.id],
  )

  const [viewportHeight, setViewportHeight] = useState(() => readViewportHeight())
  const [collapsedHeight, setCollapsedHeight] = useState(112)

  const offsets = useMemo(
    () => snapOffsets({ viewportHeight, collapsedHeight }),
    [viewportHeight, collapsedHeight],
  )

  // Handlers registered once must not close over a stale snap or stale offsets.
  const snapRef = useRef(snap)
  const offsetsRef = useRef(offsets)
  snapRef.current = snap
  offsetsRef.current = offsets

  // ── Geometry ───────────────────────────────────────────────────────────

  /**
   * The VISUAL viewport, not `innerHeight`.
   *
   * When the search field takes focus the keyboard covers the bottom of the
   * screen, and `visualViewport.height` shrinks to what is actually visible
   * while `innerHeight` does not. Tracking the visual one is what makes the
   * `full` detent mean "the sheet fills what you can see with the keyboard up"
   * rather than "the sheet fills the screen, most of it behind the keyboard".
   */
  useEffect(() => {
    const onResize = () => setViewportHeight(readViewportHeight())
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  // The collapsed detent is measured, never assumed: it is the grab handle
  // plus the header row plus the device's bottom safe area, and the last of
  // those is a different number on every phone.
  useLayoutEffect(() => {
    const block = headerBlockRef.current
    const sheet = sheetRef.current
    if (!block || !sheet) return

    const measure = () => {
      const inset = Number.parseFloat(getComputedStyle(sheet).paddingBottom) || 0
      setCollapsedHeight(Math.round(block.offsetHeight + inset))
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(block)
    return () => observer.disconnect()
  }, [])

  /**
   * Leaving the expanded detents exits search.
   *
   * Search only has a field to type into at `expanded` and `full`. Below them
   * the header shows the summary strip instead — so without this, dragging the
   * sheet down mid-search left `searchOpen` true and the route list replaced by
   * a search screen the driver could no longer see the field for. The way out
   * was a control that was no longer on screen.
   *
   * The header already blurs the input on the same transition; this is the
   * state half of that same rule.
   */
  useEffect(() => {
    if (snap === 'expanded' || snap === 'full') return
    if (!searchOpen && searchQuery === '') return
    setSearchOpen(false)
    setSearchQuery('')
  }, [snap, searchOpen, searchQuery, setSearchOpen, setSearchQuery])

  /**
   * Opening a stop card opens the sheet enough to read it.
   *
   * Only on the OPEN transition, and only from `collapsed` — swiping between
   * pages must not resize the sheet, and a driver who has dragged the sheet
   * somewhere deliberately keeps it there. `medium` is the detent this design
   * was named for: enough card to act on, enough map to watch it pan.
   */
  const carouselOpen = pageIndex >= 0
  // Seeded FALSE, not with the current value: a deep link straight at a stop
  // mounts with the carousel already open, and seeding it true meant the sheet
  // stayed collapsed with the card entirely off-screen below the fold.
  const carouselWasOpen = useRef(false)
  useEffect(() => {
    if (carouselOpen && !carouselWasOpen.current) {
      setSearchOpen(false)
      setSearchQuery('')
      // Read rather than subscribe: this wants the detent at the moment the
      // card opened, and depending on `snap` would re-run it mid-drag.
      if (useUiStore.getState().sheetSnap === 'collapsed') setSnap('medium')
    }
    carouselWasOpen.current = carouselOpen
  }, [carouselOpen, setSnap, setSearchOpen, setSearchQuery])

  /**
   * Publish the collapsed height so anything floating over the map can clear
   * it. M4's FAB stack hard-coded 128px to clear the old sheet's 116px peek,
   * and the two numbers had no way to stay related. Now there is one number
   * and it is the measured one.
   */
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sheet-peek', `${collapsedHeight}px`)
    return () => {
      root.style.removeProperty('--sheet-peek')
    }
  }, [collapsedHeight])

  // ── Resting position ───────────────────────────────────────────────────

  const settled = useRef(false)
  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el || dragRef.current) return
    // The very first application must not animate, or the sheet slides up from
    // the bottom edge on every cold load and on every route change.
    el.style.transition = settled.current ? `transform ${settleMs()}ms ${EASE}` : 'none'
    el.style.transform = `translateY(${offsets[snap]}px)`
    settled.current = true
  }, [snap, offsets])

  // ── The gesture ────────────────────────────────────────────────────────

  interface Drag {
    pointerId: number
    startX: number
    startY: number
    startOffset: number
    lastY: number
    lastT: number
    velocity: number
    mode: 'undecided' | 'sheet' | 'list'
    fromList: boolean
    travelled: number
  }
  const dragRef = useRef<Drag | null>(null)

  const currentOffset = useCallback((): number => {
    const el = sheetRef.current
    if (!el) return offsetsRef.current[snapRef.current]
    // The live matrix, so a drag beginning mid-animation starts from where the
    // sheet actually IS rather than where it was heading.
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return Number.isFinite(matrix.m42) ? matrix.m42 : offsetsRef.current[snapRef.current]
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent, fromList: boolean) => {
      if (e.button !== 0 || dragRef.current) return

      // A tap on a control inside the header is that control's, not a drag —
      // except the grab handle, which is itself a `role="button"` (it has to
      // be: it is operable, and a bare div is invisible to a screen reader).
      // Excluding it here is what silently swallowed every tap on the handle
      // the first time this ran.
      const control = (e.target as HTMLElement).closest(
        'button, input, a, [role="button"], [role="radio"]',
      )
      if (control && !control.hasAttribute('data-sheet-handle')) return

      const el = sheetRef.current
      if (!el) return
      el.style.transition = 'none'

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffset: currentOffset(),
        lastY: e.clientY,
        lastT: e.timeStamp,
        velocity: 0,
        // A drag begun on the handle is the sheet's from the first pixel;
        // one begun in the list has to earn it.
        mode: fromList ? 'undecided' : 'sheet',
        fromList,
        travelled: 0,
      }
      el.setPointerCapture?.(e.pointerId)
    },
    [currentOffset],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return

    const dy = e.clientY - drag.startY
    drag.travelled = Math.max(drag.travelled, Math.abs(dy))

    // Velocity from the last sample only. An average over the whole gesture
    // would report a slow drag as slow even when it ends in a flick, and the
    // flick is the whole signal.
    const dt = e.timeStamp - drag.lastT
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt
    drag.lastY = e.clientY
    drag.lastT = e.timeStamp

    if (drag.mode === 'undecided') {
      const dx = e.clientX - drag.startX
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP_PX) return

      const list = listRef.current
      const atTop = (list?.scrollTop ?? 0) <= 0
      // A gesture that has travelled further across than down is never the
      // sheet's. The carousel and the row swipe both stop propagation once
      // they claim one, so in practice this handler stops hearing about it —
      // but a horizontal drag starting on a control they decline to claim
      // still reaches here, and dragging the sheet open sideways is a bug.
      drag.mode =
        Math.abs(dx) > Math.abs(dy)
          ? 'list'
          : !listScrolls(snapRef.current) || (atTop && dy > 0)
            ? 'sheet'
            : 'list'

      // Taking the gesture means the list must stop scrolling for its
      // duration — otherwise a drag that reverses upward would scroll the list
      // and move the sheet at the same time.
      if (drag.mode === 'sheet' && list) list.style.overflowY = 'hidden'
    }

    if (drag.mode !== 'sheet') return

    const el = sheetRef.current
    if (el) el.style.transform = `translateY(${clampOffset(drag.startOffset + dy, offsetsRef.current)}px)`
  }, [])

  const endDrag = useCallback(
    (e: ReactPointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      dragRef.current = null

      const list = listRef.current
      if (list) list.style.overflowY = ''
      sheetRef.current?.releasePointerCapture?.(e.pointerId)

      if (drag.mode === 'list') return

      // A tap on the handle steps one detent open, and wraps from the top back
      // to closed — which is what makes all four reachable without a drag.
      if (drag.travelled < TAP_PX) {
        if (!drag.fromList) {
          const from = snapRef.current
          setSnap(from === 'full' ? 'collapsed' : nextSnapUp(from))
        } else {
          restingTransform(sheetRef.current, offsetsRef.current, snapRef.current)
        }
        return
      }

      const target = snapFor({
        offset: currentOffset(),
        velocity: drag.velocity,
        offsets: offsetsRef.current,
      })
      // Re-applying the transform here rather than leaning on the layout effect
      // covers the case where the gesture ends on the detent it started at: the
      // store value is unchanged, so no effect would run and the sheet would be
      // left wherever the finger dropped it.
      restingTransform(sheetRef.current, offsetsRef.current, target)
      setSnap(target)
    },
    [currentOffset, setSnap],
  )

  // Keyboard equivalence for the handle. A drag affordance that only responds
  // to a thumb is unreachable on a desktop browser and to a switch user.
  const onHandleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setSnap(snapRef.current === 'full' ? 'collapsed' : nextSnapUp(snapRef.current))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSnap('collapsed')
      }
    },
    [setSnap],
  )

  // `view` is derived from `route`, so this is one guard, not two — it is
  // written as two only because TypeScript cannot see the derivation.
  if (!route || !view) return null

  const scrollable = listScrolls(snap)
  /**
   * Search replaces the list rather than filtering it in place.
   *
   * Filtering the route list would mean the sequence numbers stayed but the
   * rows between them vanished — a list reading 03, 07, 24 with a continuous
   * timeline connector drawn down its side, implying a route that does not
   * exist. Search is a different question, so it gets a different view, and
   * the connector stays honest.
   */
  const searchActive = searchOpen || searchQuery.trim().length > 0

  return (
    <aside
      ref={sheetRef}
      data-testid="route-sheet"
      data-snap={snap}
      aria-label={`${route.name} — route sheet`}
      style={{ height: viewportHeight, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className="fixed inset-x-0 top-0 z-[1500] flex flex-col rounded-t-sheet border-t border-outline bg-surface shadow-2xl md:hidden"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* The drag surface: handle + header. `touch-action: none` because every
          vertical gesture that starts here is the sheet's by definition. */}
      <div
        ref={headerBlockRef}
        onPointerDown={(e) => onPointerDown(e, false)}
        className="shrink-0 touch-none select-none"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`Route sheet, ${snap}. Arrow keys to resize.`}
          onKeyDown={onHandleKeyDown}
          data-testid="sheet-handle"
          data-sheet-handle=""
          className="flex h-6 cursor-grab items-center justify-center active:cursor-grabbing"
        >
          {/* 32×4dp, ~10dp from the top edge, per the design. */}
          <div aria-hidden="true" className="h-1 w-8 rounded-pill bg-outline" />
        </div>

        {reviewing ? (
          <ReviewHeader
            count={changes}
            onBack={() => navigate(`/route/${route.id}`)}
            onOverflow={() => setMenuOpen(true)}
          />
        ) : (
          <>
        <SheetHeader
          snap={snap}
          routeName={route.name}
          placeholder={searchPlaceholder(view.stops.length)}
          stops={view.stops}
          optimized={view.optimized}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
          onSearchFocus={() => {
            setSnap('full')
            setSearchOpen(true)
          }}
          onSearchTap={() => {
            setSnap('full')
            setSearchOpen(true)
          }}
          onSearchCancel={() => {
            setSearchOpen(false)
            setSearchQuery('')
          }}
          searchActive={searchActive}
          onMenu={() => setDrawerOpen(true)}
          onOverflow={() => setMenuOpen(true)}
        />

            {/*
              Inside the measured header block, deliberately. The collapsed
              detent is measured from this block, so the peek grows by exactly
              this row and the banner is readable with the sheet all the way
              down — which is where it needs to be, because a driver who
              staged a stop and then dropped the sheet to look at the map must
              not lose the only route to applying it.
            */}
            <StagedBanner
              count={changes}
              computing={provisional.computing}
              infeasible={!provisional.feasible}
              onReview={() => navigate(`/route/${route.id}/review`)}
            />
          </>
        )}
      </div>

      {/* The list. `pan-y` leaves native scrolling to the browser; `contain`
          stops an overscroll from chaining out to the document. */}
      <div
        ref={listRef}
        data-testid="sheet-list"
        onPointerDown={(e) => onPointerDown(e, true)}
        className={`min-h-0 flex-1 overscroll-contain ${
          scrollable ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
        style={{ touchAction: 'pan-y' }}
      >
        {reviewing ? (
          /*
            The diff REPLACES the list, exactly as the carousel does. Same
            reason: the sheet is a fixed frame and its content changes inside
            it, so the map behind never stops being the thing the driver is
            reading the diff against.
          */
          <ReviewChanges
            rows={reviewRows}
            fromNow={planIsStale(route, nowMs)}
            onUndo={dropPendingChange}
            onSelectStop={(id) => navigate(`/route/${route.id}/stop/${id}`)}
            onRecolour={(id, color) => {
              // Blue is the DEFAULT group, not a group named "Blue" — the same
              // rule the edit form's chip row follows, and the reason a stop
              // with no group still renders blue everywhere.
              if (color === 'blue') {
                updateStop(id, { groupId: undefined })
                return
              }
              const name = color.charAt(0).toUpperCase() + color.slice(1)
              const group = ensureGroup(name, GROUP_COLORS[color])
              if (group) updateStop(id, { groupId: group })
            }}
          />
        ) : carouselOpen ? (
          /*
            The carousel REPLACES the list rather than floating over it. The
            captured frame that defines this interaction shows both cards at
            the same sheet height with the map panned behind them — the sheet
            is a fixed frame and the cards move inside it, which is only true
            if they are the sheet's content.
          */
          /*
            The STAGED route, so the card and its edit form can find a stop the
            driver has only just added. `AddByPin`'s "add and edit" opens the
            form on a stop that is still in the change set — resolve it against
            the committed stops and the form silently never opens.
          */
          <StopPages
            route={view}
            pages={pages}
            index={pageIndex}
            etaByStopId={etaByStopId}
          />
        ) : searchActive ? (
          <SearchScreen
            query={searchQuery}
            rows={rows}
            // Bias towards where this route actually is. The start anchor is
            // the best cheap proxy for that; without a bias, "Station Road"
            // returns a list from the other side of the country.
            near={route.start ?? route.stops[0] ?? undefined}
            onSelectStop={(id) => {
              setSearchOpen(false)
              setSearchQuery('')
              // Same rule as a list row: finding a stop opens its card, and
              // the URL is what says which card is open.
              navigate(`/route/${route.id}/stop/${id}`)
            }}
            onAddSuggestion={(suggestion) => {
              addSuggestion(suggestion)
              // Clearing the field but staying in search is deliberate: adding
              // stops is a repeated action, and a driver entering a round types
              // several in a row. Closing after each one would cost a tap per
              // stop to get back.
              setSearchQuery('')
            }}
            onTile={(tile) => {
              if (tile === 'paste') void addFromClipboard()
              if (tile === 'scan') setScannerOpen(true)
              if (tile === 'map') {
                // Get out of the way first: the pin flow is about looking at
                // the map, and a sheet at `full` covers all of it.
                setSearchOpen(false)
                setSearchQuery('')
                setSnap('collapsed')
                setAddByPinOpen(true)
              }
            }}
          />
        ) : route.stops.length === 0 ? (
          /*
            An empty route gets the empty state instead of a list of one
            header, one break row, a start and an end — which is what
            `buildRouteRows` produces for zero stops, and which reads as a
            broken list rather than a new route.
          */
          <EmptyRouteState
            canCopy={copySources.length > 0}
            onAddStops={() => {
              setSnap('full')
              setSearchOpen(true)
            }}
            onCopyFromPast={() => setCopyOpen(true)}
            onImportFile={() => setImportOpen(true)}
          />
        ) : (
          <RouteList
            route={route}
            rows={rows}
            scrollElementRef={listRef}
            scrollToIndexRef={scrollToIndexRef}
          />
        )}
      </div>

      {/*
        Jump to the next stop.

        On a 44-row list — let alone 300 — finding where you are means
        scrolling and reading, and a driver does that at a kerb with the engine
        running. It sits outside the scroll container, so a control whose job is
        "take me back to the position I lost" cannot itself scroll away.

        ── Why it is portalled ────────────────────────────────────────────────
        The sheet is positioned with a `transform`, and a transformed ancestor
        becomes the containing block for `position: fixed` as well as
        `absolute`. Left inside, this button would anchor to the sheet — whose
        bottom edge is a full viewport below the screen at every detent except
        `full` — and be invisible at exactly the detents it is for. Through the
        body it anchors to the viewport, which is what "bottom-right of the
        list" means.
      */}
      {/*
        Discard and Apply. Inside the sheet rather than portalled, unlike the
        jump FAB: at `full` the sheet's own bottom edge IS the bottom of the
        screen, and the bar has to move with the sheet if it is ever dragged.
      */}
      {reviewing && (
        <ReviewBottomBar
          count={changes}
          busy={provisional.computing}
          onDiscard={() => {
            clearPending()
            navigate(`/route/${route.id}`, { replace: true })
          }}
          onApply={() => setApplyOpen(true)}
        />
      )}

      {scrollable &&
        !carouselOpen &&
        !reviewing &&
        nextIndex !== null &&
        createPortal(
          <button
            type="button"
            onClick={() => scrollToIndexRef.current?.(nextIndex)}
            aria-label="Jump to the next stop"
            data-testid="jump-fab"
            className="fixed bottom-6 right-4 z-[1550] flex h-touch w-touch items-center justify-center rounded-pill border border-outline bg-surface text-on-surface shadow-md active:bg-surface-variant md:hidden"
          >
            <ChevronDownIcon className="h-6 w-6" />
          </button>,
          document.body,
        )}

      <CopyStopsSheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        routes={copySources}
        destinationRouteId={route.id}
        onCopy={(copied) => addStops(copied)}
      />

      <ImportStopsSheet open={importOpen} onClose={() => setImportOpen(false)} />

      {/*
        Scan a parcel, land on its stop.

        The match runs against the STAGED route rather than the committed one,
        so a stop added a moment ago and not yet applied is still findable —
        a driver who has just scanned a box in should be able to scan it again
        and be taken to it.
      */}
      <ScannerSheet
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Scan a parcel"
        hint="Point at the label to find its stop"
        onScan={(result) => {
          setScannerOpen(false)
          const match = matchScan(result.text, view.stops)
          if (match.kind === 'stop') {
            setSearchOpen(false)
            setSearchQuery('')
            navigate(`/route/${route.id}/stop/${match.stopId}`)
            return
          }
          if (match.kind === 'coordinates') {
            // A barcode that names a place, which is what a job-sheet QR does.
            addStops([match.point])
            return
          }
          setScanQuestion(match)
        }}
      />

      <ScanMatchSheet
        open={scanQuestion !== null}
        onClose={() => setScanQuestion(null)}
        text={scanQuestion && 'text' in scanQuestion ? scanQuestion.text : ''}
        candidates={
          scanQuestion?.kind === 'ambiguous'
            ? scanQuestion.stopIds
                .map((id) => view.stops.find((s) => s.id === id))
                .filter((s) => s !== undefined)
            : []
        }
        onPickStop={(stopId) => {
          setSearchOpen(false)
          setSearchQuery('')
          navigate(`/route/${route.id}/stop/${stopId}`)
        }}
        onSearch={(text) => {
          setSearchOpen(true)
          setSearchQuery(text)
        }}
      />

      {/* The route's own menu. The overflow button used to open the legacy
          setup panel directly; that panel is now one item inside this —
          "Reoptimise route…" — which is where it belongs. */}
      <RouteMenuSheet open={menuOpen} route={route} onClose={() => setMenuOpen(false)} />

      {/* The commit sheet: two models, fourteen words of consequence. */}
      <ApplyChangesSheet
        open={applyOpen}
        route={route}
        count={changes}
        onClose={() => setApplyOpen(false)}
        onDone={() => {
          setApplyOpen(false)
          navigate(`/route/${route.id}`, { replace: true })
        }}
      />
    </aside>
  )
}

function restingTransform(
  el: HTMLElement | null,
  offsets: SnapOffsets,
  snap: SheetSnap,
): void {
  if (!el) return
  el.style.transition = `transform ${settleMs()}ms ${EASE}`
  el.style.transform = `translateY(${offsets[snap]}px)`
}

/** Honours the OS setting: a sheet that animates for someone who asked it not to is a bug. */
function settleMs(): number {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : SETTLE_MS
}

function readViewportHeight(): number {
  if (typeof window === 'undefined') return 844
  return Math.round(window.visualViewport?.height ?? window.innerHeight)
}
