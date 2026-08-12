import { useDataLoss } from '../../pwa/useDataLoss'

/**
 * Say it plainly when the data is gone.
 *
 * ── Why an empty app is the wrong way to deliver this news ────────────────
 *
 * When the browser clears storage, the app comes up looking brand new. A
 * driver who loaded forty stops yesterday sees an empty route list and does
 * not conclude "my data was evicted" — they conclude they are signed into the
 * wrong thing, or on the wrong phone, and they go looking for it. They lose
 * the morning to a search that cannot succeed.
 *
 * Telling them costs one banner and saves that. It also explains the fix,
 * because there IS one: installing the app is what makes WebKit grant
 * persistent mode, and persistent mode is what is excluded from eviction.
 *
 * Not a modal. The news is bad but the app still works, and the first thing
 * they will want to do is start re-entering the round.
 */
export function DataLossBanner() {
  const { lost, acknowledge } = useDataLoss()

  if (!lost) return null

  return (
    <div
      role="alert"
      data-testid="data-loss-banner"
      className="flex items-start gap-3 border-b border-danger-container bg-danger-container px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-label font-semibold text-on-danger-container">
          Your saved routes were cleared
        </p>
        <p className="mt-1 text-meta text-on-danger-container/80">
          The browser removed this app&apos;s stored data — this happens when storage runs out, or
          after a period without opening the app. Nothing was sent anywhere, so there is no copy to
          restore. Installing the app to your Home Screen makes the browser far more likely to
          protect it in future.
        </p>
      </div>
      <button
        type="button"
        onClick={acknowledge}
        aria-label="Dismiss"
        data-testid="data-loss-dismiss"
        className="min-h-touch w-8 shrink-0 text-row text-on-danger-container"
      >
        ×
      </button>
    </div>
  )
}
