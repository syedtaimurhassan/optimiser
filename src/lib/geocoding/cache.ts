/**
 * Geocoding result cache.
 *
 * Three jobs, in order of how much they matter:
 *
 *   1. **Protect a shared quota.** The API key is public and unrestricted, so
 *      every request we don't make is one a stranger can. Typing "Løvfrøvej"
 *      and backspacing to "Løvfrø" must not re-bill the prefix.
 *   2. Make the field feel instant on repeat queries — a driver searching the
 *      same street twice in a day is the normal case, not the edge case.
 *   3. Survive going offline for lookups already made.
 *
 * ── On the licence ────────────────────────────────────────────────────────
 *
 * Geoapify's terms are silent on caching, and the OSMF geocoding guideline
 * permits permanently storing geocoded results (attribution retained, which
 * `attribution` on each provider carries). That is what makes a 30-day TTL
 * defensible here. It would NOT be under LocationIQ's free plan, which caps
 * request-response caching at 48 hours — so if the provider is ever swapped,
 * `DEFAULT_TTL_MS` is the line to revisit, and it is a one-line change on
 * purpose.
 *
 * The store is injected rather than imported so this module stays testable
 * without IndexedDB, and so `lib/` keeps its no-ambient-I/O property.
 */

export interface CacheEntry<T> {
  key: string
  createdAt: number
  payload: T
}

/** The slice of a key-value store this cache needs. IndexedDB satisfies it. */
export interface CacheStore {
  get(key: string): Promise<CacheEntry<unknown> | undefined>
  put(entry: CacheEntry<unknown>): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
}

/** 30 days. See the licence note above before raising this. */
export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Beyond this many entries the oldest are dropped on the next write. */
export const DEFAULT_MAX_ENTRIES = 2000

export interface GeocodeCacheOptions {
  ttlMs?: number
  maxEntries?: number
  /** Injectable clock, so the TTL is testable without waiting 30 days. */
  now?: () => number
}

/**
 * Build the cache key for a query.
 *
 * Normalisation is what makes the cache earn its keep: "  Løvfrøvej 6 " and
 * "løvfrøvej 6" are the same question and must not cost two credits.
 *
 * The NFC pass handles a subtler case. Letters that are a base plus a combining
 * mark — "å" is a + U+030A, "é" is e + U+0301 — have two encodings that look
 * identical and compare unequal, and macOS filesystems have historically handed
 * out the decomposed form. So an address pasted from a CSV can miss the cache
 * for an address typed on a keyboard. (Note this does NOT apply to "ø" or "æ",
 * which have no canonical decomposition — they are single codepoints either way.)
 */
export function cacheKey(
  providerId: string,
  kind: 'autocomplete' | 'reverse' | 'details',
  subject: string,
  variant = '',
): string {
  const normal = subject.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
  return `${providerId}:${kind}:${normal}${variant ? `|${variant}` : ''}`
}

/**
 * Round a coordinate before it becomes a cache key.
 *
 * Five decimal places is about 1.1 m at the equator — finer than any address
 * distinction and far finer than a dropped pin's precision, but coarse enough
 * that dragging a pin by a hair reuses the previous answer instead of spending
 * a credit on the same doorstep.
 */
export function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`
}

export interface GeocodeCache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, payload: T): Promise<void>
}

export function createGeocodeCache(
  store: CacheStore,
  opts: GeocodeCacheOptions = {},
): GeocodeCache {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES
  const now = opts.now ?? Date.now

  return {
    async get<T>(key: string): Promise<T | undefined> {
      let entry: CacheEntry<unknown> | undefined
      try {
        entry = await store.get(key)
      } catch {
        // A cache that throws must never break a search. Treat any storage
        // failure — private browsing, quota, a blocked upgrade — as a miss.
        return undefined
      }
      if (!entry) return undefined

      if (now() - entry.createdAt > ttlMs) {
        void store.delete(key).catch(() => {})
        return undefined
      }
      return entry.payload as T
    },

    async set<T>(key: string, payload: T): Promise<void> {
      try {
        await store.put({ key, createdAt: now(), payload })
        await trim(store, maxEntries)
      } catch {
        // Same reasoning as `get`: writing is best-effort.
      }
    },
  }
}

/**
 * Keep the store bounded.
 *
 * Deliberately naive — it reads the key list and drops the excess oldest-first
 * by creation time. At `DEFAULT_MAX_ENTRIES` that is a few thousand keys, which
 * is nothing, and the alternative (a timestamp index) is schema surface for a
 * problem this app does not have.
 */
async function trim(store: CacheStore, maxEntries: number): Promise<void> {
  const keys = await store.keys()
  if (keys.length <= maxEntries) return

  const entries: CacheEntry<unknown>[] = []
  for (const k of keys) {
    const e = await store.get(k)
    if (e) entries.push(e)
  }
  entries.sort((a, b) => a.createdAt - b.createdAt)
  for (const e of entries.slice(0, entries.length - maxEntries)) {
    await store.delete(e.key)
  }
}

/** An in-memory `CacheStore`. Used by tests, and as the fallback when IndexedDB is unavailable. */
export function createMemoryCacheStore(): CacheStore {
  const map = new Map<string, CacheEntry<unknown>>()
  return {
    async get(key) {
      return map.get(key)
    },
    async put(entry) {
      map.set(entry.key, entry)
    },
    async delete(key) {
      map.delete(key)
    },
    async keys() {
      return [...map.keys()]
    },
  }
}
