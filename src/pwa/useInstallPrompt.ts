import { useEffect, useState } from 'react'
import { canPromptToInstall, promptToInstall, subscribeInstallPrompt } from './installPrompt'

/**
 * The captured install prompt, as React state.
 *
 * The capture itself is a module-level singleton started at boot — see
 * installPrompt.ts for why it cannot live in a hook. This is only the adapter.
 */
export function useInstallPrompt(): {
  canPrompt: boolean
  promptToInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
} {
  const [canPrompt, setCanPrompt] = useState(canPromptToInstall)

  useEffect(() => subscribeInstallPrompt(setCanPrompt), [])

  return { canPrompt, promptToInstall }
}
