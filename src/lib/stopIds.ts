/**
 * Immutable stop IDs.
 *
 * The idea this implements: a stop's *label* is fixed at creation and never
 * changes, while its *position in the route* moves freely as the route is
 * reoptimised. A driver writes "D7" on a parcel with a marker in the morning;
 * that parcel is still D7 after three reoptimisations, even though it may now be
 * the 22nd stop of the day. Sequence numbers are a property of the route;
 * IDs are a property of the parcel.
 *
 * Scheme: letter blocks of ten, assigned against the ORIGINAL position.
 *
 *   original position   1..10   →  A1 .. A10
 *                      11..20   →  B1 .. B10
 *                      21..30   →  C1 .. C10
 *                      31..40   →  D1 .. D10
 *                      41..50   →  E1 .. E10   …and so on
 *
 * Past Z (position 260) the block letter continues spreadsheet-style:
 * AA, AB, … so position 500 is "AX10". Unbounded, and still short enough to
 * write on a box.
 *
 * Stops inserted later take a decimal suffix off their parent — D7 → "D7.1",
 * then "D7.2" — so an insert never renumbers anything that already exists.
 *
 * Pure module: no React, no store, no I/O.
 */

/** How stop IDs are labelled. Spoke offers a plain-numeric mode too. */
export type StopIdMode = 'letterBlock' | 'numeric'

/** Stops per letter block. */
export const BLOCK_SIZE = 10

/**
 * Block letter for a 0-based block index, spreadsheet-style:
 * 0→A, 25→Z, 26→AA, 27→AB, 49→AX.
 *
 * Bijective base-26 (no zero digit), which is why the loop subtracts one from
 * the carry — plain base-26 would produce a nonexistent "A0" column.
 */
export function blockLetter(blockIndex: number): string {
  if (!Number.isInteger(blockIndex) || blockIndex < 0) {
    throw new RangeError(`blockLetter: expected a non-negative integer, got ${blockIndex}`)
  }
  let out = ''
  let n = blockIndex
  for (;;) {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
    if (n < 0) break
  }
  return out
}

