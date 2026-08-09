import { useEffect, useState } from 'react'
import { useSyncStore } from '../store/syncStore'
import { useRoutesStore } from '../store/routesStore'

/**
 * The quiet answer to "is my work safe".
 *
 * ── Calm means calm ───────────────────────────────────────────────────────
 *
 * This sits over a map a driver is reading at a kerb, so it earns its pixels
 * three ways. It is one line. It never animates. And it uses the same colour
 * discipline the rest of the app does — red only for something the driver can
 * and should act on.
 *
 * There are exactly three things it can say:
 *
 *   Not saved      Red. Storage is full or blocked, and the ticks being made
 *                  right now are not being kept. Actionable, and the only
 *                  state worth alarming about.
 *   Offline        Amber, and the important half is the second clause: work
 *                  IS being saved, on the device. Without that, "offline" on
 *                  a phone reads as "nothing you do now counts".
 *   Saved HH:MM    Neutral. Persistent rather than a flash, because the value
 *                  is in being able to look down and check, which a toast
 *                  that vanished four minutes ago cannot answer.
 *
 * The estimated-times note rides along with the offline state rather than
 * getting a state of its own — a route planned on straight lines while offline
 * is one fact, not two.
 */

const clock = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

export function SyncPill() {
  const online = useSyncStore((s) => s.online)
  const savedAt = useSyncStore((s) => s.savedAt)
  const saveError = useSyncStore((s) => s.saveError)
  const estimatedRoutes = useSyncStore((s) => s.estimatedRoutes)
  const activeRouteId = useRoutesStore((s) => s.activeRouteId)

  // `savedAt` is a timestamp, so the label goes stale on its own. Re-render it
  // once a minute rather than on a timer per second: the pill shows a clock
  // time, and a clock time only changes that often.
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const estimated = activeRouteId !== null && estimatedRoutes.has(activeRouteId)

  let tone = 'border-slate-200 bg-white/95 text-on-surface-variant'
  let label: string

  if (saveError) {
    tone = 'border-danger bg-danger-container text-on-danger-container'
    label = 'Not saved — this device is out of storage'
  } else if (!online) {
    tone = 'border-amber-300 bg-amber-50 text-amber-900'
    label = estimated
      ? 'Offline — saved on this device, times are estimates'
      : 'Offline — saved on this device'
  } else if (estimated) {
    label = 'Estimated times — reoptimise to refresh'
  } else {
    label = savedAt ? `Saved ${clock(savedAt)}` : 'Saved on this device'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto mx-3 mt-2 inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-label shadow-sm ${tone}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          saveError ? 'bg-danger' : online ? 'bg-emerald-500' : 'bg-amber-500'
        }`}
      />
      {label}
    </div>
  )
}
