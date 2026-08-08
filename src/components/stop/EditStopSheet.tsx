import { useState } from 'react'
import type { AddressedStop, OrderConstraint, Route, StopKind } from '../../types'
import { addressKey, matchesDefault } from '../../lib/addressDefaults'
import { colorNameFor, titleFor } from '../../lib/routeList'
import { useRoutesStore } from '../../store/routesStore'
import {
  DemotedActionGroup,
  IdChip,
  ListRow,
  SegmentedControl,
  Sheet,
  Stepper,
} from '../ui'
import {
  CameraPlusIcon,
  ChevronRightIcon,
  ClockIcon,
  DuplicateIcon,
  HelpIcon,
  KeyIcon,
  NoteIcon,
  PackageSearchIcon,
  PinIcon,
  StarIcon,
  TrashIcon,
} from '../ui/icons'
import { GroupChipRow } from './GroupChipRow'
import { describeServiceTime, describeWindow } from '../../lib/stopSettings'
import { DurationPicker, TextPicker, TimeWindowPicker } from './PickerSheets'

/**
 * Edit stop.
 *
 * ── "Done", not Save/Cancel ───────────────────────────────────────────────
 *
 * Every control writes straight through to the store, and "Done" only closes
 * the sheet. That is what Spoke's header implies and we match it, for a reason
 * beyond fidelity: M8 owns staged changes, and a form with its own private
 * draft would then have TWO layers of uncommitted state — the form's, and the
 * route's — which is the kind of thing that produces a stop showing one parcel
 * count on the card and another in the form.
 *
 * The consequence to be honest about: there is no Cancel, so there is no undo
 * for an edit. That is Spoke's trade too, and it is defensible because every
 * field here is small and re-editable. It would not be defensible for anything
 * destructive, which is why Remove stop is still a confirmed action.
 *
 * ── Defaults are shown as WORDS ───────────────────────────────────────────
 *
 * "Anytime", "Default (1 min)", "Not set" — never a blank. The effective value
 * of every setting is visible without opening anything, which costs a few
 * strings and removes the entire class of "is that empty or is it unset".
 */
export interface EditStopSheetProps {
  route: Route
  stop: AddressedStop
  onClose: () => void
  /** Duplicating navigates to the copy, so the screen handles it. */
  onDuplicate: () => void
  onRemove: () => void
}

type Picker = 'notes' | 'access' | 'finder' | 'window' | 'service' | null

