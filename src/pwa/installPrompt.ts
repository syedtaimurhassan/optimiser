/**
 * Chromium's install prompt, captured at boot and held for whoever needs it.
 *
 * ── Why this is a module and not a hook's local state ─────────────────────
 *
 * `beforeinstallprompt` fires ONCE, early, and only the listeners attached at
 * that moment ever see it. A hook that attaches on mount therefore works for
 * whatever happens to be on screen at page load and silently fails everywhere
 * else — in particular the Settings row, which is the whole point of the
 * invitation being "re-findable" after a dismissal. Capturing once at boot and
 * letting components subscribe is what makes the event available to a screen
 * the driver opens two minutes later.
 *
 * `beforeinstallprompt` is not in the DOM lib because it is not a standard: no
 * WebKit browser fires it and Firefox does not either. It is typed here, once,
 * in the open, rather than cast at each call site.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = (canPrompt: boolean) => void

const listeners = new Set<Listener>()
let deferred: BeforeInstallPromptEvent | null = null

function publish(): void {
  for (const listener of listeners) listener(deferred !== null)
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function canPromptToInstall(): boolean {
  return deferred !== null
}

/** Attached at boot, beside the service worker registration. */
export function watchInstallPrompt(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppresses Chromium's mini-infobar, which is small, easy to miss and has
    // no room to say WHY installing matters. We replay it beside a loaded
    // round instead, with the reason attached.
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    publish()
  })

  // Fires whether the install came from our button or the browser's own menu.
  window.addEventListener('appinstalled', () => {
    deferred = null
    publish()
  })
}

/**
 * Show it. Single-use by specification — once `prompt()` has resolved the same
 * event cannot be replayed — so it is dropped afterwards whatever the driver
 * chose. A button that silently does nothing on a second tap is worse than no
 * button, which is why `canPrompt` goes false here and the UI stops offering.
 */
export async function promptToInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  try {
    await deferred.prompt()
    return (await deferred.userChoice).outcome
  } catch {
    return 'unavailable'
  } finally {
    deferred = null
    publish()
  }
}
