import { useState } from 'react'
import { Link } from 'wouter'
import {
  ActionRow3Up,
  Chip,
  ConfirmDialog,
  DemotedActionGroup,
  FullWidthButton,
  GroupDot,
  IdChip,
  ListRow,
  SegmentedControl,
  Sheet,
  StatusBadge,
  StatusPill,
  Stepper,
} from '../components/ui'
import {
  CalendarIcon,
  ChevronRightIcon,
  DuplicateIcon,
  MoreIcon,
  NavigateIcon,
  ParcelCheckIcon,
  ParcelCrossIcon,
  PencilIcon,
  PrinterIcon,
  ShareIcon,
  TrashIcon,
} from '../components/ui/icons'
import { CompletionCard } from '../components/stop/CompletionCard'
import { StopRow } from '../components/sheet/StopRow'
import type { StopRowModel } from '../lib/routeList'
import type { AddressedStop, StopStatus } from '../types'

/**
 * Dev/bench-only gallery of every primitive.
 *
 * M3 builds primitives that M4–M8 will use, so several of them (Stepper,
 * SegmentedControl, StatusPill, IdChip, ActionRow3Up) have no caller yet.
 * Shipping unexercised components is how a design system rots quietly, and
 * "it compiles" is not the same as "it is usable with a thumb". This screen
 * puts all of them on a real phone at #/__ui without adding a single byte to
 * production: the route is behind the same `__DEV_ROUTES__` compile-time
 * constant as /__crash, and `npm run bench:verify-seam` asserts it is gone.
 */
