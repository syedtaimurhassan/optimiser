import type { Platform } from '../device/capabilities.ts'

/**
 * Whether to invite someone to install the app, and how.
 *
 * Framework-free and pure, so the policy can be argued about in tests rather
 * than discovered on a phone.
 *
 * ── The two routes ────────────────────────────────────────────────────────
 *
 * Android and desktop Chromium fire `beforeinstallprompt`, which we capture
 * and replay behind our own button — the browser's mini-infobar is easy to
 * miss and impossible to explain.
 *
 * Safari fires nothing and has no install API at all, so iOS gets a coach
 * mark: Share → Add to Home Screen. There is no way to shortcut it, and
 * pretending otherwise with a button that does nothing is worse than
 * instructions.
 */
export type InstallRoute = 'none' | 'prompt' | 'ios-manual'

export function installRoute({
  platform,
  standalone,
  hasPrompt,
}: {
  platform: Platform
  standalone: boolean
  hasPrompt: boolean
}): InstallRoute {
  // Already installed. Nothing to offer, on any platform.
  if (standalone) return 'none'
  if (hasPrompt) return 'prompt'
  // iOS only. On Android an absent prompt means the browser has decided the
  // app is not installable (or already is), and hand-written instructions
  // would be guessing at a menu that varies by vendor and skin.
  if (platform === 'ios') return 'ios-manual'
  return 'none'
}

/**
 * How long a dismissal lasts.
 *
 * Not forever, and not a session. Forever means one distracted tap
 * permanently removes the only thing protecting the driver's data from
 * eviction; a session means nagging, which is how a prompt gets trained out of
 * someone's vision. A month is long enough to be a real answer and short
 * enough that it is still offered before it matters.
 *
 * Either way it stays reachable from Settings, which is where someone who
 * dismissed it and changed their mind will look.
 */
export const DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Whether the invitation belongs on screen right now.
 *
 * ── Why it waits for the driver to have something to lose ─────────────────
 *
 * `hasDataWorthKeeping` is the rule that keeps this from being nagware. On a
 * first launch there is nothing installed-ness would protect, so an install
 * card is a pop-up asking for a commitment before the app has done anything.
 * Once there is a round loaded, the pitch is concrete and true: this is what
 * stops the browser throwing it away.
 */
export function shouldOfferInstall({
  route,
  dismissedAt,
  hasDataWorthKeeping,
  now = Date.now(),
}: {
  route: InstallRoute
  dismissedAt: number | null
  hasDataWorthKeeping: boolean
  now?: number
}): boolean {
  if (route === 'none') return false
  if (!hasDataWorthKeeping) return false
  if (dismissedAt !== null && now - dismissedAt < DISMISSAL_MS) return false
  return true
}

/**
 * Why installing is worth a tap, per platform.
 *
 * The iOS line is the one that has to be exactly right, because it is the only
 * one making a promise about the driver's data. WebKit's storage policy
 * excludes an origin from eviction when its storage is in persistent mode, and
 * grants persistent mode "based on heuristics like whether the website is
 * opened as a Home Screen Web App". So installing is not cosmetic there: it is
 * the thing that flips storage into the mode that survives.
 *
 * Note what this deliberately does NOT say: that installing guarantees the
 * data is kept. The heuristics are Apple's and undocumented in detail, and
 * Settings shows the actual outcome of `persist()` rather than assuming it.
 */
export function installPitch(platform: Platform): { title: string; body: string } {
  if (platform === 'ios') {
    return {
      title: 'Add to Home Screen',
      body:
        'Safari clears the storage of sites you have not opened in a week — including your routes. ' +
        'Added to the Home Screen, the app is far more likely to be granted storage the browser will not clear. ' +
        'It also opens full screen, without the address bar.',
    }
  }
  return {
    title: 'Install the app',
    body:
      'Opens full screen, starts faster, and works with no signal. ' +
      'Installing also makes the browser far more likely to protect your routes from being cleared automatically.',
  }
}

/** The steps, for the platform that has no button. */
export const IOS_INSTALL_STEPS = [
  'Tap the Share button at the bottom of Safari',
  'Scroll down and tap "Add to Home Screen"',
  'Tap "Add"',
] as const
