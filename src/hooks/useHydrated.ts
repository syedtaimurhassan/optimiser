import { useEffect, useState } from 'react'
import { hydrateRoutesStore, useRoutesStore } from '../store/routesStore'

/**
 * True once the persisted state has been read back from IndexedDB.
 *
 * The whole reason this exists: IndexedDB is async, so between first paint and
 * rehydration the store legitimately holds its initial empty state. Rendering
 * that would flash "0 stops" at a user who has 107, then snap. Gate on this and
 * show a loading state instead.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useRoutesStore.persist.hasHydrated())

  useEffect(() => {
    let cancelled = false

    // Fires even when rehydration finished before this effect ran.
    const unsub = useRoutesStore.persist.onFinishHydration(() => {
      if (!cancelled) setHydrated(true)
    })

    void hydrateRoutesStore().then(() => {
      if (!cancelled) setHydrated(true)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return hydrated
}
