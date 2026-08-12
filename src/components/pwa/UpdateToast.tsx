import { useState } from 'react'
import { useSwUpdate } from '../../pwa/useSwUpdate'

/**
 * "A new version is ready." Offered, never taken.
 *
 * ── Why this is a toast and not a dialog ──────────────────────────────────
 *
 * The driver is mid-round with a parcel in one hand. A modal that has to be
 * dismissed before the next stop can be ticked off is an interruption charged
 * to them for our convenience, and the thing it interrupts is someone's job.
 *
 * So it sits at the bottom, above the safe area, blocks nothing, and can be
 * ignored. Dismissing hides it for this session only — the worker is still
 * waiting and will be offered again next launch, which is the honest
 * behaviour: the update has not gone anywhere.
 *
 * Taking it reloads the page, and that is not a detail to hide. A reload is
 * the only way the new asset map and the running page can agree; without it
 * the app would keep asking for chunks the new deploy has deleted. The button
 * therefore says "Reload", not "Update", because that is what the tap does.
 */
export function UpdateToast() {
  const { updateReady, update } = useSwUpdate()
  const [dismissed, setDismissed] = useState(false)

  if (!updateReady || dismissed) return null

  return (
    <div
      role="status"
      data-testid="sw-update-toast"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-row bg-on-surface px-4 py-3 shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-white">A new version is ready</p>
          <p className="text-meta text-white/70">Your route is saved and will still be here.</p>
        </div>
        <button
          type="button"
          onClick={update}
          data-testid="sw-update-reload"
          className="min-h-touch shrink-0 rounded-pill bg-white px-4 text-label font-semibold text-on-surface"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          data-testid="sw-update-dismiss"
          className="min-h-touch w-8 shrink-0 text-row text-white/60"
        >
          ×
        </button>
      </div>
    </div>
  )
}
