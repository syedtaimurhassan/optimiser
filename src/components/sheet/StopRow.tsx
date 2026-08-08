import { useCallback, useRef } from 'react'
import type { StopRowModel, RowTag } from '../../lib/routeList'
import { swipeOutcome, swipeState, type SwipeOutcome } from '../../lib/swipeAction'
import { hapticTap, hapticUndo } from '../../lib/device/haptics'
import { useHorizontalDrag } from '../../hooks/useHorizontalDrag'
import { IdChip } from '../ui/IdChip'
import { StatusBadge } from '../ui/StatusBadge'
import { CheckIcon, CloseIcon, NoteIcon, PickupIcon, PinnedOrderIcon, UndoIcon } from '../ui/icons'
import { TimelineSegment, GUTTER_CLASS } from './Timeline'

/**
 * The workhorse row. Four zones, left to right:
 *
 *   gutter   the route position over the ETA, at a FIXED width so every title
 *            in the list starts at the same x — a column of addresses that
 *            jogs left and right as the numbers gain a digit cannot be
 *            scanned, and scanning is the whole job
 *   main     address, area + postcode, optional tags, optional note
 *   id chip  the immutable label, pastel, in the group's colour
 *   badge    status — and only status
 *
 * ── The two colours never cross ───────────────────────────────────────────
 *
 * The chip is the GROUP. The badge is the STATUS. A failed stop in a green
 * group is a green chip with a red ✗, exactly as on the map — the rule lives
 * in `lib/map/chipSpec.ts` for the marker and is honoured here by construction,
 * because the two zones read different fields and share nothing.
 *
 * ── Swipe to complete ─────────────────────────────────────────────────────
 *
 * M7 makes the row draggable sideways: right for delivered, left for failed,
 * again to undo. `lib/swipeAction.ts` owns which is which and when it commits;
 * this owns the panel that appears behind the row.
 *
 * The row moves by transform on an INNER element, never on the row itself. The
 * list is virtualised and measures each row's height with a ResizeObserver, and
 * a transform on the measured element is exactly the kind of thing that makes a
 * virtualiser recompute the world sixty times a second while a thumb is down.
 */
export interface StopRowProps {
  row: StopRowModel
  selected: boolean
  onSelect: (id: string) => void
  /** Mark, or unmark, by gesture. Absent in contexts where that makes no sense. */
  onSwipe?: (id: string, outcome: SwipeOutcome) => void
}

