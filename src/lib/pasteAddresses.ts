/**
 * Turning a blob of pasted text into a list of addresses.
 *
 * This is the feature Spoke does not have and its users ask for most, and the
 * reason is simple: a driver's list of addresses arrives in a message, an
 * email or a note, and every route app makes them re-type it. The clipboard is
 * already holding the answer.
 *
 * ── The hard part is deciding what a line is ──────────────────────────────
 *
 * Pasted text has no schema. It can be one address per line, or several
 * separated by semicolons, or a numbered list, or a block copied from a table
 * with tabs in it. Rather than guess a format, this splits on the separators
 * that are unambiguous, strips the decorations people put in front of list
 * items, and leaves the geocoder to judge whether what remains is an address —
 * which is the one thing it is genuinely better at than we are.
 *
 * Pure module: no React, no store, no I/O.
 */

/** Leading list decoration: "1.", "1)", "-", "*", "•", "#3". */
const LIST_PREFIX = /^\s*(?:[-*•]|#?\d+\s*[.)\]]?)\s+/

/**
 * A line that is a bare number is a list index someone pasted along with the
 * addresses, not an address. Anything with no letters in it at all cannot be
 * geocoded to a street.
 */
function looksAddressLike(line: string): boolean {
  return /\p{L}/u.test(line)
}

export interface ParsedPaste {
  /** Candidate address strings, in the order they were pasted. */
  addresses: string[]
  /** Lines that were dropped, so the UI can say what it ignored. */
  skipped: string[]
}

/**
 * Split pasted text into candidate addresses.
 *
 * Newlines are the primary separator. Semicolons are treated as separators too
 * because "a; b; c" is how a list survives being pasted into a single-line
 * field. Commas are NOT: they appear inside almost every address ("Løvfrøvej 6,
 * 2880 Bagsværd"), and splitting on them would shred every entry into
 * fragments — which is the failure mode that makes naive importers useless.
 */
export function parsePastedAddresses(text: string, maxEntries = 100): ParsedPaste {
  const addresses: string[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  for (const raw of text.split(/[\r\n;]+/)) {
    const line = raw.replace(LIST_PREFIX, '').replace(/\s+/g, ' ').trim()
    if (!line) continue

    if (!looksAddressLike(line)) {
      skipped.push(line)
      continue
    }

    // De-duplicate case-insensitively: pasting a list twice, or a list with a
    // repeated delivery, should not create two stops at one door by accident.
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    if (addresses.length >= maxEntries) {
      skipped.push(line)
      continue
    }
    addresses.push(line)
  }

  return { addresses, skipped }
}

/** True when pasted text plausibly holds more than one address. */
export function isMultiAddressPaste(text: string): boolean {
  return parsePastedAddresses(text).addresses.length > 1
}