/** Inverse of `blockLetter`. "A"→0, "Z"→25, "AA"→26, "AX"→49. */
export function blockIndexFromLetter(letters: string): number {
  if (!/^[A-Z]+$/.test(letters)) {
    throw new RangeError(`blockIndexFromLetter: expected A-Z letters, got "${letters}"`)
  }
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/**
 * The ID for a stop that was created at 1-based `position` in the original list.
 *
 * This is a pure function of the original position — which is exactly why the ID
 * is stable. Nothing about the current route order can reach it.
 */
export function stopIdForPosition(position: number, mode: StopIdMode = 'letterBlock'): string {
  if (!Number.isInteger(position) || position < 1) {
    throw new RangeError(`stopIdForPosition: position must be a positive integer, got ${position}`)
  }
  if (mode === 'numeric') return String(position)

  const blockIndex = Math.floor((position - 1) / BLOCK_SIZE)
  const within = position - blockIndex * BLOCK_SIZE // 1..10, never 0
  return `${blockLetter(blockIndex)}${within}`
}

/** Assign IDs to a whole list of original positions, 1-based and in order. */
export function assignStopIds(count: number, mode: StopIdMode = 'letterBlock'): string[] {
  return Array.from({ length: count }, (_, i) => stopIdForPosition(i + 1, mode))
}

export interface ParsedStopId {
  /** Block letters, e.g. "D". Empty in numeric mode. */
  letters: string
  /** Position within the block (1..10), or the whole number in numeric mode. */
  index: number
  /** Decimal suffixes: "D7.2.1" → [2, 1]. Empty for an original stop. */
  suffixes: number[]
  /** The ID with all suffixes removed: "D7.2" → "D7". */
  root: string
  mode: StopIdMode
}

const LETTER_ID = /^([A-Z]+)(\d+)((?:\.\d+)*)$/
const NUMERIC_ID = /^(\d+)((?:\.\d+)*)$/

/** Parse an ID in either mode. Returns null if it isn't a valid stop ID. */
export function parseStopId(id: string): ParsedStopId | null {
  const letter = LETTER_ID.exec(id)
  if (letter) {
    const [, letters, index, tail] = letter
    return {
      letters,
      index: Number(index),
      suffixes: splitSuffixes(tail),
      root: `${letters}${index}`,
      mode: 'letterBlock',
    }
  }
  const numeric = NUMERIC_ID.exec(id)
  if (numeric) {
    const [, index, tail] = numeric
    return {
      letters: '',
      index: Number(index),
      suffixes: splitSuffixes(tail),
      root: index,
      mode: 'numeric',
    }
  }
  return null
}

function splitSuffixes(tail: string): number[] {
  if (!tail) return []
  return tail.split('.').filter(Boolean).map(Number)
}

/** The suffix-free ancestor of an ID: "D7.2" → "D7", "D7" → "D7". */
export function rootStopId(id: string): string {
  return parseStopId(id)?.root ?? id
}

/**
 * Allocate an ID for a stop inserted next to `nearId`.
 *
 * Suffixes are always allocated off the ROOT, not off the neighbour: inserting
 * beside D7 gives D7.1, and inserting beside D7.1 gives D7.2 rather than
 * D7.1.1. Nesting would deepen without bound as a driver worked down a street,
 * and "D7.1.2.1" is not something anyone wants to write on a box.
 *
 * `existingIds` is every ID currently in the route — the new ID is the next
 * unused suffix, so deleting D7.1 does not cause the next insert to reuse it.
 * IDs must remain unique for the lifetime of the route, not just at one moment.
 */
export function allocateInsertedStopId(nearId: string, existingIds: Iterable<string>): string {
  const root = rootStopId(nearId)
  let highest = 0

  for (const id of existingIds) {
    const parsed = parseStopId(id)
    if (!parsed || parsed.root !== root) continue
    // Only direct children count: D7.2 is a child of D7, D7.2.1 is not.
    if (parsed.suffixes.length === 1) {
      highest = Math.max(highest, parsed.suffixes[0])
    }
  }

  return `${root}.${highest + 1}`
}

/**
 * Sort key that orders IDs the way a human reads them: by block, then by index
 * within the block, then by decimal suffix — so D7, D7.1, D7.2, D8 come out in
 * that order rather than lexicographically (which would give D7, D7.1, D7.10,
 * D7.2).
 */
export function compareStopIds(a: string, b: string): number {
  const pa = parseStopId(a)
  const pb = parseStopId(b)
  if (!pa || !pb) return a.localeCompare(b)

  if (pa.letters !== pb.letters) {
    // Shorter letter runs sort first: Z before AA.
    if (pa.letters.length !== pb.letters.length) return pa.letters.length - pb.letters.length
    return pa.letters < pb.letters ? -1 : 1
  }
  if (pa.index !== pb.index) return pa.index - pb.index

  const len = Math.max(pa.suffixes.length, pb.suffixes.length)
  for (let i = 0; i < len; i++) {
    const sa = pa.suffixes[i] ?? -1 // a bare D7 sorts before D7.1
    const sb = pb.suffixes[i] ?? -1
    if (sa !== sb) return sa - sb
  }
  return 0
}

/** One stop's identity fields, the only part of a stop this module cares about. */
export interface StopIdentity {
  stopId: string
  originalPosition: number
}

/**
 * "Reset Stop IDs" — reassign every ID from the CURRENT order, and rebase
 * originalPosition to match.
 *
 * Deliberately destructive: it invalidates every label already written on a
 * parcel, which is the whole reason it is an explicit user action and never
 * something the app does on its own.
 */
export function resetStopIds(count: number, mode: StopIdMode = 'letterBlock'): StopIdentity[] {
  return Array.from({ length: count }, (_, i) => ({
    stopId: stopIdForPosition(i + 1, mode),
    originalPosition: i + 1,
  }))
}

/**
 * Next ID for a stop appended to the end of a route.
 *
 * Appends continue the original numbering from the highest original position
 * used so far, so adding a 41st stop to a 40-stop route gives E1. `takenIds`
 * guards the case where that ID already exists (after a reset, or a partial
 * delete) by falling back to a decimal suffix rather than colliding.
 */
export function allocateAppendedStopId(
  highestOriginalPosition: number,
  takenIds: Iterable<string>,
  mode: StopIdMode = 'letterBlock',
): StopIdentity {
  const originalPosition = highestOriginalPosition + 1
  const candidate = stopIdForPosition(originalPosition, mode)
  const taken = takenIds instanceof Set ? takenIds : new Set(takenIds)
  if (!taken.has(candidate)) return { stopId: candidate, originalPosition }
  return { stopId: allocateInsertedStopId(candidate, taken), originalPosition }
}
