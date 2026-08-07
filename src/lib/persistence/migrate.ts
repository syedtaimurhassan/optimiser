import {
  getDb,
  getMeta,
  setMeta,
  putRoute,
  SCHEMA_VERSION,
  STATE_PERSIST_KEY,
  type RouteRow,
} from './db'

/**
 * One-time migration of the legacy localStorage session into IndexedDB.
 *
 * Three properties this must have, in order of importance:
 *
 *  1. **It must never block boot.** Every failure path ends with the app
 *     starting on an empty database, never with a crash. A user who loses their
 *     stops is unhappy; a user who cannot open the app at all is stuck.
 *  2. **It must be idempotent.** Guarded by `meta.schemaVersion`, so a second
 *     run is a no-op even if the first was interrupted midway.
 *  3. **It must not destroy the source.** The old localStorage key is KEPT as a
 *     backup and copied to a `.backup` key. M15 deletes it, once the user has
 *     confirmed nothing was lost.
 */

export const LEGACY_KEY = 'route-optimiser:v2'
export const LEGACY_BACKUP_KEY = 'route-optimiser:v2.backup'
export const SCHEMA_VERSION_KEY = 'schemaVersion'

export type MigrationOutcome =
  | { status: 'not-needed'; reason: string }
  | { status: 'migrated'; routeId: string; stopCount: number }
  | { status: 'failed'; error: string; backupKept: boolean }

/** The bits of the v2 payload we care about. Everything else rides along in `payload`. */
interface LegacyV2State {
  waypoints?: Array<{ id?: string; num?: number; lat: number; lng: number; delivered?: boolean }>
  startLocation?: unknown
  endLocation?: unknown
  targetK?: number | null
  objective?: string
  optimizedRoute?: unknown
  favorites?: Array<{ id: string; name: string; [k: string]: unknown }>
  routeMode?: string
  searchQuality?: string
}

/** Zustand's persist wraps state as `{ state, version }`; tolerate both shapes. */
function unwrap(raw: string): LegacyV2State | null {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') return null
  const maybe = parsed as { state?: unknown }
  const state = maybe.state && typeof maybe.state === 'object' ? maybe.state : parsed
  return state as LegacyV2State
}

const todayISO = (): string => new Date().toISOString().slice(0, 10)

const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Run the migration if it hasn't run before.
 *
 * Returns an outcome rather than throwing: callers should record it (the
 * diagnostics panel shows it) and carry on regardless.
 */
export async function migrateLegacyIfNeeded(): Promise<MigrationOutcome> {
  try {
    const existing = await getMeta<number>(SCHEMA_VERSION_KEY)
    if (typeof existing === 'number') {
      return { status: 'not-needed', reason: `schemaVersion already ${existing}` }
    }

    let raw: string | null = null
    try {
      raw = localStorage.getItem(LEGACY_KEY)
    } catch {
      // Safari in private mode can throw on localStorage access.
      raw = null
    }

    if (!raw) {
      // Fresh install: nothing to migrate, but the DB is now at this version.
      await setMeta(SCHEMA_VERSION_KEY, SCHEMA_VERSION)
      return { status: 'not-needed', reason: 'no legacy localStorage payload' }
    }

    const state = unwrap(raw)
    if (!state) {
      await setMeta(SCHEMA_VERSION_KEY, SCHEMA_VERSION)
      return { status: 'not-needed', reason: 'legacy payload was not an object' }
    }

    const waypoints = Array.isArray(state.waypoints) ? state.waypoints : []

    // M1 does not invent the data model — M2 does. The whole legacy session
    // becomes ONE route row with its payload carried over verbatim, so nothing
    // is lost and M2 can restructure from complete information.
    const route: RouteRow = {
      id: newId(),
      dateISO: todayISO(),
      name: 'Imported session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        migratedFrom: LEGACY_KEY,
        startLocation: state.startLocation ?? null,
        endLocation: state.endLocation ?? null,
        waypoints,
        targetK: state.targetK ?? null,
        objective: state.objective ?? 'duration',
        optimizedRoute: state.optimizedRoute ?? null,
        routeMode: state.routeMode ?? 'fixed',
        searchQuality: state.searchQuality ?? 'deep',
      },
    }

    const db = await getDb()
    const tx = db.transaction(['routes', 'favorites', 'meta'], 'readwrite')
    await tx.objectStore('routes').put(route)

    // Relocate the state blob verbatim so Zustand rehydrates the user's live
    // session exactly as it was. The blob FORMAT is unchanged in M1 — only its
    // storage backend moved — so this is a copy, not a translation. Without it
    // the session would sit safely in `routes` while the UI came up empty.
    await tx.objectStore('meta').put({ key: STATE_PERSIST_KEY, value: raw })

    for (const fav of state.favorites ?? []) {
      if (fav && typeof fav.id === 'string') {
        await tx.objectStore('favorites').put({
          id: fav.id,
          name: typeof fav.name === 'string' ? fav.name : 'Saved route',
          payload: fav,
        })
      }
    }

    // Written inside the same transaction as the data, so a crash midway leaves
    // schemaVersion unset and the migration simply runs again.
    await tx.objectStore('meta').put({ key: SCHEMA_VERSION_KEY, value: SCHEMA_VERSION })
    await tx.done

    // Source preserved deliberately. Removed in M15, not before.
    try {
      localStorage.setItem(LEGACY_BACKUP_KEY, raw)
    } catch {
      // A failed backup copy is not worth failing the migration over — the
      // original key is still untouched, which is the real backup.
    }

    return { status: 'migrated', routeId: route.id, stopCount: waypoints.length }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[migrate] failed; starting with an empty database', e)
    let backupKept = false
    try {
      backupKept = localStorage.getItem(LEGACY_KEY) !== null
    } catch {
      backupKept = false
    }
    return { status: 'failed', error, backupKept }
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

export async function putRouteRow(row: RouteRow): Promise<void> {
  return putRoute(row)
}
