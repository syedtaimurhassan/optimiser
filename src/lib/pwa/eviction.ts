import { getMeta, setMeta } from '../persistence/db.ts'

/**
 * Did the browser throw the driver's data away?
 *
 * ── What is and is not detectable ─────────────────────────────────────────
 *
 * A full-origin eviction takes every script-writable store at once —
 * IndexedDB, Cache Storage, localStorage, the service worker registration. So
 * there is no marker that can survive to say "you had data and it is gone":
 * whatever we wrote to prove it dies with the thing it was proving. After a
 * complete wipe the app is, by construction, indistinguishable from a fresh
 * install, and any code claiming otherwise is lying.
 *
 * What IS detectable is a PARTIAL loss, and it is the common one in practice:
 * the Cache Storage shell survives while IndexedDB does not. That happens when
 * a quota error kills a database write, when an upgrade fails, or when a
 * driver clears "website data" through a path that does not take everything.
 * It is exactly the case that otherwise presents as a working app with an
 * empty route list — the failure mode this milestone exists to avoid, because
 * a driver who is shown an empty app assumes they are on the wrong device and
 * goes looking, rather than being told plainly that the data is gone.
 *
 * So: the shell cache is the "we have been here before" witness, and the meta
 * marker is the "and IndexedDB was intact" witness. One without the other is a
 * loss worth reporting.
 */

/** Written once the app has real data. Its ABSENCE beside a shell cache is the signal. */
const MARKER_KEY = 'pwa:knownGood'

/**
 * Pure decision, so the truth table is a test rather than a device session.
 *
 * The asymmetry is deliberate. A marker with no shell cache is NOT a loss —
 * that is simply a browser that dropped the caches (or a build where the
 * worker never registered), and the data it is about is still there.
 */
export function isDataLoss({
  hasShellCache,
  hasMarker,
}: {
  hasShellCache: boolean
  hasMarker: boolean
}): boolean {
  return hasShellCache && !hasMarker
}

/** True when a shell cache from some earlier visit is still around. */
async function hasShellCache(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false
    return (await caches.keys()).some((n) => n.startsWith('optimiser-shell'))
  } catch {
    return false
  }
}

/**
 * Record that IndexedDB currently holds data worth remembering.
 *
 * Called after hydration, and only when there is something to lose. Writing it
 * unconditionally would set the marker on a first run and permanently disarm
 * the check.
 */
export async function markKnownGood(): Promise<void> {
  try {
    if ((await getMeta<number>(MARKER_KEY)) === undefined) await setMeta(MARKER_KEY, Date.now())
  } catch {
    // Best-effort. A marker we could not write is a check that does not fire,
    // which is the safe direction: it under-reports rather than crying wolf.
  }
}

/**
 * Whether data was lost since the last visit.
 *
 * Deliberately quiet on every error path. This is a diagnostic; a diagnostic
 * that can break the boot is worse than no diagnostic.
 */
export async function detectDataLoss(): Promise<boolean> {
  try {
    const [shell, marker] = await Promise.all([
      hasShellCache(),
      getMeta<number>(MARKER_KEY).catch(() => undefined),
    ])
    return isDataLoss({ hasShellCache: shell, hasMarker: marker !== undefined })
  } catch {
    return false
  }
}

/** Forget the marker, so a driver who has been told once is not told forever. */
export async function clearDataLossMarker(): Promise<void> {
  try {
    await setMeta(MARKER_KEY, Date.now())
  } catch {
    // As above.
  }
}
