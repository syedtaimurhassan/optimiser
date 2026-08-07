import {
  getDb,
  getMeta,
  setMeta,
  SCHEMA_VERSION,
  STATE_PERSIST_KEY,
  ROUTES_PERSIST_KEY,
  type RouteRow,
} from './db'
import { migrateSessionToV4, type LegacySessionV3 } from './migrateV4'

/**
 * Schema migration chain.
 *
 *   (nothing)  →  3   M1: legacy localStorage session copied into IndexedDB
 *   3          →  4   M2: multi-route model, addressed stops, immutable stop IDs
 *
 * Three properties, in order of importance:
 *
 *  1. **Never block boot.** Every failure path ends with the app starting on an
 *     empty database, never with a crash. A user who loses their stops is
 *     unhappy; a user who cannot open the app at all is stuck.
 *  2. **Idempotent.** Guarded by `meta.schemaVersion` and written inside the
 *     same transaction as the data, so an interrupted run simply repeats.
 *  3. **Never destroy the source.** The legacy localStorage key and the M1
 *     `routes` row are both KEPT. M15 deletes the localStorage key, once you
 *     have confirmed nothing was lost.
 */

export const LEGACY_KEY = 'route-optimiser:v2'
export const LEGACY_BACKUP_KEY = 'route-optimiser:v2.backup'
export const SCHEMA_VERSION_KEY = 'schemaVersion'

export type MigrationOutcome =
  | { status: 'not-needed'; reason: string }
  | { status: 'migrated'; routeId: string; stopCount: number; fromVersion: number | null; toVersion: number }
  | { status: 'failed'; error: string; backupKept: boolean }

/** Zustand's persist wraps state as `{ state, version }`; tolerate both shapes. */
function unwrap(raw: string): LegacySessionV3 | null {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') return null
  const maybe = parsed as { state?: unknown }
  const state = maybe.state && typeof maybe.state === 'object' ? maybe.state : parsed
  return state as LegacySessionV3
}

const todayISO = (): string => new Date().toISOString().slice(0, 10)

const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function readLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Safari in private mode can throw on localStorage access.
    return null
  }
}

/** Run any outstanding migrations. Returns an outcome; never throws. */
export async function migrateLegacyIfNeeded(): Promise<MigrationOutcome> {
  try {
    const from = await getMeta<number>(SCHEMA_VERSION_KEY)

    if (from === SCHEMA_VERSION) {
      return { status: 'not-needed', reason: `schemaVersion already ${from}` }
    }

    // Where does the legacy session live? Either still in localStorage (never
    // migrated), or in the M1 `routes` row (migrated to 3 but not yet to 4).
    let session: LegacySessionV3 | null = null
    let rawLegacy: string | null = null

    if (from === undefined) {
      rawLegacy = readLocalStorage(LEGACY_KEY)
      if (rawLegacy) session = unwrap(rawLegacy)
    } else if (from === 3) {
      const db = await getDb()
      const rows = await db.getAll('routes')
      // M1 wrote exactly one row, carrying the legacy payload verbatim.
      const payload = (rows[0] as RouteRow | undefined)?.payload
      if (payload && typeof payload === 'object') session = payload as LegacySessionV3
    }

    if (!session) {
      // Fresh install, or a payload we can't read. Stamp the version so we
      // don't re-attempt on every boot, and start clean.
      await setMeta(SCHEMA_VERSION_KEY, SCHEMA_VERSION)
      return {
        status: 'not-needed',
        reason: from === undefined ? 'no legacy payload to migrate' : `nothing to carry from v${from}`,
      }
    }

    const routeId = newId()
    const migrated = migrateSessionToV4(session, {
      routeId,
      dateISO: todayISO(),
      nowMs: Date.now(),
      makeId: newId,
      name: 'Imported session',
    })

    // The shape Zustand's persist middleware expects to read back.
    const blob = JSON.stringify({
      state: {
        routes: migrated.routes,
        activeRouteId: migrated.activeRouteId,
        favorites: migrated.favorites,
        stopIdMode: migrated.stopIdMode,
      },
      version: 4,
    })

    const db = await getDb()
    const tx = db.transaction(['routes', 'favorites', 'meta'], 'readwrite')

    // Keep an M1-style row too, so the DB's own `routes` store stays a truthful
    // index of what exists. M3's route list reads from the Zustand blob; this
    // row is what a future non-Zustand reader would use.
    const route = migrated.routes[routeId]
    await tx.objectStore('routes').put({
      id: routeId,
      dateISO: route.dateISO,
      name: route.name,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      payload: route,
    } satisfies RouteRow)

    // Favorites live in the Zustand blob (that is what the app reads) AND in
    // their own object store, so the database is a truthful index of what
    // exists rather than an opaque blob a future reader can't interpret.
    for (const fav of migrated.favorites) {
      await tx.objectStore('favorites').put({ id: fav.id, name: fav.name, payload: fav })
    }

    await tx.objectStore('meta').put({ key: ROUTES_PERSIST_KEY, value: blob })

    // Preserve the v2 blob under its original key as well, on the 3-path where
    // it was already relocated. Harmless if it isn't there.
    if (rawLegacy) {
      await tx.objectStore('meta').put({ key: STATE_PERSIST_KEY, value: rawLegacy })
    }

    // Written in the SAME transaction as the data, so a crash midway leaves the
    // version unset and the migration simply runs again.
    await tx.objectStore('meta').put({ key: SCHEMA_VERSION_KEY, value: SCHEMA_VERSION })
    await tx.done

    // Source preserved deliberately. Removed in M15, not before.
    if (rawLegacy) {
      try {
        localStorage.setItem(LEGACY_BACKUP_KEY, rawLegacy)
      } catch {
        // A failed backup copy isn't worth failing the migration over — the
        // original key is untouched, which is the real backup.
      }
    }

    return {
      status: 'migrated',
      routeId,
      stopCount: route.stops.length,
      fromVersion: from ?? null,
      toVersion: SCHEMA_VERSION,
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[migrate] failed; starting with an empty database', e)
    return { status: 'failed', error, backupKept: readLocalStorage(LEGACY_KEY) !== null }
  }
}

/** Best-effort record of the outcome, for diagnostics. Never throws. */
export async function recordMigrationOutcome(outcome: MigrationOutcome): Promise<void> {
  try {
    await setMeta('lastMigration', { ...outcome, at: new Date().toISOString() })
  } catch {
    /* diagnostics only */
  }
}
