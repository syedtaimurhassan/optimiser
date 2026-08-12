import { useEffect, useState } from 'react'
import { applyUpdate, isUpdateWaiting, onUpdateReady } from './registerSw'

/**
 * "A new version is ready" — as a piece of React state.
 *
 * The subscription lives in registerSw.ts rather than here because the
 * registration happens at boot, long before any component mounts, and an
 * update that landed during that gap must still be offered. This hook is only
 * the adapter.
 */
export function useSwUpdate(): { updateReady: boolean; update: () => void } {
  const [updateReady, setUpdateReady] = useState(isUpdateWaiting)

  useEffect(() => onUpdateReady(setUpdateReady), [])

  return { updateReady, update: applyUpdate }
}
