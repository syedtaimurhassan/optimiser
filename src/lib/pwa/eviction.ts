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
 * What IS detectable is a PARTIAL loss, and it is the common one: Cache
 * Storage survives while IndexedDB does not. That happens when a quota error
 * kills a database write, when an upgrade fails, or when storage is cleared
 * through a path that does not take everything. It is exactly the case that
 * otherwise presents as a working app with an empty route list — and a driver
 * shown an empty app does not conclude "evicted", they conclude they are on
 * the wrong phone and lose the morning looking.
 *
 * ── Why the witness is in Cache Storage and not IndexedDB ─────────────────
 *
 * This is the correction to the first attempt, and the M14 smoke test is what
 * caught it. The witness was a row in IndexedDB's `meta` store, checked
 * against the presence of a shell cache. Both halves were wrong:
 *
 *   - The shell cache is created on the FIRST visit, before any data has ever
 *     existed. So "a shell cache exists" never meant "we had data before", and
 *     every user with an empty route was told their data had been cleared on
 *     their second launch.
 *   - A witness inside IndexedDB is destroyed by the very event it exists to
 *     report, so it could never have detected the case it was written for.
 *
 * The witness therefore lives in its own cache — a different storage bucket
 * from the data, which is precisely what makes a partial loss visible — and is
 * written only once there is something to lose.
 */

/** Its own cache, so clearing the shell or the tiles cannot disarm the check. */
const WITNESS_CACHE = 'optimiser-witness'
const WITNESS_URL = 'witness/had-data'

/**
 * Pure decision, so the truth table is a test rather than a device session.
 *
 * Deliberately says nothing about WHEN it is asked. The caller must ask at
 * boot, before the driver has had a chance to empty a route themselves —
 * emptying a round on purpose produces the same two values as an eviction, and
 * only the timing tells them apart. `useDataLoss` owns that ordering.
 */
export function isDataLoss({
  hasWitness,
  hasData,
}: {
  hasWitness: boolean
  hasData: boolean
}): boolean {
  return hasWitness && !hasData
}

async function witnessCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    return await caches.open(WITNESS_CACHE)
  } catch {
    return null
  }
}

/** True when an earlier session recorded that there was data worth keeping. */
export async function hasWitness(): Promise<boolean> {
  const cache = await witnessCache()
  if (!cache) return false
  try {
    return (await cache.match(WITNESS_URL)) !== undefined
  } catch {
    return false
  }
}

/**
 * Record that there is now data worth keeping.
 *
 * Only ever called when routes actually hold stops. Writing it unconditionally
 * would set it on a first run and turn the check into a permanent false alarm.
 */
export async function setWitness(): Promise<void> {
  const cache = await witnessCache()
  try {
    await cache?.put(WITNESS_URL, new Response(String(Date.now())))
  } catch {
    // Best-effort. A witness we could not write is a check that does not fire,
    // which is the safe direction: it under-reports rather than crying wolf.
  }
}

/**
 * Forget it — the driver emptied the app themselves, or has been told once.
 *
 * Without this, deliberately clearing every stop would look identical to an
 * eviction on the next launch.
 */
export async function clearWitness(): Promise<void> {
  const cache = await witnessCache()
  try {
    await cache?.delete(WITNESS_URL)
  } catch {
    // As above.
  }
}
