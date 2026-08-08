import type { ReviewRow, ReviewStopRow } from '../../lib/reviewList'
import { GROUP_COLORS, type GroupColorName } from '../../lib/map/palette'
import { IdChip } from '../ui/IdChip'
import { GroupDot } from '../ui/GroupDot'
import { CoffeeIcon, FlagIcon, HouseIcon, TrashIcon, UndoIcon } from '../ui/icons'
import { GUTTER_CLASS, TimelineSegment } from '../sheet/Timeline'

/**
 * The diff, in the domain's own language.
 *
 * ── Three sections, and the third is why the screen exists ────────────────
 *
 * What you are adding, what you are dropping, and what that does to the rest
 * of the day. A diff that stopped after the first two would leave the driver
 * to do the arithmetic, and the arithmetic — "does this still get me home by
 * six" — is the actual question.
 *
 * ── Two treatments, each carrying exactly one meaning ─────────────────────
 *
 * An ADDED row leads with a grey dot: it is not in the sequence yet, so it has
 * no number to show, and a hollow marker is what "not yet" looks like. It ends
 * with the group-colour control, because choosing a run is the one thing a
 * driver does to a stop the moment they add it.
 *
 * A REMOVED row keeps its sequence number and its ETA and tints its ID chip
 * red. Keeping the number is not decoration: that number is the position the
 * parcels are sorted in, and a removal that renumbered the round on the spot
 * would destroy the sort before the driver had agreed to anything.
 *
 * Both are reversible from the row itself. A review screen you can only accept
 * or abandon wholesale makes "Discard" the only way to fix one mistaken tap.
 */
export interface ReviewChangesProps {
  rows: ReviewRow[]
  /** Take one change back without discarding the rest. */
  onUndo: (changeId: string) => void
  onSelectStop: (stopId: string) => void
  /** Assign the added stop a run colour. */
  onRecolour: (stopId: string, color: GroupColorName) => void
  /**
   * The plan is being read long after it was made, so every time on the screen
   * has been re-anchored to now. See `planIsStale`.
   */
  fromNow?: boolean
}

export function ReviewChanges({
  rows,
  onUndo,
  onSelectStop,
  onRecolour,
  fromNow,
}: ReviewChangesProps) {
  return (
    <div data-testid="review-list" className="pb-4">
      {/*
        One line, and only when it is needed.

        A stale route poked at 19:23 shows a finish of 19:56, which is correct
        and looks broken. Saying where the clock is anchored costs a line and
        removes the whole doubt — the same pattern as the start row's "Used GPS
        position when optimising".
      */}
      {fromNow && (
        <p
          data-testid="from-now-hint"
          className="px-4 pb-1 pt-3 text-meta text-on-surface-variant"
        >
          Times are counted from now, not from when the route was planned.
        </p>
      )}
      {rows.map((row) => {
        switch (row.kind) {
          case 'section':
            return <SectionHeader key={row.id} title={row.title} count={row.count} />
          case 'added':
            return (
              <AddedRow
                key={row.id}
                row={row}
                onUndo={() => onUndo(row.changeId)}
                onSelect={() => onSelectStop(row.stop.id)}
                onRecolour={(color) => onRecolour(row.stop.id, color)}
              />
            )
          case 'removed':
            return (
              <RemovedRow
                key={row.id}
                row={row}
                onUndo={() => onUndo(row.changeId)}
                onSelect={() => onSelectStop(row.stop.id)}
              />
            )
          case 'break':
            return <BreakLine key={row.id} label={row.label} planned={row.planned} />
          case 'start':
            return <StartLine key={row.id} subtitle={row.subtitle} hasAnchor={row.hasAnchor} />
          case 'existing':
            return (
              <ExistingRow
                key={row.id}
                row={row}
                edited={row.edited}
                added={row.added}
                onSelect={() => onSelectStop(row.stop.id)}
              />
            )
          case 'end':
            return <EndLine key={row.id} hasAnchor={row.hasAnchor} />
        }
      })}
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <h3
      data-testid="review-section"
      className="sticky top-0 z-10 flex items-baseline gap-2 bg-surface px-4 pb-1 pt-4 text-label font-semibold uppercase tracking-wide text-on-surface-variant"
    >
      {title}
      <span className="font-normal tabular-nums">{count}</span>
    </h3>
  )
}

