import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/**
 * IndexedDB access layer. Framework-free — no React, no Zustand.
 *
 * Why we left localStorage: it caps around 5 MB, is synchronous (so every write
 * blocks the main thread), and stores strings only. We are heading towards
 * photos and cached cost matrices, neither of which fits that shape.
 *
 * The rule this file exists to enforce: **blobs and matrices never enter the
 * Zustand state blob.** They live in their own object stores, keyed, and state
 * holds only the key. Otherwise every keystroke would re-serialise a megabyte
 * of JPEG.
 */

export const DB_NAME = 'route-optimiser'

/**
 * Bump when the object-store layout or the persisted state shape changes.
 *   3 — M1: initial IndexedDB layout, migrated from localStorage "route-optimiser:v2"
 *   4 — M2: multi-route model with addressed stops and immutable stop IDs
 *   5 — M6: `geocache` store for geocoding results
 *
 * 4 → 5 adds a store and touches no existing data, so it needs no entry in
 * migrate.ts — the structural `upgrade` below is the whole migration.
 */
export const SCHEMA_VERSION = 5

/**
 * The key the Zustand `persist` blob lives under, inside the `meta` store.
 *
 * Intentionally the same string the old localStorage key used: the blob FORMAT
 * is unchanged in M1, only its location. That's what lets the migration relocate
 * a legacy session byte-for-byte and have it rehydrate exactly as before.
 */
export const STATE_PERSIST_KEY = 'route-optimiser:v2'

/**
 * Where the M2 multi-route store persists. A NEW key rather than a reuse of
 * STATE_PERSIST_KEY: the v2 blob is kept intact as the 3 → 4 migration's source
 * and as a rollback path, so overwriting it would destroy the very thing the
 * migration reads.
 */
export const ROUTES_PERSIST_KEY = 'route-optimiser:routes:v4'

/** Placeholder row shape. M2 replaces this with the real model. */
export interface RouteRow {
  id: string
  /** Calendar day this route belongs to, ISO yyyy-mm-dd. Indexed. */
  dateISO: string
  name: string
  createdAt: number
  updatedAt: number
  /**
   * The migrated session payload. Deliberately loose in M1: M1 must not invent
   * the data model, and M2 will restructure this into typed columns.
   */
  payload: unknown
}

export interface MatrixRow {
  cacheKey: string
  createdAt: number
  /** Flat integer cost matrix + its dimension, so it round-trips cheaply. */
  n: number
  costs: Int32Array | number[]
  objective: 'duration' | 'distance'
}

export interface PhotoRow {
  ref: string
  blob: Blob
  createdAt: number
  stopId?: string
}

export interface FavoriteRow {
  id: string
  name: string
  payload: unknown
}

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * A cached geocoding response. `payload` is deliberately `unknown`: this store
 * holds autocomplete lists, reverse-geocoded addresses and place details, and
 * teaching the DB layer those shapes would couple it to the geocoding module.
 * lib/geocoding/cache.ts owns the interpretation.
 */
export interface GeocacheRow {
  key: string
  createdAt: number
  payload: unknown
}

interface OptimiserDB extends DBSchema {
  routes: { key: string; value: RouteRow; indexes: { dateISO: string } }
  matrices: { key: string; value: MatrixRow }
  photos: { key: string; value: PhotoRow }
  favorites: { key: string; value: FavoriteRow }
  meta: { key: string; value: MetaRow }
  geocache: { key: string; value: GeocacheRow }
}

let dbPromise: Promise<IDBPDatabase<OptimiserDB>> | null = null

/**
 * Open (and upgrade) the database. Idempotent — the connection is memoised.
 *
 * `upgrade` must stay purely structural: creating stores and indexes only. Data
 * migration happens in migrate.ts, after the connection is open, because an
 * upgrade transaction cannot await anything without deadlocking.
 */
export function getDb(): Promise<IDBPDatabase<OptimiserDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OptimiserDB>(DB_NAME, SCHEMA_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('routes')) {
          const routes = db.createObjectStore('routes', { keyPath: 'id' })
          routes.createIndex('dateISO', 'dateISO')
        }
        if (!db.objectStoreNames.contains('matrices')) {
          db.createObjectStore('matrices', { keyPath: 'cacheKey' })
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'ref' })
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('geocache')) {
          db.createObjectStore('geocache', { keyPath: 'key' })
        }
        void oldVersion // M2 will branch on this for the 3 → 4 migration.
      },
      blocked() {
        console.warn('[db] upgrade blocked by another tab holding an old version')
      },
      blocking() {
        // Another tab wants to upgrade; drop our connection so it can proceed
        // rather than deadlocking both tabs.
        console.warn('[db] closing connection so another tab can upgrade')
        void dbPromise?.then((db) => db.close())
        dbPromise = null
      },
    }).catch((e) => {
      dbPromise = null
      throw e
    })
  }
  return dbPromise
}

// ------------------------------------------------------------------- meta

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get('meta', key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value })
}

// ----------------------------------------------------------------- routes

export async function putRoute(row: RouteRow): Promise<void> {
  const db = await getDb()
  await db.put('routes', row)
}

export async function getRoute(id: string): Promise<RouteRow | undefined> {
  const db = await getDb()
  return db.get('routes', id)
}

export async function getAllRoutes(): Promise<RouteRow[]> {
  const db = await getDb()
  return db.getAll('routes')
}

export async function getRoutesByDate(dateISO: string): Promise<RouteRow[]> {
  const db = await getDb()
  return db.getAllFromIndex('routes', 'dateISO', dateISO)
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('routes', id)
}

// --------------------------------------------------------------- matrices

export async function putMatrix(row: MatrixRow): Promise<void> {
  const db = await getDb()
  await db.put('matrices', row)
}

export async function getMatrix(cacheKey: string): Promise<MatrixRow | undefined> {
  const db = await getDb()
  return db.get('matrices', cacheKey)
}

// ----------------------------------------------------------------- photos

export async function putPhoto(ref: string, blob: Blob, stopId?: string): Promise<void> {
  const db = await getDb()
  await db.put('photos', { ref, blob, createdAt: Date.now(), stopId })
}

export async function getPhoto(ref: string): Promise<Blob | undefined> {
  const db = await getDb()
  return (await db.get('photos', ref))?.blob
}

export async function deletePhoto(ref: string): Promise<void> {
  const db = await getDb()
  await db.delete('photos', ref)
}

// --------------------------------------------------------------- geocache

export async function getGeocache(key: string): Promise<GeocacheRow | undefined> {
  const db = await getDb()
  return db.get('geocache', key)
}

export async function putGeocache(row: GeocacheRow): Promise<void> {
  const db = await getDb()
  await db.put('geocache', row)
}

export async function deleteGeocache(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('geocache', key)
}

export async function getGeocacheKeys(): Promise<string[]> {
  const db = await getDb()
  return db.getAllKeys('geocache')
}

/** Drop every cached geocoding result. Exposed through the diagnostics panel. */
export async function clearGeocache(): Promise<void> {
  const db = await getDb()
  await db.clear('geocache')
}

// -------------------------------------------------------------- diagnostics

/** Row counts per store — for the diagnostics panel. */
export async function describeDb(): Promise<Record<string, number>> {
  const db = await getDb()
  const out: Record<string, number> = {}
  for (const name of ['routes', 'matrices', 'photos', 'favorites', 'meta', 'geocache'] as const) {
    out[name] = await db.count(name)
  }
  return out
}
