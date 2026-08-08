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
import { selectActiveRoute, useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { ChevronDownIcon } from '../ui/icons'
import { SheetHeader } from './SheetHeader'
import { RouteList } from './RouteList'

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

export function RouteSheet() {
  const route = useRoutesStore(selectActiveRoute)
  const snap = useUiStore((s) => s.sheetSnap)
  const setSnap = useUiStore((s) => s.setSheetSnap)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)
  const searchQuery = useUiStore((s) => s.searchQuery)
  const setSearchQuery = useUiStore((s) => s.setSearchQuery)
  const setSetupOpen = useUiStore((s) => s.setSetupOpen)

  const sheetRef = useRef<HTMLElement>(null)
  const headerBlockRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** Set by RouteList; called by the jump FAB, which lives outside the scroller. */
  const scrollToIndexRef = useRef<((index: number) => void) | null>(null)

  // The rows are built HERE rather than inside the list because two things
  // need them: the list renders them, and the jump FAB needs to know whether
  // there is a next stop to jump to. Building them twice would be building
  // 300 rows twice.
  const rows = useMemo(() => (route ? buildRouteRows({ route }) : []), [route])
  const nextIndex = useMemo(() => nextStopRowIndex(rows), [rows])

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
      if (Math.abs(dy) < SLOP_PX) return
      const list = listRef.current
      const atTop = (list?.scrollTop ?? 0) <= 0
      drag.mode = !listScrolls(snapRef.current) || (atTop && dy > 0) ? 'sheet' : 'list'

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

  if (!route) return null

  const scrollable = listScrolls(snap)

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

        <SheetHeader
          snap={snap}
          routeName={route.name}
          stops={route.stops}
          optimized={route.optimized}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
          onSearchFocus={() => setSnap('full')}
          onSearchTap={() => setSnap('full')}
          onMenu={() => setDrawerOpen(true)}
          onOverflow={() => setSetupOpen(true)}
        />
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
        <RouteList
          route={route}
          rows={rows}
          scrollElementRef={listRef}
          scrollToIndexRef={scrollToIndexRef}
        />
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
      {scrollable &&
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
