/**
 * Turning what the recogniser saw into something worth geocoding.
 *
 * A shipping label is mostly not an address. It is a carrier's name, a service
 * level, a weight, two barcodes' worth of digits printed as text, a sort code,
 * and — somewhere in the middle — three lines that matter. This module's whole
 * job is throwing away the rest and ranking what is left.
 *
 * It is a RANKING, not a decision. Every result goes in front of the driver to
 * confirm or edit before anything is geocoded. The brief called this an assist
 * rather than magic, and the difference is exactly this: a wrong guess costs a
 * tap, not a delivery.
 */

/** Lines shorter than this are label furniture, not addresses. */
const MIN_LENGTH = 4

/**
 * Words that mean "this line is about the parcel, not the place".
 *
 * Kept short deliberately. An aggressive list starts eating real street names
 * — there is a Postvej in Denmark — and a false negative here is invisible,
 * whereas a false positive is one extra row the driver ignores.
 */
const FURNITURE = [
  'tracking',
  'consignment',
  'waybill',
  'sender',
  'afsender',
  'return to',
  'weight',
  'vaegt',
  'kg',
  'pcs',
  'service point',
  'signature',
]

const hasLetters = (s: string): boolean => /[A-Za-zÀ-ÿ]/.test(s)
const hasDigits = (s: string): boolean => /\d/.test(s)

/** A run of digits long enough to be a tracking number rather than a house number. */
const looksLikeCode = (s: string): boolean => /\d{8,}/.test(s.replace(/[\s-]/g, ''))

/** "2880", "DK-2880", "SW1A 1AA" — a postcode, with or without a country prefix. */
export function hasPostcode(s: string): boolean {
  return (
    /\b[A-Z]{1,2}-?\d{4,5}\b/.test(s.toUpperCase()) ||
    /(^|\s)\d{4,5}(\s|$)/.test(s) ||
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/.test(s.toUpperCase())
  )
}

/** "Løvfrøvej 6", "6 Acacia Avenue" — words and a number together. */
export function looksLikeStreet(s: string): boolean {
  if (!hasLetters(s) || !hasDigits(s)) return false
  if (looksLikeCode(s)) return false
  // A house number is short. Anything longer is a reference of some kind.
  return /(^|\s)\d{1,4}[A-Za-z]?(\s|,|$)/.test(s) || /[A-Za-zÀ-ÿ]\s+\d{1,4}[A-Za-z]?\b/.test(s)
}

/**
 * A house number sits at one END of an address line, not in its middle.
 *
 * This is what separates "Løvfrøvej 6" and "6 Acacia Avenue" from "Round 12 —
 * Wednesday" and "Total 2 stops", both of which are words with a number in
 * them and both of which appear on every printed round sheet. `looksLikeStreet`
 * stays permissive because it only RANKS; this is used where a wrong answer
 * would create a stop.
 */
export function numberAtEdge(s: string): boolean {
  return /^\d{1,4}[A-Za-z]?\s+\S/.test(s.trim()) || /\s\d{1,4}[A-Za-z]?$/.test(s.trim())
}

/**
 * "2880 Bagsværd", "London SW1A 1AA" — the locality line, not a street.
 *
 * It has to be told apart from a street because it ALSO reads as "words with a
 * number at an edge": the postcode is that number. What separates them is that
 * a street line ends in a house number and a locality line does not.
 */
export function isLocalityLine(s: string): boolean {
  return hasPostcode(s) && !/\s\d{1,3}[A-Za-z]?$/.test(s.trim())
}

export interface ScoredLine {
  text: string
  score: number
}

/**
 * Rank the lines by how much they look like part of a postal address.
 *
 * Deliberately generous at the bottom: everything survives except obvious
 * furniture, because the driver is looking at the list and a missing line is
 * harder to recover from than a surplus one.
 */
export function scoreLines(lines: readonly string[]): ScoredLine[] {
  const cleaned = lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= MIN_LENGTH && hasLetters(line))
    .filter((line) => {
      const lower = line.toLowerCase()
      return !FURNITURE.some((word) => lower.includes(word))
    })
    .filter((line) => !looksLikeCode(line))

  return cleaned
    .map((text) => {
      let score = 1
      if (looksLikeStreet(text)) score += 3
      if (hasPostcode(text)) score += 2
      // ALL CAPS SHOUTING is usually the carrier's own branding.
      if (text === text.toUpperCase() && text.length > 8) score -= 1
      return { text, score }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * The single best guess at an address, as one line.
 *
 * A street line plus the postcode line, in the order they appeared, because
 * that is what a geocoder wants and what the driver expects to read back.
 * Reading order is preserved rather than score order — "2880 Bagsværd
 * Løvfrøvej 6" is a worse query than the same two lines the right way round.
 */
export function bestAddress(lines: readonly string[]): string | null {
  const kept = scoreLines(lines)
  if (kept.length === 0) return null

  // The locality line reads as a street too — its postcode is the number — so
  // it is excluded here rather than competing for the same slot.
  const street = kept.find((l) => looksLikeStreet(l.text) && !isLocalityLine(l.text))
  const postal = kept.find((l) => isLocalityLine(l.text) && l.text !== street?.text)

  if (street && postal) {
    const order = [street.text, postal.text].sort(
      (a, b) => lines.findIndex((l) => l.includes(a)) - lines.findIndex((l) => l.includes(b)),
    )
    return order.join(', ')
  }
  return (street ?? postal ?? kept[0]).text
}

/**
 * A manifest: many addresses on one sheet, one per group of lines.
 *
 * Every line that scores as a street becomes its own candidate, paired with
 * the next postcode-bearing line beneath it when there is one. That is the
 * shape of every printed round sheet we have seen, and it degrades to "one
 * candidate per plausible line" when it is wrong — which is a list the driver
 * can tick through rather than a failure.
 */
export function manifestCandidates(lines: readonly string[]): string[] {
  const cleaned = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length >= MIN_LENGTH)
  const out: string[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i]
    if (!looksLikeStreet(line) || looksLikeCode(line)) continue
    // Precision matters more than recall here: every candidate becomes a stop
    // the driver has to notice and remove, and a sheet's header and footer are
    // both "words with a number in them".
    if (!numberAtEdge(line)) continue
    // The postcode line is not a delivery of its own. Without this every
    // address on the sheet produces two candidates, one of them a town.
    if (isLocalityLine(line)) continue
    const lower = line.toLowerCase()
    if (FURNITURE.some((word) => lower.includes(word))) continue
    const next = cleaned[i + 1]
    out.push(next && isLocalityLine(next) ? `${line}, ${next}` : line)
  }

  return out
}
