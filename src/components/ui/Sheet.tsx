import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from './useScrollLock'

/** How long the enter/exit transition runs. Must match the duration classes below. */
const EXIT_MS = 220

/** The 24dp-radius sheet's drag affordance. Purely visual; the sheet is
 *  dismissed by the scrim, Escape, or a close control. */
export function GrabHandle() {
  return <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-pill bg-outline" />
}

export interface SheetProps {
  open: boolean
  onClose: () => void
  /**
   * `bottom` is the classic sheet, `left` the side sheet the routes drawer
   * uses, and `full` a full-screen modal — which is a sheet in every way that
   * matters here (it slides up, it traps focus, it is dismissed rather than
   * navigated back from) and would otherwise be a second copy of all of it.
   */
  side?: 'bottom' | 'left' | 'full'
  /** Accessible name — this is a dialog, so it must have one. */
  label: string
  /** Bottom sheets get a grab handle. Side sheets don't (nothing drags sideways). */
  handle?: boolean
  /** Stacking order. Sheets stack, so the caller decides who is on top. */
  zIndex?: number
  className?: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A modal sheet: scrim, panel, focus trap, Escape, scroll lock.
 *
 * Rendered through a portal into `document.body`. Without it the panel is a
 * child of the route screen, whose mobile sheet already uses a transform —
 * and a transformed ancestor makes `position: fixed` resolve against that
 * ancestor instead of the viewport, which silently mispositions the drawer on
 * exactly the devices it matters on.
 *
 * The scrim is the full viewport, so on a side sheet the visible strip of the
 * screen underneath IS the scrim: tapping it dismisses, which is the gesture
 * the design asks for and costs nothing extra.
 */
export function Sheet({
  open,
  onClose,
  side = 'bottom',
  label,
  handle = side === 'bottom',
  zIndex = 2000,
  className = '',
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  // `mounted` keeps the panel in the DOM through its exit transition; `shown`
  // drives the transition itself. Both are needed: unmounting on close would
  // make the sheet vanish rather than slide away.
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useScrollLock(mounted)

  useEffect(() => {
    if (open) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null
      setMounted(true)
      // One frame with the closed transform applied, so the browser has
      // something to transition FROM.
      const id = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const id = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(id)
  }, [open])

  // Move focus into the sheet when it opens, and put it back where it came
  // from when it closes — otherwise a keyboard or screen-reader user is left
  // at the top of the document every time they dismiss.
  useEffect(() => {
    if (!shown) return
    panelRef.current?.focus()
    return () => {
      restoreFocusTo.current?.focus?.()
    }
  }, [shown])

  if (!mounted) return null

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    // Focus trap: a modal that lets Tab wander into the page behind it isn't modal.
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const panelPosition = {
    bottom: 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-sheet',
    // ~90% wide, so a strip of the screen underneath stays visible and
    // tappable. Capped on desktop: 90% of a 1440px window is not a sheet.
    left: 'inset-y-0 left-0 w-[90%] max-w-sm rounded-r-sheet',
    full: 'inset-0',
  }[side]

  const closedTransform = side === 'left' ? '-translate-x-full' : 'translate-y-full'

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      <button
        type="button"
        aria-label={`Close ${label}`}
        onClick={onClose}
        style={{ background: 'var(--scrim)' }}
        className={`absolute inset-0 h-full w-full cursor-default transition-opacity duration-200 motion-reduce:transition-none ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`absolute flex flex-col bg-surface shadow-2xl outline-none transition-transform duration-200 ease-out motion-reduce:transition-none ${panelPosition} ${
          shown ? 'translate-x-0 translate-y-0' : closedTransform
        } ${className}`}
      >
        {handle && <GrabHandle />}
        {children}
      </div>
    </div>,
    document.body,
  )
}
