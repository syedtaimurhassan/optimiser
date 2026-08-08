import { useEffect, useRef, useState } from 'react'
import { getGeocodingService } from '../../lib/geocoding'
import type { Address, LatLng } from '../../types.ts'
import { formatLatLng } from '../../lib/coordinates.ts'
import { useMapController } from '../map/MapControllerContext'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FullWidthButton } from '../ui/FullWidthButton'
import { PencilIcon } from '../ui/icons'

/**
 * Add a stop by dropping a pin.
 *
 * ── Why the pin does not move ─────────────────────────────────────────────
 *
 * The pin is fixed to the centre of the screen and the MAP moves under it.
 * That inversion is what makes this usable one-handed: a draggable marker
 * demands precision from a thumb that is also holding the phone, and it hides
 * the target underneath itself at the exact moment you are aiming. Moving the
 * map instead means the target is always visible and the pin is always where
 * the eye already is.
 *
 * The tooltip still says "Drag to set location" because that is what the
 * gesture is from the driver's side — they drag, the location changes. Naming
 * the implementation ("Pan the map") would describe our code rather than their
 * intent.
 *
 * ── Spending ──────────────────────────────────────────────────────────────
 *
 * Reverse geocoding fires on `moveend`, never on `move`. A per-frame lookup
 * would spend a credit for every pixel of a drag. Coordinates are also rounded
 * into the cache key at about a metre, so nudging the map by a hair reuses the
 * previous answer instead of buying it again.
 */

export interface AddByPinProps {
  /** Where the pin starts — the current camera, in practice. */
  initialCenter?: LatLng
  onAdd: (point: LatLng, address: Address | null) => void
  /** "Add stop and edit" — creates the stop, then opens it for notes. */
  onAddAndEdit: (point: LatLng, address: Address | null) => void
  onCancel: () => void
}

export function AddByPin({ initialCenter, onAdd, onAddAndEdit, onCancel }: AddByPinProps) {
  const controller = useMapController()
  const [center, setCenter] = useState<LatLng | null>(initialCenter ?? null)
  const [address, setAddress] = useState<Address | null>(null)
  const [looking, setLooking] = useState(false)
  const [confirmingExit, setConfirmingExit] = useState(false)

  // Guards a late reverse-geocode from overwriting a newer one. The map can
  // come to rest twice before the first lookup returns.
  const seqRef = useRef(0)

  useEffect(() => {
    if (!controller) return
    setCenter(controller.getCenter())
    return controller.onMoveEnd(setCenter)
  }, [controller])

  useEffect(() => {
    if (!center) return
    const seq = ++seqRef.current
    setLooking(true)

    let cancelled = false
    getGeocodingService()
      .reverse(center)
      .then((result) => {
        if (cancelled || seq !== seqRef.current) return
        setAddress(result)
      })
      .catch(() => {
        // A failed lookup is not a failed stop. The coordinate is still valid
        // and still addable — the card just falls back to showing it.
        if (!cancelled || seq === seqRef.current) setAddress(null)
      })
      .finally(() => {
        if (!cancelled && seq === seqRef.current) setLooking(false)
      })

    return () => {
      cancelled = true
    }
  }, [center])

  const title = address?.title || (center ? formatLatLng(center) : 'Move the map to choose')
  const subtitle = address?.subtitle || (address ? '' : looking ? 'Finding address…' : '')

  return (
    <>
      {/* The pin, pinned. `pointer-events-none` so it never eats a map drag. */}
      <div
        data-testid="pin-crosshair"
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[1600] flex flex-col items-center"
        style={{ height: 'calc(100% - var(--pin-card-height, 200px))' }}
      >
        <div className="flex h-full flex-col items-center justify-center">
          <PinGlyph />
          {/* Dark pill beneath the pin, per the design. */}
          <span className="mt-2 rounded-pill bg-on-surface/90 px-3 py-1 text-meta font-medium text-surface">
            Drag to set location
          </span>
        </div>
      </div>

      <div
        data-testid="pin-card"
        className="fixed inset-x-0 bottom-0 z-[1650] rounded-t-sheet border-t border-outline bg-surface p-4 shadow-2xl"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-row font-medium text-on-surface">{title}</p>
            {subtitle && (
              <p className="truncate text-body text-on-surface-variant">{subtitle}</p>
            )}
          </div>
          {/*
            The pencil corrects a wrong reverse-geocode. It is a trailing icon
            rather than a third button because it is the rare case: the
            geocoder is usually right, and giving "fix this" equal weight to
            "add this" would imply otherwise.
          */}
          <button
            type="button"
            onClick={() => center && onAddAndEdit(center, address)}
            aria-label="Edit this address"
            data-testid="pin-edit"
            className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <FullWidthButton onClick={() => center && onAdd(center, address)} disabled={!center}>
            Add stop
          </FullWidthButton>
          {/*
            "Add stop and edit" is not clutter — it is the "I already know this
            one needs a note" shortcut. Without it, every stop that needs an
            access code costs a round trip: add, find it in the list, open it,
            edit.
          */}
          <FullWidthButton
            variant="outlined"
            onClick={() => center && onAddAndEdit(center, address)}
            disabled={!center}
          >
            Add stop and edit
          </FullWidthButton>
        </div>
      </div>

      {/*
        The back-out confirm, with Spoke's version corrected.

        Spoke asks "Don't add stop?" and answers it with a button labelled
        "Don't add stop" — a double negative where the filled, thumb-nearest
        button is the one that discards your work. Ours asks a plain question
        and puts the weight on keeping it.
      */}
      <ConfirmDialog
        open={confirmingExit}
        tone="protective"
        title="Discard this stop?"
        body="You have not added this location to your route yet."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onCancel={() => setConfirmingExit(false)}
        onConfirm={() => {
          setConfirmingExit(false)
          onCancel()
        }}
      />

      <BackGuard onBack={() => setConfirmingExit(true)} />
    </>
  )
}

/**
 * Turns a hardware/gesture back into the discard confirmation.
 *
 * Pushing a history entry is what gives Android's back gesture something to
 * pop. Without it, backing out of this screen leaves the app entirely — which
 * is the one outcome the confirm dialog exists to prevent.
 */
function BackGuard({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    history.pushState({ addByPin: true }, '')
    const onPop = () => onBack()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [onBack])
  return null
}

/** The centre pin. Drawn here rather than as an icon: it needs the drop shadow
 *  and the ground dot to read against a busy map. */
function PinGlyph() {
  return (
    <svg width="32" height="44" viewBox="0 0 32 44" aria-hidden="true">
      <path
        d="M16 42c0-8 10-14 10-24A10 10 0 1 0 6 18c0 10 10 16 10 24z"
        className="fill-primary"
      />
      <circle cx="16" cy="17" r="4" className="fill-surface" />
    </svg>
  )
}
