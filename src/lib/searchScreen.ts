/**
 * The unified search model.
 *
 * One field answers two different questions with no mode switch and no tabs:
 *
 *   "From this route (N)"   stops already on the route
 *   "Add a new stop"        suggestions from the geocoder
 *
 * The reason this is one field rather than two tabs is that the driver does not
 * know which question they are asking. Holding a parcel labelled D7 they want
 * the stop; holding a paper note with an address they want the geocoder; and
 * typing "Løvfrøvej" they want whichever exists. A tab forces them to answer
 * that before they can type, which is the one thing they cannot do.
 *
 * Pure module: no React, no store, no I/O. `buildRouteRows` already turns a
 * route into rows, so finding stops is a filter between that and the list —
 * which is precisely why the existing-stop results can reuse `StopRow`
 * unchanged, ID chip and status badge included.
 */

import type { RouteRow, StopRowModel } from './routeList.ts'

/**
 * Fold a string for comparison.
 *
 * Three passes, and each one exists because the previous one is not enough:
 *
 *  1. **NFD, then strip combining marks.** Handles every letter that decomposes:
 *     "é" → "e", and "å" → "a" (å IS a + combining ring).
 *  2. **An explicit map.** Does nothing for "ø" and "æ", which are single
 *     codepoints with no canonical decomposition — NFD leaves them exactly as
 *     they were. Without this, a driver typing "lovfrovej" never finds
 *     "Løvfrøvej", and on a Danish route that is most of the list.
 *  3. **Collapse "aa" → "a".** Danish writes the same sound as either "å" or
 *     "aa" ("Århus" and "Aarhus" are the same city). Step 1 already turned "å"
 *     into "a", so without this the two spellings still fold apart. Collapsing
 *     makes all three of "Århus", "Aarhus" and "arhus" meet at "arhus".
 *
 * Every rule is applied to BOTH the query and the stop text, so the folds only
 * ever have to agree with each other — never with a dictionary. That is what
 * makes an over-eager rule harmless here: the worst case is an extra row in a
 * list the driver is already reading.
 */
const FOLD_MAP: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  ð: 'd',
  þ: 'th',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
}

export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øæðþßłđ]/g, (ch) => FOLD_MAP[ch] ?? ch)
    .replace(/aa/g, 'a')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a query into tokens that must ALL match, in any order.
 *
 * AND-over-tokens rather than a substring test on the whole string, because
 * "løvfrøvej 6" should find "Løvfrøvej 6, Bagsværd" and equally "6 Løvfrøvej".
 * A raw substring match fails the second, and a driver reading an address off a
 * label does not reliably type it in the order the geocoder stored it.
 */
export function queryTokens(query: string): string[] {
  const folded = foldForSearch(query)
  return folded ? folded.split(' ') : []
}

/**
 * Everything about a stop worth searching, as one folded haystack.
 *
 * The stop ID is in here deliberately, and it is the highest-value field in the
 * list: it is the thing written on the parcel in marker pen. Typing "D7" must
 * find stop D7 — that is the whole "which stop is this parcel?" workflow.
 */
export function haystackFor(row: StopRowModel): string {
  const stop = row.stop
  return foldForSearch(
    [
      row.title,
      row.subtitle,
      stop.stopId,
      stop.recipient ?? '',
      stop.notes ?? '',
      stop.address?.formatted ?? '',
      stop.address?.postcode ?? '',
      stop.packageFinder ?? '',
    ].join(' '),
  )
}

/** True when every token appears somewhere in the stop's searchable text. */
export function matchesStop(row: StopRowModel, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  const hay = haystackFor(row)
  return tokens.every((t) => hay.includes(t))
}

/**
 * The stop rows matching a query, in ROUTE order.
 *
 * Route order rather than relevance order on purpose: the sequence number is
 * the column the eye tracks, and a list that reorders by a relevance score the
 * driver cannot see would make those numbers appear to jump around at random.
 */
export function findStopsInRoute(rows: RouteRow[], query: string): StopRowModel[] {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return []
  return rows.filter((row): row is StopRowModel => row.kind === 'stop' && matchesStop(row, tokens))
}

/**
 * Should the geocoder be asked at all?
 *
 * Kept as a named predicate rather than inlined because it is a spending
 * decision. It stays false while the query is too short — see MIN_QUERY_LENGTH
 * in lib/geocoding/service.ts, which enforces the same floor at the other end.
 */
export function shouldQueryProvider(query: string, minLength: number): boolean {
  return foldForSearch(query).length >= minLength
}

/** The field's placeholder, which changes with the route's state. */
export function searchPlaceholder(stopCount: number): string {
  return stopCount === 0 ? 'Tap to add stops' : 'Add or find stops'
}

/** The heading over the existing-stops section. The count is part of the label. */
export function existingSectionLabel(count: number): string {
  return `From this route (${count})`
}