/**
 * Added: a grey leading dot where the number would be, and the run colour on
 * the trailing edge.
 *
 * The dot is hollow rather than filled because the stop is not in the sequence
 * yet. Giving it a provisional number here would put two different numbers for
 * the same stop on one screen — this one, and the position on the row below.
 */
function AddedRow({
  row,
  onUndo,
  onSelect,
  onRecolour,
}: {
  row: ReviewStopRow
  onUndo: () => void
  onSelect: () => void
  onRecolour: (color: GroupColorName) => void
}) {
  return (
    <div
      className="flex min-h-row items-stretch gap-3 pr-2"
      data-testid="review-added"
      data-stop-id={row.stop.id}
    >
      <div className={GUTTER_CLASS}>
        <div className="flex flex-col items-center justify-center py-3">
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-pill border-2 border-outline bg-surface"
          />
          {row.eta && (
            <span className="mt-1 text-meta tabular-nums text-on-surface-variant">{row.eta}</span>
          )}
        </div>
      </div>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 py-3 text-left">
        <span className="line-clamp-2 block text-row font-medium text-on-surface">{row.title}</span>
        {row.subtitle && (
          <span className="block truncate text-body text-on-surface-variant">{row.subtitle}</span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1 py-3">
        <IdChip stopId={row.stop.stopId} color={row.color} variant="pastel" />
        <ColourControl value={row.color} onChange={onRecolour} />
        <UndoButton label={`Do not add ${row.title}`} onClick={onUndo} />
      </div>
    </div>
  )
}

/**
 * Removed: the number and the time it still has, and a red chip.
 *
 * The row is struck through in the title only — not the number and not the
 * time. Those two are what the driver is checking against the parcels in the
 * van, and a line drawn through them makes them harder to read at exactly the
 * moment they matter most.
 */
function RemovedRow({
  row,
  onUndo,
  onSelect,
}: {
  row: ReviewStopRow
  onUndo: () => void
  onSelect: () => void
}) {
  return (
    <div
      className="flex min-h-row items-stretch gap-3 pr-2"
      data-testid="review-removed"
      data-stop-id={row.stop.id}
    >
      <div className={GUTTER_CLASS}>
        <div className="flex flex-col items-center justify-center py-3">
          <span className="text-label font-semibold tabular-nums text-on-surface-variant">
            {row.seq}
          </span>
          {row.eta && (
            <span className="mt-0.5 text-meta tabular-nums text-on-surface-variant">{row.eta}</span>
          )}
        </div>
      </div>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 py-3 text-left">
        <span className="line-clamp-2 block text-row font-medium text-on-surface-variant line-through">
          {row.title}
        </span>
        {row.subtitle && (
          <span className="block truncate text-body text-on-surface-variant">{row.subtitle}</span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1 py-3">
        {/*
          The red chip is not a status. It is an unsaved edit previewing a
          destruction, which is what red means under the semantic colour rule —
          the same axis `lib/map/chipSpec.ts` puts the map's trash chip on.
        */}
        <span
          data-testid="removed-id-chip"
          className="inline-flex min-w-9 items-center justify-center gap-1 rounded-row bg-danger-container px-1.5 py-1 text-label font-bold tabular-nums text-on-danger-container"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          {row.stop.stopId}
        </span>
        <UndoButton label={`Keep ${row.title}`} onClick={onUndo} />
      </div>
    </div>
  )
}

/**
 * An existing stop, with the ETA the change would give it.
 *
 * A staged ADD appears here too, in the position the preview gives it, marked
 * rather than listed apart. That is what keeps the numbering continuous: the
 * first version left them out and produced 1, 2, 4, 5 with a hole where the
 * new stop goes, which reads as a rendering bug rather than as information.
 */
function ExistingRow({
  row,
  edited,
  added,
  onSelect,
}: {
  row: ReviewStopRow
  edited: boolean
  added: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid="review-existing"
      data-stop-id={row.stop.id}
      data-edited={edited}
      data-added={added}
      className={`flex min-h-row w-full items-stretch gap-3 pr-4 text-left active:bg-surface-variant ${
        added ? 'bg-primary-container/40' : ''
      }`}
    >
      <div className={GUTTER_CLASS}>
        <TimelineSegment variant="full" />
        <div className="relative flex flex-col items-center justify-center py-3">
          <span
            className={`rounded-sm px-1 text-label font-semibold tabular-nums ${
              added
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface-variant'
            }`}
          >
            {row.seq}
          </span>
          {row.eta && (
            <span className="mt-0.5 rounded-sm bg-surface px-1 text-meta tabular-nums text-on-surface-variant">
              {row.eta}
            </span>
          )}
        </div>
      </div>

      <span className="min-w-0 flex-1 py-3">
        <span className="line-clamp-2 block text-row font-medium text-on-surface">{row.title}</span>
        {row.subtitle && (
          <span className="block truncate text-body text-on-surface-variant">{row.subtitle}</span>
        )}
        {edited && (
          <span className="mt-1 inline-flex items-center rounded-pill bg-surface-variant px-2 py-0.5 text-meta font-medium text-on-surface-variant">
            Edited
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center py-3">
        <IdChip stopId={row.stop.stopId} color={row.color} variant="pastel" />
      </span>
    </button>
  )
}

function BreakLine({ label, planned }: { label: string; planned: boolean }) {
  return (
    <div className="flex min-h-touch items-center gap-3 px-4 py-2" data-testid="review-break">
      <CoffeeIcon
        className={`ml-4 h-4 w-4 shrink-0 ${planned ? 'text-on-surface-variant' : 'text-outline'}`}
      />
      <span className="min-w-0 flex-1 truncate text-body text-on-surface-variant">{label}</span>
    </div>
  )
}

function StartLine({ subtitle, hasAnchor }: { subtitle: string; hasAnchor: boolean }) {
  return (
    <div className="flex min-h-row items-stretch gap-3 pr-4" data-testid="review-start">
      <div className={GUTTER_CLASS}>
        <TimelineSegment variant="bottom" />
        <div className="relative flex items-center justify-center py-3">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-pill bg-primary-container"
          >
            <HouseIcon className="h-3 w-3 text-primary" />
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 py-3">
        <div className="truncate text-row font-medium text-on-surface">Start location</div>
        <div className={`truncate text-body ${hasAnchor ? 'text-on-surface-variant' : 'text-danger'}`}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function EndLine({ hasAnchor }: { hasAnchor: boolean }) {
  return (
    <div className="flex min-h-row items-stretch gap-3 bg-surface-variant pr-4" data-testid="review-end">
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
    </div>
  )
}

/**
 * The group-colour control on an added row.
 *
 * A `<select>` rather than a chip row: this sits at the end of a 44dp row on a
 * 360dp screen and six tappable swatches do not fit beside a title, an ID chip
 * and an undo. The native picker is also the only one that is guaranteed
 * reachable by a switch user without any work from us.
 */
function ColourControl({
  value,
  onChange,
}: {
  value: GroupColorName
  onChange: (color: GroupColorName) => void
}) {
  return (
    <label className="relative flex h-touch w-8 shrink-0 items-center justify-center">
      <span className="sr-only">Run colour</span>
      <GroupDot color={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GroupColorName)}
        data-testid="review-colour"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {(Object.keys(GROUP_COLORS) as GroupColorName[]).map((name) => (
          <option key={name} value={name}>
            {name[0].toUpperCase() + name.slice(1)}
          </option>
        ))}
      </select>
    </label>
  )
}

function UndoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid="review-undo"
      className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
    >
      <UndoIcon className="h-5 w-5" />
    </button>
  )
}
