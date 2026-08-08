/**
 * The words the edit form's settings list shows.
 *
 * ── Why every default is a WORD ───────────────────────────────────────────
 *
 * "Anytime", "Default (1 min)", "Not set" — never a blank. The effective value
 * of a setting is then visible without opening anything, which costs five
 * strings and removes the entire question of "is that empty, or is it unset,
 * or did it fail to load". It is the cheapest correctness in the whole design.
 *
 * These live in lib/ rather than beside the form because they are pure
 * formatting with real edge cases — a window with only one end, a service time
 * that is not one of the offered options — and those deserve tests rather than
 * a careful reading of some JSX.
 */

/**
 * Time at a stop, as offered.
 *
 * `undefined` is a real option and it is FIRST: "Default (1 min)" is what the
 * optimiser assumes, and making it selectable is how a driver gets back to it
 * after trying something else.
 */
export const SERVICE_TIME_OPTIONS: { label: string; seconds: number | undefined }[] = [
  { label: 'Default (1 min)', seconds: undefined },
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
]

/** What the optimiser assumes a stop costs when nobody has said otherwise. */
export const DEFAULT_SERVICE_SEC = 60

/** Seconds from local midnight → "09:15". Empty string when unset. */
export function secondsToClock(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return ''
  const total = Math.max(0, Math.round(seconds / 60))
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** "09:15" → seconds from local midnight. Undefined on anything else. */
export function clockToSeconds(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return hours * 3600 + minutes * 60
}

/**
 * "Anytime", "From 09:00", "Until 17:00", "09:00 – 12:00".
 *
 * One-ended windows are shown as such rather than being silently completed.
 * "Deliver after 09:00" is a real instruction a customer gives, and rendering
 * it as "09:00 – 00:00" would be a different, wrong instruction.
 */
export function describeWindow(
  openSec: number | undefined,
  closeSec: number | undefined,
): string {
  const from = secondsToClock(openSec)
  const to = secondsToClock(closeSec)
  if (from && to) return `${from} – ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return 'Anytime'
}

/** "Default (1 min)" for an unset value; "7 min" for one we never offered. */
export function describeServiceTime(seconds: number | undefined): string {
  const known = SERVICE_TIME_OPTIONS.find((o) => o.seconds === seconds)
  if (known) return known.label
  return `${Math.round((seconds ?? DEFAULT_SERVICE_SEC) / 60)} min`
}
