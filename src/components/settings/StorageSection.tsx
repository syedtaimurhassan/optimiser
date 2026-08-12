import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../store/deviceStore'
import { cacheUsage, clearCache, type CacheUsage } from '../../pwa/registerSw'
import { describeStorage, formatBytes, fractionUsed, pressureOf } from '../../lib/pwa/storage'

/**
 * What the browser is holding, and what it has promised about it.
 *
 * ── Why this is in Settings and not the diagnostics panel ─────────────────
 *
 * The diagnostics panel is a dev build only and reports capabilities. This
 * answers a question a real driver can act on — "will my round still be here
 * tomorrow" — and the two actions it offers (ask for protection again, drop
 * the optional downloads) are the only storage controls the app has.
 */
export function StorageSection() {
  const estimate = useDeviceStore((s) => s.capabilities.storageEstimate)
  const persisted = useDeviceStore((s) => s.capabilities.storagePersisted ?? false)
  const resolved = useDeviceStore((s) => s.capabilities.asyncResolved)
  const refreshStorage = useDeviceStore((s) => s.refreshStorage)

  const [caches, setCaches] = useState<CacheUsage | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void cacheUsage().then(setCaches)
  }, [])

  const pressure = pressureOf(estimate)
  const fraction = fractionUsed(estimate)

  const BAR_TONE: Record<string, string> = {
    fine: 'bg-primary',
    warn: 'bg-group-amber',
    critical: 'bg-danger',
    unknown: 'bg-outline',
  }

  return (
    <section className="space-y-2" data-testid="settings-storage">
      <h2 className="px-1 text-label font-semibold text-on-surface-variant">Storage</h2>

      <div className="rounded-row border border-outline px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-label font-semibold text-on-surface">On this device</span>
          <span className="text-meta text-on-surface-variant" data-testid="storage-figures">
            {/* "pending" rather than "0 B": the probe is async, and a zero
                before it lands reads as "nothing is saved", which is alarming
                and wrong. */}
            {!resolved
              ? 'checking…'
              : estimate
                ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}`
                : 'not reported by this browser'}
          </span>
        </div>

        {fraction !== null && (
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-variant"
            role="progressbar"
            aria-valuenow={Math.round(fraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
          >
            <div
              className={`h-full rounded-pill ${BAR_TONE[pressure]}`}
              style={{ width: `${Math.max(2, fraction * 100)}%` }}
            />
          </div>
        )}

        <p
          className={`mt-2 text-meta ${pressure === 'critical' ? 'text-danger' : 'text-on-surface-variant'}`}
          data-testid="storage-verdict"
        >
          {resolved ? describeStorage(estimate, persisted) : 'Asking the browser…'}
        </p>

        {resolved && !persisted && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void refreshStorage().finally(() => setBusy(false))
            }}
            data-testid="storage-request-persist"
            className="mt-3 min-h-touch w-full rounded-pill border border-outline text-label font-semibold text-on-surface disabled:opacity-40"
          >
            {busy ? 'Asking…' : 'Ask the browser to protect my data'}
          </button>
        )}
      </div>

      {/*
        The optional downloads, and what dropping them costs.

        These are in their own cache precisely so this row can exist: the
        scanner and text recognition pull about 40 MB of WebAssembly and models
        between them, and a driver on a full phone should be able to get that
        back without losing a single route. `storage.estimate()` cannot break
        the number down — it reports one figure for the whole origin — so the
        service worker measures its own caches and answers over a MessageChannel.
      */}
      {caches && (caches.heavy.count > 0 || caches.tiles.count > 0) && (
        <div className="rounded-row border border-outline px-3 py-3" data-testid="settings-caches">
          <p className="text-label font-semibold text-on-surface">Downloaded for offline use</p>
          <ul className="mt-2 space-y-2">
            {(
              [
                ['heavy', 'Scanner and text recognition', caches.heavy],
                ['tiles', 'Map tiles', caches.tiles],
              ] as const
            )
              .filter(([, , usage]) => usage.count > 0)
              .map(([name, label, usage]) => (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-meta text-on-surface">{label}</span>
                    <span className="block text-meta text-on-surface-variant">
                      {formatBytes(usage.bytes)} · {usage.count} file
                      {usage.count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void clearCache(name).then(() => cacheUsage().then(setCaches))
                    }}
                    data-testid={`clear-cache-${name}`}
                    className="min-h-touch shrink-0 rounded-pill border border-outline px-3 text-label font-semibold text-on-surface"
                  >
                    Clear
                  </button>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-meta text-on-surface-variant">
            Clearing these frees space and loses no route data. They download again next time you
            use the feature.
          </p>
        </div>
      )}
    </section>
  )
}