export default function UiGalleryScreen() {
  const [tone, setTone] = useState<'duration' | 'distance'>('duration')
  const [count, setCount] = useState(3)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] bg-surface-variant pb-12">
      <header className="flex items-center gap-3 bg-surface px-4 py-3">
        <Link href="/" className="min-h-touch text-body font-semibold text-primary">
          ← Back
        </Link>
        <h1 className="text-title font-semibold text-on-surface">Primitive gallery</h1>
      </header>

      <div className="space-y-6 p-4">
        <Section title="ListRow">
          <div className="overflow-hidden rounded-row bg-surface">
            <ListRow title="Two-line row" subtitle="72dp, the default" onClick={() => {}} />
            <ListRow
              size="row-lg"
              title="Three-line row"
              subtitle="96dp, with a meta line"
              meta="44 stops · 42 delivered · 2 failed"
              trailing={<MoreIcon className="h-5 w-5 text-on-surface-variant" />}
              onClick={() => {}}
            />
            <ListRow title="Selected row" subtitle="active treatment" selected onClick={() => {}} />
          </div>
          <ListRow
            className="mt-2"
            outlined
            leading={<CalendarIcon className="h-5 w-5 text-on-surface-variant" />}
            title="Outlined row"
            subtitle="as used by the date options"
            trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
            onClick={() => {}}
          />
        </Section>

        <Section title="Status, chips, ids">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status="pending" />
            <StatusPill status="delivered" />
            <StatusPill status="failed" />
            <StatusBadge status="pending" />
            <StatusBadge status="delivered" />
            <StatusBadge status="failed" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip>Neutral</Chip>
            <Chip tone="primary">Primary</Chip>
            <Chip tone="success">Success</Chip>
            <Chip tone="danger">Danger</Chip>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <IdChip stopId="D7" />
            <IdChip stopId="D7.1" color="purple" />
            <IdChip stopId="37" color="teal" />
            <IdChip stopId="A1" color="green" />
            <IdChip stopId="B12" color="pink" />
            <IdChip stopId="C3" color="amber" />
          </div>
          {/* The list treatment. Every pair here clears 4.5:1 — see index.css. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IdChip stopId="D7" variant="pastel" />
            <IdChip stopId="D7.1" color="purple" variant="pastel" />
            <IdChip stopId="37" color="teal" variant="pastel" />
            <IdChip stopId="A1" color="green" variant="pastel" />
            <IdChip stopId="B12" color="pink" variant="pastel" />
            <IdChip stopId="C3" color="amber" variant="pastel" />
          </div>
        </Section>

        {/*
          Every stop-row variant, side by side.

          The list itself only shows the variants a given route happens to
          contain, so checking that a failed pickup with a note still looks
          right means finding one. Here they are all on one screen, in the
          order they get harder: plain, note, tag, both, delivered, failed, and
          the two-line title with a recipient.
        */}
        <Section title="StopRow — every variant">
          <div className="overflow-hidden rounded-row bg-surface">
            {GALLERY_ROWS.map((row) => (
              <StopRow key={row.id} row={row} selected={row.id === 'g-selected'} onSelect={() => {}} />
            ))}
          </div>
        </Section>

        <Section title="Controls">
          <SegmentedControl
            label="Optimise by"
            value={tone}
            onChange={setTone}
            options={[
              { value: 'duration', label: 'Time' },
              { value: 'distance', label: 'Distance' },
            ]}
          />
          <div className="mt-3">
            <Stepper label="Parcels" value={count} onChange={setCount} min={0} max={20} />
          </div>
          <div className="mt-3">
            <ActionRow3Up
              actions={[
                { label: 'Edit', icon: <PencilIcon className="h-5 w-5" />, onSelect: () => {} },
                { label: 'Duplicate', icon: <DuplicateIcon className="h-5 w-5" />, onSelect: () => {} },
                {
                  label: 'Delete',
                  icon: <TrashIcon className="h-5 w-5" />,
                  onSelect: () => setConfirmOpen(true),
                  destructive: true,
                },
              ]}
            />
          </div>

          {/*
            The stop card's primary slot: 88dp, one filled action, two
            outlined. The height is the point and it is the thing a screenshot
            cannot check — this is the row a driver hits 44 times a day,
            one-handed, possibly gloved, and it wants a thumb on a real phone.
          */}
          <div className="mt-3">
            <ActionRow3Up
              size="tall"
              actions={[
                {
                  label: 'Navigate',
                  icon: <NavigateIcon className="h-6 w-6" />,
                  variant: 'filled',
                  onSelect: () => {},
                },
                {
                  label: 'Failed',
                  icon: <ParcelCrossIcon className="h-6 w-6" />,
                  variant: 'outlined',
                  onSelect: () => {},
                },
                {
                  label: 'Delivered',
                  icon: <ParcelCheckIcon className="h-6 w-6" />,
                  variant: 'outlined',
                  onSelect: () => {},
                },
              ]}
            />
          </div>

          {/* Group dots, at the size they appear beside a status counter. */}
          <div className="mt-4 flex items-center gap-3">
            {(['blue', 'purple', 'teal', 'green', 'pink', 'amber'] as const).map((color) => (
              <span key={color} className="flex items-center gap-1.5 text-body text-on-surface-variant">
                <GroupDot color={color} />
                {color}
              </span>
            ))}
          </div>
        </Section>

        {/* Both completion states, because the delivered/failed pair is the
            one place green and red sit side by side in the same component. */}
        <Section title="Completion card" onSurface>
          <CompletionCard
            status="delivered"
            label="Marked as delivered"
            at="16:13"
            onUndo={() => {}}
          />
          <div className="mt-3">
            <CompletionCard
              status="failed"
              label="Marked as failed"
              at="16:40"
              reason="Nobody home — tried the back door too"
              onUndo={() => {}}
            />
          </div>
        </Section>

        {/* On white, because both of these are surface-variant and would be
            invisible against a surface-variant page — which is exactly the
            kind of thing this screen exists to catch. */}
        <Section title="Demoted actions" onSurface>
          <DemotedActionGroup
            actions={[
              { label: 'Set name and date', icon: <PencilIcon className="h-5 w-5" />, onSelect: () => {} },
              { label: 'Duplicate route', icon: <DuplicateIcon className="h-5 w-5" />, onSelect: () => {} },
            ]}
            destructive={{
              label: 'Delete route',
              icon: <TrashIcon className="h-5 w-5" />,
              onSelect: () => setConfirmOpen(true),
            }}
          />

          {/*
            The sectioned form, as the route menu uses it: blocks separated by
            a gap, a trailing hint on the announced-but-unavailable items, and
            the destructive one alone at the end.
          */}
          <div className="mt-4">
            <DemotedActionGroup
              sections={[
                [
                  { label: 'Share route copy', icon: <ShareIcon className="h-5 w-5" />, hint: 'Soon', disabled: true, onSelect: () => {} },
                  { label: 'Copy stops…', icon: <DuplicateIcon className="h-5 w-5" />, onSelect: () => {} },
                ],
                [{ label: 'Print route', icon: <PrinterIcon className="h-5 w-5" />, onSelect: () => {} }],
              ]}
              destructive={{
                label: 'Remove stops…',
                icon: <TrashIcon className="h-5 w-5" />,
                onSelect: () => setConfirmOpen(true),
              }}
            />
          </div>
        </Section>

        <Section title="Buttons and sheets" onSurface>
          <div className="space-y-2">
            <FullWidthButton onClick={() => setSheetOpen(true)}>Open a sheet</FullWidthButton>
            <FullWidthButton variant="demoted">Demoted</FullWidthButton>
            <FullWidthButton variant="danger" onClick={() => setConfirmOpen(true)}>
              Danger
            </FullWidthButton>
            <FullWidthButton disabled>Disabled</FullWidthButton>
          </div>
        </Section>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Example sheet">
        <div className="space-y-3 p-4 pb-8">
          <h2 className="text-title font-semibold text-on-surface">A bottom sheet</h2>
          <p className="text-body text-on-surface-variant">
            Grab handle, 24dp radius, scrim, Escape, focus trap.
          </p>
          <FullWidthButton onClick={() => setSheetOpen(false)}>Close</FullWidthButton>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this route?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

