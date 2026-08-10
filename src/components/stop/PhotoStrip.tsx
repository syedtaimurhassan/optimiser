import { useEffect, useState } from 'react'
import type { AddressedStop } from '../../types'
import {
  budgetMessage,
  compressPhoto,
  newPhotoRef,
  photoBudget,
  MAX_PHOTOS_PER_STOP,
} from '../../lib/photos'
import { deletePhoto, getPhoto, putPhoto } from '../../lib/persistence/db'
import { useRoutesStore } from '../../store/routesStore'
import { CameraPlusIcon, CloseIcon, TrashIcon } from '../ui/icons'
import { Sheet } from '../ui'

/**
 * Proof of delivery, as a row of thumbnails.
 *
 * ── Blobs never touch the store ───────────────────────────────────────────
 *
 * The stop holds `photoRefs`; the bytes live in IndexedDB. That rule is the
 * reason `db.ts` exists, and breaking it here would mean re-serialising a
 * megabyte of JPEG on every keystroke in the notes field.
 *
 * ── Object URLs are revoked ───────────────────────────────────────────────
 *
 * Every URL created here is released when the set of photos changes or the
 * strip unmounts. An un-revoked object URL pins its blob in memory for the
 * life of the document, and a driver works one document for eight hours.
 */
export function PhotoStrip({
  stop,
  allStops,
  /** Lets a control elsewhere in the form open this strip's file picker. */
  addInputId,
}: {
  stop: AddressedStop
  allStops: readonly AddressedStop[]
  addInputId?: string
}) {
  const updateStop = useRoutesStore((s) => s.updateStop)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const refs = stop.photoRefs ?? []
  // A primitive dependency, so the effect re-runs when the SET of photos
  // changes rather than on every render that rebuilds the array.
  const refKey = refs.join('|')

  useEffect(() => {
    let cancelled = false
    const created: string[] = []

    void (async () => {
      const next: Record<string, string> = {}
      for (const ref of refKey.split('|').filter(Boolean)) {
        const blob = await getPhoto(ref)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        created.push(url)
        next[ref] = url
      }
      if (cancelled) {
        created.forEach(URL.revokeObjectURL)
        return
      }
      setUrls(next)
    })()

    return () => {
      cancelled = true
      created.forEach(URL.revokeObjectURL)
    }
  }, [refKey])

  async function add(file: File) {
    setError(null)
    const budget = photoBudget(stop, allStops)
    if (budget.blocked) {
      setError(budgetMessage(budget.blocked))
      return
    }
    setBusy(true)
    try {
      const blob = await compressPhoto(file)
      const ref = newPhotoRef()
      // Written to IndexedDB BEFORE the ref is stored, so a failure here
      // cannot leave a stop pointing at a photo that does not exist.
      await putPhoto(ref, blob, stop.id)
      updateStop(stop.id, { photoRefs: [...(stop.photoRefs ?? []), ref] })
    } catch {
      setError('That photo could not be saved. Try again, or take a smaller one.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(ref: string) {
    // The ref goes first: an orphaned blob is invisible and gets cleaned up,
    // whereas a ref pointing at a deleted blob renders as a broken thumbnail.
    updateStop(stop.id, { photoRefs: refs.filter((r) => r !== ref) })
    setViewing(null)
    await deletePhoto(ref)
  }

  const budget = photoBudget(stop, allStops)

  return (
    <div className="mt-3" data-testid="photo-strip">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-label font-semibold text-on-surface">Photos</span>
        <span className="text-meta text-on-surface-variant">
          {budget.stopUsed} of {MAX_PHOTOS_PER_STOP}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {refs.map((ref) => (
          <button
            key={ref}
            type="button"
            onClick={() => setViewing(ref)}
            aria-label="View photo"
            className="h-16 w-16 shrink-0 overflow-hidden rounded-row border border-outline bg-surface-variant"
          >
            {urls[ref] ? (
              <img src={urls[ref]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="block h-full w-full animate-pulse bg-surface-variant" />
            )}
          </button>
        ))}

        {/* The add tile is a label, so the whole 64dp square is the target and
            the input stays out of the tab order twice over. */}
        <label
          className={`flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-row border border-dashed border-outline text-on-surface-variant ${
            busy ? 'opacity-50' : ''
          }`}
        >
          <CameraPlusIcon className="h-5 w-5" />
          <input
            id={addInputId}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            data-testid="photo-add"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Reset first: picking the same file twice in a row is otherwise
              // a no-op, because the value has not changed.
              e.target.value = ''
              if (file) void add(file)
            }}
          />
        </label>
      </div>

      {busy && <p className="px-1 pt-1 text-meta text-on-surface-variant">Saving the photo…</p>}
      {error && (
        <p role="status" className="px-1 pt-1 text-meta text-error">
          {error}
        </p>
      )}

      {/* Full-screen viewer, with the only destructive action in reach. */}
      <Sheet
        open={viewing !== null}
        onClose={() => setViewing(null)}
        side="full"
        label="Photo"
        zIndex={2300}
      >
        <div className="relative flex h-full w-full flex-col bg-black">
          <div className="flex justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => viewing && void remove(viewing)}
              aria-label="Delete photo"
              data-testid="photo-delete"
              className="flex h-touch w-touch items-center justify-center rounded-pill bg-black/40 text-white"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewing(null)}
              aria-label="Close photo"
              className="flex h-touch w-touch items-center justify-center rounded-pill bg-black/40 text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            {viewing && urls[viewing] && (
              <img src={urls[viewing]} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
