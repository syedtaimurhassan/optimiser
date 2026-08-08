/**
 * Composition root for geocoding.
 *
 * This is the only file that knows WHICH providers the app runs, where the key
 * comes from, and that the cache is backed by IndexedDB. Everything else — the
 * adapters, the service, the search screen — is written against interfaces and
 * can be tested with no network and no database.
 *
 * The singleton is lazy so that merely importing a type from this module does
 * not open a database connection or read configuration.
 */

import {
  deleteGeocache,
  getGeocache,
  getGeocacheKeys,
  putGeocache,
} from '../persistence/db.ts'
import { createGeocodeCache, createMemoryCacheStore, type CacheStore } from './cache.ts'
import { createGeoapifyProvider } from './geoapify.ts'
import { createPhotonProvider } from './photon.ts'
import { createGeocodingService, type GeocodingService } from './service.ts'

export * from './types.ts'
export * from './service.ts'
export { cacheKey, coordKey, createGeocodeCache, createMemoryCacheStore } from './cache.ts'
export { createGeoapifyProvider, GEOAPIFY_ID } from './geoapify.ts'
export { createPhotonProvider, PHOTON_ID } from './photon.ts'

/**
 * The Geoapify key.
 *
 * It ships in the bundle, in the clear, and is NOT referrer-restricted — the
 * dashboard offered no way to restrict it. This is a deliberate, accepted risk
 * rather than an oversight, and the design compensates for it rather than
 * pretending otherwise:
 *
 *   - the free tier has no billing overage, so an abused key degrades, never bills;
 *   - the cache and debounce keep our own consumption low;
 *   - Photon needs no key at all, so exhaustion is survivable.
 *
 * If a way to restrict it appears, restrict it — that removes the only reason
 * any of the above is load-bearing.
 */
function readApiKey(): string {
  // `import.meta.env` exists under Vite and is undefined under `node --test`,
  // which is why this is a guarded read and not a bare property access.
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.VITE_GEOAPIFY_KEY ?? ''
}

/** IndexedDB-backed cache storage, adapting the db layer to the cache's interface. */
function createIdbCacheStore(): CacheStore {
  return {
    get: (key) => getGeocache(key),
    put: (entry) => putGeocache(entry),
    delete: (key) => deleteGeocache(key),
    keys: () => getGeocacheKeys(),
  }
}

let singleton: GeocodingService | null = null

/**
 * The app's geocoding service.
 *
 * Falls back to a memory cache when IndexedDB is unavailable (private
 * browsing, a blocked upgrade) rather than failing — a search that works
 * without persistence beats a search that does not work.
 */
export function getGeocodingService(): GeocodingService {
  if (singleton) return singleton

  const apiKey = readApiKey()
  const fallback = createPhotonProvider()

  // No key configured is a legitimate state, not a crash: the app still
  // searches, permanently degraded, on the keyless provider. That keeps a fresh
  // clone with no .env usable instead of silently broken.
  const primary = apiKey ? createGeoapifyProvider(apiKey) : fallback

  let store: CacheStore
  try {
    store = createIdbCacheStore()
  } catch {
    store = createMemoryCacheStore()
  }

  singleton = createGeocodingService({
    primary,
    // Pointing the fallback at the primary would make failover a no-op loop.
    fallback: primary === fallback ? undefined : fallback,
    cache: createGeocodeCache(store),
  })
  return singleton
}

/** Test seam — drops the memoised service so a test can install its own. */
export function resetGeocodingService(): void {
  singleton = null
}
