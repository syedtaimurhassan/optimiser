import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { PAGE_SLIDE_MS, pageFor, resist } from '../../lib/pager'
import type { StopPage } from '../../lib/stopPages'
import { useHorizontalDrag } from '../../hooks/useHorizontalDrag'

/**
 * The paged stop carousel — the app's signature interaction.
 *
 * One page per stop, swiped horizontally inside the sheet, with the map camera
 * moving in lockstep behind it. The sheet does NOT collapse and re-expand
 * between pages: it is a fixed frame, and the cards move inside it.
 *
 * ── Three pages, always ───────────────────────────────────────────────────
 *
 * A round is 44 stops and can be 300. Only the current page and its two
 * neighbours are ever in the DOM. The current page is in NORMAL FLOW — it is
 * what gives the sheet's scroll container its height — and the neighbours are
 * absolutely positioned at ±100%, which is why they cost nothing to lay out
 * and why the container's height tracks the page you can actually see.
 *
 * ── Why there is no local index state ─────────────────────────────────────
 *
 * The URL owns the page. That sounds like it would cost a frame — release the
 * finger, wait for the hash to change, then animate — but wouter's hash
 * navigate dispatches `hashchange` SYNCHRONOUSLY, and `pointerup` is a
 * discrete event, so React flushes the re-render before paint. The animation
 * starts on the same frame the finger lifted.
 *
 * Holding a local index that "leads" the URL would be the usual answer and it
 * is a trap: two swipes in quick succession leave the echo and the URL
 * disagreeing, and the card visibly snaps back to a page the driver already
 * left.
 *
 * ── How the slide is animated ─────────────────────────────────────────────
 *
 * Not by animating the outgoing page out. On commit the NEW page is rendered
 * in flow, the track is instantly placed where the finger left it — expressed
 * in the new page's coordinates — and only then transitioned to zero. So the
 * card carries on from exactly where the thumb released it rather than jumping
 * and starting again, which is the difference between a carousel and a slide
 * show.
 */

const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

export interface StopCarouselProps {
  pages: StopPage[]
  /** Which page is showing. Resolved from the URL by the screen. */
  index: number
  /** Ask for a different page. The caller navigates; the URL comes back here. */
  onIndexChange: (index: number) => void
  renderPage: (page: StopPage) => ReactNode
}

export function StopCarousel({ pages, index, onIndexChange, renderPage }: StopCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  /** Page width in px. Measured, never assumed — the sheet is not the viewport. */
  const widthRef = useRef(0)
  /** Where the finger left the track, so the slide can carry on from there. */
  const offsetRef = useRef(0)
  /** The page we last rendered, to know which way the incoming one comes from. */
  const renderedRef = useRef<number | null>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => {
      widthRef.current = el.clientWidth
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /**
   * Animate whatever moved us — a swipe, the peek pill, a deep link, Back.
   *
   * All of them arrive here as a changed `index`, so they all animate
   * identically and there is exactly one place that knows how the slide looks.
   */
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const from = renderedRef.current
    renderedRef.current = index
    const offset = offsetRef.current
    offsetRef.current = 0

    // First paint, or a deep link landing straight on a page: no animation.
    // Sliding in from nowhere on cold load would be a lie about where we came
    // from.
    if (from === null || from === index) {
      track.style.transition = 'none'
      track.style.transform = 'translateX(0px)'
      return
    }

    const shift = (index - from) * widthRef.current
    track.style.transition = 'none'
    track.style.transform = `translateX(${offset + shift}px)`
    // Force the browser to accept that position before asking it to leave —
    // without this the two style writes coalesce and nothing animates.
    void track.offsetWidth
    track.style.transition = `transform ${slideMs()}ms ${EASE}`
    track.style.transform = 'translateX(0px)'
  }, [index])

  const onMove = useCallback(
    (dx: number) => {
      const applied = resist(dx, index, pages.length)
      offsetRef.current = applied
      const track = trackRef.current
      if (track) {
        track.style.transition = 'none'
        track.style.transform = `translateX(${applied}px)`
      }
    },
    [index, pages.length],
  )

  const onEnd = useCallback(
    ({ dx, velocity }: { dx: number; velocity: number }) => {
      const next = pageFor({
        index,
        // The RAW travel, not the resisted one: resistance is how the edge
        // feels, not what the gesture meant.
        dx,
        velocity,
        width: widthRef.current,
        count: pages.length,
      })

      if (next === index) {
        offsetRef.current = 0
        const track = trackRef.current
        if (track) {
          track.style.transition = `transform ${slideMs()}ms ${EASE}`
          track.style.transform = 'translateX(0px)'
        }
        return
      }
      // Leave `offsetRef` alone: the layout effect above needs it to know
      // where the finger let go.
      onIndexChange(next)
    },
    [index, pages.length, onIndexChange],
  )

  const handlers = useHorizontalDrag({ onMove, onEnd, enabled: pages.length > 1 })

  const current = pages[index]
  if (!current) return null
  const previous = index > 0 ? pages[index - 1] : null
  const next = index < pages.length - 1 ? pages[index + 1] : null

  return (
    <div
      ref={viewportRef}
      role="group"
      tabIndex={0}
      // Arrow keys, because a carousel that only answers to a thumb is
      // unreachable on a desktop browser and to a switch user.
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && next) {
          e.preventDefault()
          onIndexChange(index + 1)
        } else if (e.key === 'ArrowLeft' && previous) {
          e.preventDefault()
          onIndexChange(index - 1)
        }
      }}
      aria-label={`Stop detail, ${index + 1} of ${pages.length}. Arrow keys to move between stops.`}
      data-testid="stop-carousel"
      data-page-index={index}
      data-page-count={pages.length}
      // `pan-y` and not `none`: vertical scrolling still belongs to the sheet's
      // list container, and taking it here would make a tall card unreadable.
      style={{ touchAction: 'pan-y' }}
      className="relative overflow-hidden outline-none"
      {...handlers}
    >
      <div ref={trackRef} className="relative will-change-transform">
        <Page page={current} role="current">
          {renderPage(current)}
        </Page>

        {previous && (
          <Page page={previous} role="previous" className="-translate-x-full">
            {renderPage(previous)}
          </Page>
        )}
        {next && (
          <Page page={next} role="next" className="translate-x-full">
            {renderPage(next)}
          </Page>
        )}
      </div>
    </div>
  )
}

/**
 * One page.
 *
 * The neighbours are `inert` rather than merely `pointer-events-none`: they
 * are full cards with buttons in them, and a tab stop on a control that is
 * physically off-screen is worse than one that isn't there. It also stops a
 * screen reader reading three stops as if they were one.
 */
function Page({
  page,
  role,
  className = '',
  children,
}: {
  page: StopPage
  role: 'current' | 'previous' | 'next'
  className?: string
  children: ReactNode
}) {
  const off = role !== 'current'
  return (
    <div
      key={page.id}
      inert={off}
      aria-hidden={off || undefined}
      data-testid="carousel-page"
      data-page-id={page.id}
      data-page-role={role}
      className={off ? `absolute inset-x-0 top-0 ${className}` : className}
    >
      {children}
    </div>
  )
}

/** Honours the OS setting. A card that slides for someone who asked it not to is a bug. */
function slideMs(): number {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : PAGE_SLIDE_MS
}
