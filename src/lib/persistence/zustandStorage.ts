import type { StateStorage } from 'zustand/middleware'
import { getDb, getMeta, setMeta } from './db'

/**
 * A Zustand `StateStorage` backed by IndexedDB.
 *
 * The shape Zustand wants is get/set/remove over strings, which IndexedDB can
 * serve — the difference is that every call is async. `persist` already awaits
 * these, so the store itself stays fully synchronous to read; only rehydration
 * is deferred, which is what `usePersistenceReady` exists to gate on.
 *
 * State blobs live in `meta` under their persist key. They are small by
 * construction: photos and cost matrices are in their own object stores and are
 * referenced by key, never inlined. If a state blob ever gets large, something
 * has leaked into it that shouldn't be there.
 */

/** How many bytes a persisted state blob may reach before we complain. */
const BLOB_WARN_BYTES = 512 * 1024

export const indexedDbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await getMeta<string>(name)) ?? null
    } catch (e) {
      // A read failure must not stop the app booting — it starts empty instead.
      console.error('[persist] read failed; starting with empty state', e)
      return null
    }
  },

  setItem: async (name, value) => {
    try {
      if (value.length > BLOB_WARN_BYTES) {
        console.warn(
          `[persist] state blob for "${name}" is ${(value.length / 1024).toFixed(0)} KB. ` +
            'Blobs and matrices belong in their own object stores, referenced by key.',
        )
      }
      await setMeta(name, value)
    } catch (e) {
      // Most likely a quota error. Surfacing it beats silently losing writes.
      console.error('[persist] write failed', e)
      throw e
    }
  },

  removeItem: async (name) => {
    try {
      const db = await getDb()
      await db.delete('meta', name)
    } catch (e) {
      console.error('[persist] delete failed', e)
    }
  },
}
