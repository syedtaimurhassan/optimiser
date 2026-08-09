import { create } from 'zustand'
import { getReachability } from '../lib/net/reachability'
import { observePersistence } from '../lib/persistence/zustandStorage'

/**
 * "Is my work safe, and is the network there."
 *
 * ── What sync means in an app with no server ──────────────────────────────
 *
 * Nothing is uploaded anywhere, ever — that is the project's central
 * constraint, not an omission. So there is no upload queue to drain and no
 * conflict to resolve. What a driver in a dead zone actually needs to know is
 * narrower and more useful:
 *
 *   1. **Did my delivered marks get written?** They did, to IndexedDB, and the
 *      promise resolving is the moment they became durable. A quota error is
 *      the moment they did not, and that is worth shouting about because the
 *      driver can still act on it.
 *   2. **Am I going to get real road times, or estimates?** Offline, the app
 *      still plans — see `buildCostGrid` — but on straight-line guesses. That
 *      is a different promise from the one a route made this morning, and the
 *      driver should not have to infer it from a slightly odd ETA.
 *
 * Spoke shows neither. A driver whose phone has been in a tunnel for ten
 * minutes has no way to tell whether the last hour of ticking things off
 * survived.
 *
 * ── Why this is not in routesStore ────────────────────────────────────────
 *
 * None of it is route data. It is a property of the device and the moment, it
 * must never be persisted (a "saved 4 minutes ago" restored from disk is a
 * lie), and routesStore is behind the persist middleware.
 */

export interface SyncState {
  /** Best available answer, from real request outcomes rather than the OS. */
  online: boolean
  /** When the last state write landed, or null if none has yet this session. */
  savedAt: number | null
  /** The last write FAILED. Almost always storage quota. */
  saveError: string | null
  /** The open route was last planned on estimated arcs. */
  estimatedRoutes: Set<string>

  setOnline: (online: boolean) => void
  recordSave: (at: number, error?: string) => void
  markEstimated: (routeId: string, estimated: boolean) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  online: true,
  savedAt: null,
  saveError: null,
  estimatedRoutes: new Set(),

  setOnline: (online) => set({ online }),
  recordSave: (at, error) =>
    set(error ? { saveError: error } : { savedAt: at, saveError: null }),
  markEstimated: (routeId, estimated) =>
    set((state) => {
      if (state.estimatedRoutes.has(routeId) === estimated) return state
      const next = new Set(state.estimatedRoutes)
      if (estimated) next.add(routeId)
      else next.delete(routeId)
      return { estimatedRoutes: next }
    }),
}))

let started = false

/**
 * Attach the two signals to the store. Idempotent; called once at boot.
 *
 * Deliberately not a hook. Both sources are module-level and long-lived, and
 * subscribing from a component would mean the app forgets it is offline the
 * moment that component unmounts.
 */
export function startSyncWatchers(): () => void {
  if (started) return () => {}
  started = true

  const reachability = getReachability()
  useSyncStore.getState().setOnline(reachability.online)
  const stopReachability = reachability.subscribe((online) => {
    useSyncStore.getState().setOnline(online)
  })

  const stopPersistence = observePersistence(({ at, saved, error }) => {
    useSyncStore.getState().recordSave(at, saved ? undefined : (error ?? 'Could not save'))
  })

  return () => {
    stopReachability()
    stopPersistence()
    started = false
  }
}