export function EditStopSheet({ route, stop, onClose, onDuplicate, onRemove }: EditStopSheetProps) {
  const [picker, setPicker] = useState<Picker>(null)
  const updateStop = useRoutesStore((s) => s.updateStop)
  const ensureGroup = useRoutesStore((s) => s.ensureGroup)
  const saveAddressDefault = useRoutesStore((s) => s.saveAddressDefault)
  const clearAddressDefault = useRoutesStore((s) => s.clearAddressDefault)
  const savedDefault = useRoutesStore((s) => {
    const key = addressKey(stop.address, stop)
    return key ? s.addressDefaults[key] : undefined
  })

  const patch = (values: Partial<AddressedStop>) => updateStop(stop.id, values)
  const isDefault = matchesDefault(stop, savedDefault)

  return (
    <>
      <Sheet open onClose={onClose} side="full" label={`Edit ${titleFor(stop)}`} zIndex={2200}>
        {/* Header: help, title, Done. Three zones, and the title is centred by
            giving the two ends the same width rather than by absolute
            positioning — which breaks the moment "Done" is translated. */}
        <header className="flex items-center gap-2 border-b border-outline px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="About editing a stop"
            data-testid="edit-help"
            // Announced but inert: there is no help content yet, and a button
            // that opens an empty screen is worse than one that is visibly
            // unavailable.
            disabled
            className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant disabled:opacity-40"
          >
            <HelpIcon className="h-6 w-6" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-title font-semibold text-on-surface">
            Edit stop
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="edit-done"
            className="flex h-touch min-w-touch shrink-0 items-center justify-center rounded-pill px-3 text-row font-semibold text-primary active:bg-surface-variant"
          >
            Done
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3">
          {/* ID left, Set Default right. */}
          <div className="flex items-center justify-between gap-3">
            <IdChip
              stopId={stop.stopId}
              color={colorNameFor(stop, route.groups)}
              variant="pastel"
            />
            <button
              type="button"
              onClick={() => {
                const key = addressKey(stop.address, stop)
                if (isDefault && key) clearAddressDefault(key)
                else saveAddressDefault(stop.id)
              }}
              data-testid="set-default"
              data-on={isDefault}
              aria-pressed={isDefault}
              className={`flex min-h-touch items-center gap-1.5 rounded-pill px-3 text-label font-semibold ${
                isDefault ? 'text-primary' : 'text-on-surface-variant'
              } active:bg-surface-variant`}
            >
              Set Default
              <StarIcon filled={isDefault} className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mt-2 text-title font-semibold text-on-surface">{titleFor(stop)}</h3>
          <p className="text-body text-on-surface-variant">
            {stop.address?.subtitle?.trim() || 'No address'}
          </p>

          <div className="mt-3">
            <GroupChipRow
              groups={route.groups}
              value={stop.groupId}
              onChoose={(choice) => {
                if (!choice) {
                  patch({ groupId: undefined })
                  return
                }
                const id = ensureGroup(choice.name, choice.colorHex)
                if (id) patch({ groupId: id })
              }}
            />
          </div>

          {/*
            Three input types on one row: notes, an access code, and a photo.
            They share a row because they answer one question — "what else do I
            need to know at this door" — and splitting them into three rows
            would make the two rare ones as loud as the common one.
          */}
          <div className="mt-3 flex items-center gap-1 rounded-row bg-surface-variant pr-2">
            <button
              type="button"
              onClick={() => setPicker('notes')}
              data-testid="edit-notes"
              className="flex min-h-touch flex-1 items-center gap-3 px-4 py-3 text-left"
            >
              <NoteIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
              <span
                className={`min-w-0 flex-1 truncate text-row ${
                  stop.notes?.trim() ? 'text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                {stop.notes?.trim() || 'Add notes'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPicker('access')}
              aria-label="Access code"
              data-testid="edit-access"
              className={`flex h-touch w-touch shrink-0 items-center justify-center rounded-pill ${
                stop.accessCodes?.trim() ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <KeyIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled
              aria-label="Add a photo (coming soon)"
              data-testid="edit-photo"
              className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant disabled:opacity-40"
            >
              <CameraPlusIcon className="h-5 w-5" />
            </button>
          </div>

          {/* The settings list. Each control is matched to the shape of its
              data: an exclusive pair is segmented, a small integer is a
              stepper, an arbitrary value drills down. */}
          <div className="mt-3 overflow-hidden rounded-row border border-outline">
            <SettingRow label="Type">
              <SegmentedControl<StopKind>
                label="Type"
                value={stop.kind}
                onChange={(kind) => patch({ kind })}
                options={[
                  { value: 'delivery', label: 'Delivery' },
                  { value: 'pickup', label: 'Pickup' },
                ]}
                className="w-48"
              />
            </SettingRow>

            <ListRow
              leading={<PackageSearchIcon className="h-5 w-5 text-on-surface-variant" />}
              title="Parcel finder"
              subtitle={stop.packageFinder?.trim() || 'Not set'}
              trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
              onClick={() => setPicker('finder')}
              className="border-t border-outline"
            />

            <SettingRow label="Parcels">
              <Stepper
                label="Parcels"
                min={1}
                max={99}
                value={stop.parcelCount ?? 1}
                onChange={(parcelCount) => patch({ parcelCount })}
              />
            </SettingRow>

            <SettingRow label="Order">
              <SegmentedControl<OrderConstraint>
                label="Order"
                value={stop.order}
                onChange={(order) => patch({ order })}
                options={[
                  { value: 'first', label: 'First' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'last', label: 'Last' },
                ]}
                className="w-52"
              />
            </SettingRow>

            <ListRow
              leading={<ClockIcon className="h-5 w-5 text-on-surface-variant" />}
              title="Arrival time"
              subtitle={describeWindow(stop.twOpenSec, stop.twCloseSec)}
              trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
              onClick={() => setPicker('window')}
              className="border-t border-outline"
            />

            <ListRow
              leading={<PinIcon className="h-5 w-5 text-on-surface-variant" />}
              title="Estimated time at stop"
              subtitle={describeServiceTime(stop.serviceTimeSec)}
              trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
              onClick={() => setPicker('service')}
              className="border-t border-outline"
            />
          </div>

          <DemotedActionGroup
            className="mt-4"
            actions={[
              {
                label: 'Change address',
                icon: <PinIcon className="h-5 w-5" />,
                // M6 owns the search screen and it lives inside the route
                // sheet; reaching it from a full-screen modal is a flow of its
                // own. Announced and unavailable rather than silently missing.
                disabled: true,
                onSelect: () => {},
              },
              {
                label: 'Duplicate stop',
                icon: <DuplicateIcon className="h-5 w-5" />,
                onSelect: onDuplicate,
              },
            ]}
            destructive={{
              label: 'Remove stop',
              icon: <TrashIcon className="h-5 w-5" />,
              onSelect: onRemove,
            }}
          />
        </div>
      </Sheet>

      <TextPicker
        open={picker === 'notes'}
        title="Notes"
        label="Notes for this stop"
        placeholder="e.g. bike + boks"
        multiline
        value={stop.notes ?? ''}
        onSave={(notes) => {
          patch({ notes: notes || undefined })
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />

      <TextPicker
        open={picker === 'access'}
        title="Access code"
        label="Access code"
        placeholder="e.g. 1234#"
        value={stop.accessCodes ?? ''}
        onSave={(accessCodes) => {
          patch({ accessCodes: accessCodes || undefined })
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />

      <TextPicker
        open={picker === 'finder'}
        title="Parcel finder"
        label="Where the parcel is"
        placeholder="e.g. back left, red crate"
        value={stop.packageFinder ?? ''}
        onSave={(packageFinder) => {
          patch({ packageFinder: packageFinder || undefined })
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />

      <TimeWindowPicker
        open={picker === 'window'}
        openSec={stop.twOpenSec}
        closeSec={stop.twCloseSec}
        onSave={(twOpenSec, twCloseSec) => {
          patch({ twOpenSec, twCloseSec })
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />

      <DurationPicker
        open={picker === 'service'}
        value={stop.serviceTimeSec}
        onSave={(serviceTimeSec) => {
          patch({ serviceTimeSec })
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />
    </>
  )
}

/** A settings row whose control sits inline rather than drilling down. */
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-row items-center justify-between gap-3 border-t border-outline px-4 py-2 first:border-t-0">
      <span className="text-row font-semibold text-on-surface">{label}</span>
      {children}
    </div>
  )
}

