/**
 * A short buzz to confirm a gesture the driver did not look at.
 *
 * Swipe-to-complete is the one action in this app performed without reading
 * the screen — thumb on a row, eyes on the road or on a parcel — so the
 * confirmation has to arrive through a sense that is free. That is the whole
 * justification; a haptic on anything the driver is already looking at would
 * be noise.
 *
 * ── Feature-detected, never platform-sniffed ──────────────────────────────
 *
 * The brief recorded "Android only — iOS Safari has no Vibration API", and as
 * of 2026 that is no longer a settled fact: MDN's compat data carries an open
 * report of `navigator.vibrate` working on iOS Safari while caniuse still
 * shows no support, and Apple has shipped a user-gesture requirement around
 * it. Detecting the method rather than the vendor makes the disagreement
 * irrelevant — the buzz happens wherever it can, and silently does not where
 * it cannot. A platform branch would have had to be revisited the moment the
 * answer changed.
 *
 * Every call is inside a pointer handler, which also satisfies the
 * user-activation requirement browsers attach to this.
 */

/** Long enough to feel, short enough not to be a rattle. */
const TAP_MS = 12
/** Two pulses: the gesture undid something rather than doing it. */
const UNDO_PATTERN = [10, 40, 10]

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Some browsers throw rather than returning false when vibration is
    // disallowed (a background tab, a user setting). A confirmation buzz is
    // never worth an exception reaching the caller.
  }
}

/** A status was set. */
export const hapticTap = (): void => buzz(TAP_MS)

/** A status was taken back. Deliberately a different rhythm, not a longer one. */
export const hapticUndo = (): void => buzz(UNDO_PATTERN)
