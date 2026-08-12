/**
 * What the browser is promising about the driver's data, in words they can act
 * on.
 *
 * Framework-free: no React, no store. Everything here is a pure function of an
 * estimate the caller already has, so the arithmetic is testable without a
 * browser and the wording lives in one place.
 *
 * ── Why this matters more than it looks ───────────────────────────────────
 *
 * Every route, every delivered mark and every photo is in IndexedDB on the
 * phone and nowhere else. There is no server to re-sync from — that is the
 * project's central constraint, not an omission — so an eviction is not a
 * cache miss, it is the day's work gone.
 *
 * WebKit's storage policy says an origin is excluded from eviction if "its
 * storage is in persistent mode", and that it "grants a request based on
 * heuristics like whether the website is opened as a Home Screen Web App". So
 * on iOS the chain is: install → persist() is granted → the data is safe.
 * That is the honest reason to invite someone to install, and it is why the
 * install card and this module say the same thing.
 */

export interface StorageEstimate {
  usage: number | null
  quota: number | null
}

/** How close to the ceiling, and whether anyone should be told. */
export type StoragePressure = 'unknown' | 'fine' | 'warn' | 'critical'

/**
 * Warn at 80%, shout at 95%.
 *
 * Deliberately not tighter. A browser's quota is a moving target — it is a
 * fraction of free disk, so it shrinks when the driver installs a game — and a
 * warning that fires at 60% on a full phone is one that gets ignored by the
 * time it means something.
 */
export const WARN_AT = 0.8
export const CRITICAL_AT = 0.95

export function pressureOf(estimate: StorageEstimate | null | undefined): StoragePressure {
  if (!estimate) return 'unknown'
  const { usage, quota } = estimate
  // A quota of 0 is not "full" — it is a browser declining to answer, which
  // Safari does in private browsing. Treating it as 100% would put a red
  // warning in front of someone whose storage is fine.
  if (usage === null || quota === null || quota <= 0) return 'unknown'

  const ratio = usage / quota
  if (ratio >= CRITICAL_AT) return 'critical'
  if (ratio >= WARN_AT) return 'warn'
  return 'fine'
}

/** Fraction used, or null when the browser will not say. */
export function fractionUsed(estimate: StorageEstimate | null | undefined): number | null {
  if (!estimate) return null
  const { usage, quota } = estimate
  if (usage === null || quota === null || quota <= 0) return null
  return Math.min(1, usage / quota)
}

/**
 * Bytes, at the precision a person reads rather than the one a machine stores.
 *
 * Decimal units (MB, not MiB) because that is what a phone's own storage
 * screen shows, and a driver comparing the two should not find them disagreeing
 * by 5%.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1000) return `${Math.round(bytes)} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  // One decimal below 100, none above: "1.4 GB" and "847 MB" both read at a
  // glance; "1.43 GB" and "847.2 MB" do not.
  return `${value < 100 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

/**
 * The sentence to put under the storage row.
 *
 * Written so that the good case is short and the bad case is specific. A
 * driver who is fine should be able to stop reading after four words; a driver
 * who is not needs to know what to delete.
 */
export function describeStorage(
  estimate: StorageEstimate | null | undefined,
  persisted: boolean,
): string {
  const pressure = pressureOf(estimate)

  if (pressure === 'critical') {
    return 'Almost full. Delete old routes and their photos, or the browser will start dropping data.'
  }
  if (pressure === 'warn') {
    return 'Getting full. Completed routes and their photos are the biggest thing you can clear.'
  }
  if (!persisted) {
    // The honest version. `persist()` returning false is a normal outcome, not
    // an error — Safari ties it to engagement and grants it silently later —
    // so this says what would happen rather than that something is wrong.
    return 'Not protected yet. If you go a week without opening the app, the browser may clear your routes.'
  }
  return 'Protected. The browser has been asked not to clear your routes, and agreed.'
}