/** A stop for the gallery. Nothing here is persisted; this screen is dev-only. */
function galleryStop(id: string, status: StopStatus, patch: Partial<AddressedStop> = {}): AddressedStop {
  return {
    id,
    stopId: id.replace('g-', '').slice(0, 4).toUpperCase(),
    originalPosition: 1,
    lat: 55.6,
    lng: 12.5,
    kind: 'delivery',
    order: 'auto',
    status,
    statusHistory: [],
    address: { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    ...patch,
  }
}

function galleryRow(
  id: string,
  seq: string,
  overrides: Partial<StopRowModel> & { stop: AddressedStop },
): StopRowModel {
  return {
    kind: 'stop',
    id,
    seq,
    eta: null,
    title: overrides.stop.address?.title ?? '',
    subtitle: overrides.stop.address?.subtitle ?? '',
    color: 'blue',
    tags: [],
    note: null,
    ...overrides,
  }
}

const GALLERY_ROWS: StopRowModel[] = [
  galleryRow('g-plain', '01', { stop: galleryStop('g-plain', 'pending') }),
  galleryRow('g-note', '02', { stop: galleryStop('g-note', 'pending'), note: 'bike + boks' }),
  galleryRow('g-first', '03', {
    stop: galleryStop('g-first', 'pending', { order: 'first' }),
    tags: ['first'],
    color: 'purple',
  }),
  galleryRow('g-both', '04', {
    stop: galleryStop('g-both', 'pending', { kind: 'pickup' }),
    tags: ['pickup'],
    note: 'mazda',
    color: 'teal',
    eta: '09:42',
  }),
  galleryRow('g-delivered', '05', { stop: galleryStop('g-delivered', 'delivered') }),
  // The rule that is easiest to get backwards: the chip is the GROUP, the
  // badge is the STATUS. A failed stop in a green group stays green.
  galleryRow('g-failed', '06', {
    stop: galleryStop('g-failed', 'failed', { groupId: 'green' }),
    color: 'green',
  }),
  galleryRow('g-long', '07', {
    stop: galleryStop('g-long', 'pending', {
      address: { title: 'Rundgården 34, st. th.', subtitle: 'København NV, 2400', source: 'geocoder' },
      recipient: 'Jette Kelbjørn',
    }),
    title: 'Rundgården 34, st. th. Jette Kelbjørn',
    subtitle: 'København NV, 2400',
    color: 'pink',
  }),
  galleryRow('g-selected', '08', { stop: galleryStop('g-selected', 'pending'), color: 'amber' }),
]

function Section({
  title,
  children,
  onSurface = false,
}: {
  title: string
  children: React.ReactNode
  onSurface?: boolean
}) {
  return (
    <section>
      <h2 className="mb-2 text-label font-semibold uppercase tracking-wide text-on-surface-variant">
        {title}
      </h2>
      <div className={onSurface ? 'rounded-row bg-surface p-3' : ''}>{children}</div>
    </section>
  )
}
