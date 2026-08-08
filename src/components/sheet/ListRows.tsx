import { Chip } from '../ui/Chip'
import { FullWidthButton } from '../ui/FullWidthButton'
import { CheckIcon, CoffeeIcon, FlagIcon, HouseIcon, ShareIcon, TruckIcon } from '../ui/icons'
import { TimelineSegment, GUTTER_CLASS } from './Timeline'

/**
 * The rows that are not stops: the title block, the break, the two endpoints
 * and the footer action.
 *
 * They live in the same virtual list as the stop rows — see the note in
 * `lib/routeList.ts` for why — so each one is a plain row component here.
 */

/** Route name, then the two route-level actions. */
export function HeaderRow({ title }: { title: string }) {
  return (
    <div className="px-4 pb-3 pt-2">
      <h1 className="text-route-title font-normal text-on-surface">{title}</h1>

      {/*
        Two equal-width chips, side by side. Equal width because neither is
        more important than the other; if one were, it would not be a chip.

        Both are announced and unavailable rather than hidden: a driver who has
        heard the app can share a live route should be able to see where it
        will be. M6+ wires them.
      */}
      <div className="mt-3 flex items-stretch gap-2">
        <Chip
          tone="outlined"
          disabled
          className="flex-1 justify-center gap-2 py-2"
        >
          <ShareIcon className="h-4 w-4" />
          Share live route
        </Chip>
        <Chip tone="outlined" disabled className="flex-1 justify-center gap-2 py-2">
          <TruckIcon className="h-4 w-4" />
          Load vehicle
        </Chip>
      </div>
    </div>
  )
}

/**
 * The break.
 *
 * Above the start location, because a break is a property of the ROUTE — a
 * constraint the optimiser has to fit into the day — not something that
 * happens at a stop. Placed among the stops it would read as one.
 */
export function BreakRow({
  label,
  planned,
  onPlan,
}: {
  label: string
  planned: boolean
  onPlan: () => void
}) {
  return (
    <div className="flex min-h-touch items-center gap-3 px-4 py-2" data-testid="break-row">
      <span
        aria-hidden="true"
        className={`ml-5 h-2 w-2 shrink-0 rounded-pill ${planned ? 'bg-on-surface-variant' : 'bg-outline'}`}
      />
      <span className="min-w-0 flex-1 truncate text-body text-on-surface-variant">{label}</span>
      <button
        type="button"
        onClick={onPlan}
        aria-label={planned ? 'Edit break' : 'Plan a break'}
        data-testid="break-action"
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
      >
        <CoffeeIcon className="h-5 w-5" />
      </button>
    </div>
  )
}

/**
 * The start location.
 *
 * ── The subtitle is the point of this row ─────────────────────────────────
 *
 * "Used GPS position when optimising" pre-empts the question every driver asks
 * exactly once and never forgets: why does my route start HERE? Saying where
 * the anchor came from costs one line and removes the doubt entirely. The same
 * pattern belongs anywhere the app decided something on the driver's behalf.
 */
export function StartRow({
  time,
  subtitle,
  hasAnchor,
  onSetHome,
}: {
  time: string | null
  subtitle: string
  hasAnchor: boolean
  onSetHome: () => void
}) {
  return (
    <div className="flex min-h-row items-stretch gap-3 pr-4" data-testid="start-row">
      <div className={GUTTER_CLASS}>
        <TimelineSegment variant="bottom" />
        <div className="relative flex flex-col items-center justify-center py-3">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-pill bg-primary-container"
          >
            <span className="h-2 w-2 rounded-pill bg-primary" />
          </span>
          {time && (
            <span className="mt-0.5 rounded-sm bg-surface px-1 text-meta tabular-nums text-on-surface-variant">
              {time}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 py-3">
        <div className="truncate text-row font-medium text-on-surface">Start location</div>
        <div className={`truncate text-body ${hasAnchor ? 'text-on-surface-variant' : 'text-danger'}`}>
          {subtitle}
        </div>
      </div>

      <div className="flex shrink-0 items-center py-3">
        <button
          type="button"
          onClick={onSetHome}
          aria-label="Set start location"
          data-testid="start-action"
          className="flex h-touch w-touch items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
        >
          <HouseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

/**
 * The end location — and it deliberately BREAKS the row grammar.
 *
 * No sequence number, a flag instead of an id chip, and a tinted background.
 * Every one of those is a small violation of the pattern the 44 rows above it
 * follow, and that is precisely why the row reads as a terminus rather than as
 * stop number 45. Consistency is a tool; the exception is the message.
 */
export function EndRow({
  time,
  hasAnchor,
  onSetEnd,
}: {
  time: string | null
  hasAnchor: boolean
  onSetEnd: () => void
}) {
  return (
    <div
      className="flex min-h-row items-stretch gap-3 bg-surface-variant pr-4"
      data-testid="end-row"
    >
      <div className={GUTTER_CLASS}>
        <TimelineSegment variant="top" />
        <div className="relative flex items-center justify-center py-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-pill bg-primary text-on-primary"
          >
            <FlagIcon className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 py-3">
        <div className="truncate text-row font-medium text-on-surface">End location</div>
        <div className="truncate text-body text-on-surface-variant">
          {hasAnchor ? 'Route finishes here' : 'Finishes at the last stop'}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 py-3">
        {time && (
          <span className="text-label tabular-nums text-on-surface-variant">{time}</span>
        )}
        <button
          type="button"
          onClick={onSetEnd}
          aria-label="Set end location"
          data-testid="end-action"
          className="flex h-touch w-touch items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
        >
          <FlagIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Outlined, not filled.
 *
 * This ends the day. It sits under a list the driver scrolls past all day
 * long, and a fat blue button there is an invitation to a mis-tap that undoes
 * a round. Outlined says "available" without saying "press me".
 */
export function FooterRow({ completed, onComplete }: { completed: boolean; onComplete: () => void }) {
  return (
    <div className="px-4 pb-8 pt-4">
      <FullWidthButton variant="outlined" onClick={onComplete} disabled={completed}>
        <CheckIcon className="h-5 w-5" />
        {completed ? 'Route completed' : 'Mark route as completed'}
      </FullWidthButton>
    </div>
  )
}
