/**
 * Has this browser ALREADY been given permission to locate the device?
 *
 * ── Why the question is phrased that way ──────────────────────────────────
 *
 * `useGeolocation` never asks on mount, on purpose: throwing a permission
 * prompt at someone who has not asked for anything is rude, and on iOS a
 * dismissed prompt is expensive to recover from. "The tap is the consent."
 *
 * That rule is worth keeping and does not have to cost the auto-centring a
 * driver expects. `navigator.permissions.query` reports the state WITHOUT
 * prompting, so a driver who has already said yes can have the map open on
 * their real position, and a driver who has not is never asked twice as hard.
 * Calling `getCurrentPosition` to find out would be the exact prompt the rule
 * exists to avoid.
 *
 * ── Safari does not implement it ──────────────────────────────────────────
 *
 * WebKit has no `navigator.permissions.query` for geolocation — it is absent
 * rather than merely inaccurate — so on iOS this always answers 'unknown' and
 * the caller must treat that as "do not auto-locate". That is not a
 * degradation worth working around: the saved-camera and home-region steps of
 * the ladder already give iOS a sensible view, and the alternative is prompting
 * on launch, which is the thing we refuse to do.
 */

export type GeoPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

export async function geolocationPermission(): Promise<GeoPermission> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    const state = status.state
    return state === 'granted' || state === 'denied' || state === 'prompt' ? state : 'unknown'
  } catch {
    // Firefox historically threw on unsupported descriptors rather than
    // rejecting the name, and a throw here must never reach the map.
    return 'unknown'
  }
}

/**
 * The only question the map actually asks.
 *
 * Deliberately collapses 'prompt', 'denied' and 'unknown' into one answer, so
 * no call site can accidentally decide that 'prompt' is close enough to yes.
 */
export async function mayLocateWithoutAsking(): Promise<boolean> {
  return (await geolocationPermission()) === 'granted'
}
