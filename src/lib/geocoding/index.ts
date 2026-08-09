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
 * It ships in the bundle, in the clear, and — since some point between M6 and
 * M12 — it is origin-restricted. M6 said otherwise and M6 is now wrong: a live
 * check in M12 gets 401 `Not allowed` for a foreign `Origin` and 200 for ours.
 *
 * So the failover below is no longer the thing standing between us and a
 * stranger spending our quota. It is still worth having for the ordinary
 * reasons — the free tier runs out, and a request from a browser with no
 * network reaches nobody — but the risk M6 accepted has largely closed itself.
 *
 * `http://localhost:5173` is not on the allowlist, so `npm run dev` searches
 * on Photon. See the note in geoapify.ts.
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
