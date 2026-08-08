import type { StopRowModel, RowTag } from '../../lib/routeList'
import { IdChip } from '../ui/IdChip'
import { StatusBadge } from '../ui/StatusBadge'
import { NoteIcon, PickupIcon, PinnedOrderIcon } from '../ui/icons'
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
 */
export interface StopRowProps {
  row: StopRowModel
  selected: boolean
  onSelect: (id: string) => void
}

export function StopRow({ row, selected, onSelect }: StopRowProps) {
  const { stop } = row
  const done = stop.status !== 'pending'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(stop.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(stop.id)
        }
      }}
      data-testid="stop-row"
      data-stop-id={stop.id}
      data-status={stop.status}
      aria-label={`Stop ${row.seq}, ${row.title}`}
      className={`relative flex min-h-row w-full cursor-pointer select-none items-stretch gap-3 pr-4 text-left ${
        selected ? 'bg-primary-container' : 'active:bg-surface-variant'
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
