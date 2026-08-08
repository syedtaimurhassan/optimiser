import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * A horizontal drag that lives inside a vertically draggable sheet.
 *
 * Two consumers: the stop carousel's pages and the list rows' swipe-to-complete.
 * Both sit inside `RouteSheet`, which is itself dragged vertically and contains
 * a list that scrolls vertically — so on any given gesture there are three
 * candidates for the same finger.
 *
 * ── Why this listens on `window`, in the capture phase ────────────────────
 *
 * The obvious implementation — React `onPointerMove` on our own element, and
 * `stopPropagation` once the gesture is ours — does not work here, and the
 * reason is worth writing down because it is invisible until you try it.
 *
 * `RouteSheet` calls `setPointerCapture` on the sheet element in its
 * `pointerdown`, before it knows what kind of gesture this is — and it has to,
 * because dragging the sheet open moves the finger off the top of the sheet's
 * own box, and without capture the moves simply stop arriving. But pointer
 * capture RETARGETS every subsequent pointer event to the capturing element.
 * From that moment on, `pointermove` is dispatched at the sheet and travels
 * only through the sheet's ancestors — it never reaches a card nested inside
 * it. Our React handler is never called at all, so there is nothing to stop
 * propagating. The card sits perfectly still while the sheet quietly decides
 * the gesture was vertical.
 *
 * Capture retargets; it does not stop the event traversing the tree from the
 * top. So we listen on `window` in the CAPTURE phase, which runs before React's
 * root-container listener whatever the target is. Once the gesture is ours we
 * `stopPropagation` there, and React dispatches nothing — which is what keeps
 * the sheet from also acting on it: its handler never runs, its drag stays
 * undecided, and it moves nothing.
 *
 * `pointerup` is deliberately NOT stopped. The sheet holds its drag in a ref
 * and clears it in that handler; swallowing the release would leak a drag that
 * never ends, and every later touch on the sheet would be ignored.
 *
 * ── Why the offset never enters React state ───────────────────────────────
 *
 * Same reason as the sheet: a move writing to state re-renders the subtree up
 * to 120 times a second. `onMove` is handed the raw offset and is expected to
 * write it straight to a transform.
 */

/** Movement before a gesture is classified. Below this it is still a tap. */
const SLOP_PX = 6

export interface DragEnd {
  /** Total horizontal travel, px. Negative is leftward. */
  dx: number
  /** px/ms from the last sample only, signed like `dx`. */
  velocity: number
}

export interface HorizontalDragOptions {
  /** Called on every move once the gesture is ours. Write to a transform. */
  onMove: (dx: number) => void
  /** Called once, when the finger lifts, if the gesture was ever ours. */
  onEnd: (end: DragEnd) => void
  /** Called when the gesture is claimed — for arming a haptic, hiding a hint. */
  onClaim?: () => void
  enabled?: boolean
}

export interface HorizontalDragHandlers {
  onPointerDown: (e: ReactPointerEvent) => void
}

interface Drag {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastT: number
  velocity: number
  mode: 'undecided' | 'ours' | 'theirs'
}

export function useHorizontalDrag({
  onMove,
  onEnd,
  onClaim,
  enabled = true,
}: HorizontalDragOptions): HorizontalDragHandlers {
  const dragRef = useRef<Drag | null>(null)

  // The handler is registered once per element; the callbacks it closes over
  // change on every render. A ref keeps it stable without it ever calling a
  // stale callback.
  const callbacks = useRef({ onMove, onEnd, onClaim })
  callbacks.current = { onMove, onEnd, onClaim }
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  /** Detach the window listeners. Held in a ref so both ends can call it. */
  const teardownRef = useRef<(() => void) | null>(null)

  // A gesture in flight when the card unmounts — which is exactly what a
  // committed swipe does to the outgoing page — must not leave listeners on
  // the window for a pointer nobody is watching any more.
  useEffect(() => () => teardownRef.current?.(), [])

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (!enabledRef.current || e.button !== 0 || dragRef.current) return

    // A tap on a control INSIDE the drag surface is that control's. Claiming it
    // would mean a button that needs a perfectly still finger to activate.
    //
    // `!== e.currentTarget` is load-bearing: a list row is itself a
    // `role="button"` (it has to be — the whole row is the tap target and it
    // carries its own trailing controls), so a bare `closest` matched the drag
    // surface itself and declined every swipe on the list.
    const control = (e.target as HTMLElement).closest(
      'button, input, a, textarea, select, [role="button"]',
    )
    if (control && control !== e.currentTarget) return

    const drag: Drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocity: 0,
      mode: 'undecided',
    }
    dragRef.current = drag

    const teardown = () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      teardownRef.current = null
      dragRef.current = null
    }

    function move(event: PointerEvent): void {
      if (event.pointerId !== drag.pointerId) return

      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY

      if (drag.mode === 'undecided') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP_PX) return
        drag.mode = Math.abs(dx) > Math.abs(dy) ? 'ours' : 'theirs'
        // Not ours, and it never will be — classify once, never reclassify.
        // Detaching now also means the sheet's gesture costs nothing extra.
        if (drag.mode === 'theirs') {
          teardown()
          return
        }
        callbacks.current.onClaim?.()
      }

      // Velocity from the last sample only. An average over the gesture
      // reports a slow drag ending in a flick as slow, and the flick is the
      // whole signal.
      const dt = event.timeStamp - drag.lastT
      if (dt > 0) drag.velocity = (event.clientX - drag.lastX) / dt
      drag.lastX = event.clientX
      drag.lastT = event.timeStamp

      event.stopPropagation()
      callbacks.current.onMove(dx)
    }

    function up(event: PointerEvent): void {
      if (event.pointerId !== drag.pointerId) return
      const claimed = drag.mode === 'ours'
      const dx = event.clientX - drag.startX
      const velocity = drag.velocity
      // Deliberately not stopped — see the note above about the sheet's ref.
      teardown()
      if (claimed) callbacks.current.onEnd({ dx, velocity })
    }

    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    teardownRef.current = teardown
  }, [])

  return { onPointerDown }
}