export function StopRow({ row, selected, onSelect, onSwipe }: StopRowProps) {
  const { stop } = row
  const done = stop.status !== 'pending'

  const contentRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const dxRef = useRef(0)

  const paint = useCallback(
    (dx: number) => {
      dxRef.current = dx
      const content = contentRef.current
      const reveal = revealRef.current
      if (content) {
        content.style.transition = 'none'
        content.style.transform = `translateX(${dx}px)`
      }
      if (reveal) {
        const state = swipeState(dx, stop.status)
        reveal.dataset.side = state.side ?? 'none'
        // One attribute for the three opacity states rather than two that both
        // set opacity. Overlapping Tailwind variants have equal specificity and
        // resolve by the order the classes happen to land in the stylesheet,
        // which is not a thing to build a gesture's feedback on.
        reveal.dataset.reveal = state.side === null ? 'none' : state.armed ? 'armed' : 'hint'
        reveal.dataset.undo = String(state.undo)
      }
    },
    [stop.status],
  )

  const settle = useCallback(() => {
    dxRef.current = 0
    const content = contentRef.current
    if (content) {
      content.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)'
      content.style.transform = 'translateX(0px)'
    }
    const reveal = revealRef.current
    if (reveal) {
      reveal.dataset.side = 'none'
      reveal.dataset.reveal = 'none'
    }
  }, [])

  const handlers = useHorizontalDrag({
    enabled: Boolean(onSwipe),
    onMove: paint,
    onEnd: ({ dx, velocity }) => {
      const outcome = swipeOutcome({ dx, velocity, status: stop.status })
      // Always springs back. The row does not stay pushed aside waiting for a
      // second confirmation — the badge appearing IS the confirmation, and a
      // row parked off-centre would be one more thing to tidy up.
      settle()
      if (outcome.kind === 'none') return
      if (outcome.kind === 'undo') hapticUndo()
      else hapticTap()
      onSwipe?.(stop.id, outcome)
    },
  })

  return (
    <div className="relative overflow-hidden" data-testid="stop-row-wrap">
      {/*
        The panel behind the row. One element, not two: only one side is ever
        showing, and its colour and words are driven by data attributes written
        straight from the pointer handler — putting them in React state would
        re-render a virtualised list on every frame of a drag.
      */}
      <div
        ref={revealRef}
        aria-hidden="true"
        data-testid="swipe-reveal"
        data-side="none"
        data-reveal="none"
        data-undo="false"
        className={[
          'group pointer-events-none absolute inset-0 flex items-center justify-between px-5 text-white',
          'data-[side=delivered]:bg-success data-[side=failed]:bg-danger',
          // Until the row is far enough to commit the panel is muted, so the
          // colour arriving at full strength IS the "let go now" signal.
          'data-[reveal=none]:opacity-0 data-[reveal=hint]:opacity-40 data-[reveal=armed]:opacity-100',
        ].join(' ')}
      >
        <span className="flex items-center gap-2 text-label font-semibold group-data-[undo=true]:opacity-0">
          <CheckIcon className="h-5 w-5" />
          Delivered
        </span>
        <span className="flex items-center gap-2 text-label font-semibold group-data-[undo=true]:opacity-0">
          Failed
          <CloseIcon className="h-5 w-5" />
        </span>
        {/* Sits over both labels when the commit would take a status back. */}
        <span className="absolute inset-0 hidden items-center justify-center gap-2 text-label font-semibold group-data-[undo=true]:flex">
          <UndoIcon className="h-5 w-5" />
          Undo
        </span>
      </div>

      <div
        ref={contentRef}
        role="button"
        tabIndex={0}
        onClick={() => {
          // A tap that ended a swipe is not a tap. The drag hook stops
          // propagation while it owns the gesture, but the click that follows
          // a released drag is synthesised by the browser afterwards.
          if (Math.abs(dxRef.current) > 4) return
          onSelect(stop.id)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(stop.id)
          }
        }}
        {...handlers}
        data-testid="stop-row"
        data-stop-id={stop.id}
        data-status={stop.status}
        aria-label={`Stop ${row.seq}, ${row.title}`}
        // `pan-y` leaves vertical scrolling to the list and horizontal to us.
        style={{ touchAction: 'pan-y' }}
        className={`relative flex min-h-row w-full cursor-pointer select-none items-stretch gap-3 pr-4 text-left ${
          selected ? 'bg-primary-container' : 'bg-surface active:bg-surface-variant'
        }`}
      >
        <div className={GUTTER_CLASS}>
          <TimelineSegment variant="full" />
          {/*
            The number sits on the connector, so it needs the sheet's own
            background behind it — otherwise the line strikes through the digits.
            Delivered rows recede, but the number does not: it is how a driver
            finds the row they are looking for, done or not.
          */}
          <div className="relative flex flex-col items-center justify-center py-3">
            <span className="rounded-sm bg-surface px-1 text-label font-semibold tabular-nums text-on-surface-variant">
              {row.seq}
            </span>
            {row.eta && (
              <span className="mt-0.5 rounded-sm bg-surface px-1 text-meta tabular-nums text-on-surface-variant">
                {row.eta}
              </span>
            )}
          </div>
        </div>

        <div className={`min-w-0 flex-1 py-3 ${done ? 'opacity-55' : ''}`}>
          {/*
            Two lines, then ellipsis — never one. "Rundgården 34, st. th. Jette
            Kelbjørn" truncated at one line loses the recipient, which is the
            part that tells you which door.
          */}
          <div className="line-clamp-2 text-row font-medium text-on-surface">{row.title}</div>
          {row.subtitle && (
            <div className="truncate text-body text-on-surface-variant">{row.subtitle}</div>
          )}

          {row.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {row.tags.map((tag) => (
                <InlineTag key={tag} tag={tag} />
              ))}
            </div>
          )}

          {row.note && (
            <div className="mt-1 flex items-start gap-1.5 text-meta text-on-surface-variant">
              <NoteIcon className="mt-px h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{row.note}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 py-3">
          <IdChip stopId={stop.stopId} color={row.color} variant="pastel" />
          {/*
            Absent when pending, by design. A ring on every row would be 44
            identical marks to read past; the badge exists to say "this one is
            not like the others".
          */}
          {done && <StatusBadge status={stop.status} />}
        </div>
      </div>
    </div>
  )
}

const TAGS: Record<RowTag, { label: string; icon: typeof PickupIcon }> = {
  first: { label: 'First', icon: PinnedOrderIcon },
  last: { label: 'Last', icon: PinnedOrderIcon },
  pickup: { label: 'Pickup', icon: PickupIcon },
}

/**
 * An inline tag.
 *
 * Neutral, never coloured. These mark a stop as unusual, not as good or bad,
 * and the semantic colour rule reserves green and red for outcomes.
 */
function InlineTag({ tag }: { tag: RowTag }) {
  const { label, icon: Icon } = TAGS[tag]
  return (
    <span
      data-testid={`tag-${tag}`}
      className="inline-flex items-center gap-1 rounded-pill bg-surface-variant px-2 py-0.5 text-meta font-medium text-on-surface-variant"
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
