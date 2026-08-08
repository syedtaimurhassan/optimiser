/**
 * A minimal .xlsx reader.
 *
 * ── Why not a library ─────────────────────────────────────────────────────
 *
 * SheetJS and friends are 400kB+ of code for a feature that, for us, means
 * "read the first sheet's cells as strings". This app already ships a 33MB
 * WASM solver, so bundle size is not the argument — the argument is that a
 * dependency is a standing decision and this is a bounded problem with a
 * standard-library answer.
 *
 * An .xlsx file is a ZIP of XML, and both halves are available natively:
 * `DecompressionStream('deflate-raw')` inflates, and the XML that Excel,
 * Numbers and LibreOffice emit is machine-generated and highly regular.
 *
 * ── What it deliberately does NOT do ──────────────────────────────────────
 *
 * No formulas (the cached VALUE of a formula cell is read, which is what a
 * spreadsheet of addresses contains anyway), no styles, no date coercion, no
 * multi-sheet selection — the first worksheet only. Every one of those is a
 * feature nobody importing a list of addresses has asked for, and adding them
 * is the road that ends in having written SheetJS badly.
 *
 * The parsing halves are pure string functions so they can be tested without a
 * browser; only `unzip` touches a platform API.
 */

import type { Row } from './importRows.ts'

// ────────────────────────────────────────────────────────────────── ZIP

interface ZipEntry {
  name: string
  compressionMethod: number
  data: Uint8Array
}

const readU16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const readU32 = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

/**
 * Walk the local file headers.
 *
 * The central directory would be the more correct place to read sizes from,
 * but streaming writers set the local header's sizes to zero and defer them to
 * a data descriptor. Reading the central directory first and using ITS sizes
 * avoids that trap, which is why this locates entries via the central
 * directory rather than scanning forwards.
 */
export function readZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer)

  // End of central directory: scan backwards for the signature. The comment
  // field is variable-length, so its position cannot be computed.
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (readU32(bytes, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('Not a valid .xlsx file (no ZIP directory found)')

  const count = readU16(bytes, eocd + 10)
  let offset = readU32(bytes, eocd + 16)
  const entries: ZipEntry[] = []

  for (let i = 0; i < count; i++) {
    if (readU32(bytes, offset) !== 0x02014b50) break
    const compressionMethod = readU16(bytes, offset + 10)
    const compressedSize = readU32(bytes, offset + 20)
    const nameLength = readU16(bytes, offset + 28)
    const extraLength = readU16(bytes, offset + 30)
    const commentLength = readU16(bytes, offset + 32)
    const localOffset = readU32(bytes, offset + 42)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))

    // The local header repeats the name and extra fields, at their own
    // lengths — which are NOT always the central directory's.
    const localNameLength = readU16(bytes, localOffset + 26)
    const localExtraLength = readU16(bytes, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength

    entries.push({
      name,
      compressionMethod,
      data: bytes.subarray(dataStart, dataStart + compressedSize),
    })

    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

/** Inflate one entry. Stored (method 0) and deflate (method 8) only. */
export async function inflateEntry(entry: ZipEntry): Promise<string> {
  if (entry.compressionMethod === 0) return new TextDecoder().decode(entry.data)
  if (entry.compressionMethod !== 8) {
    throw new Error(`Unsupported compression in .xlsx (method ${entry.compressionMethod})`)
  }
  const stream = new Blob([entry.data as BlobPart]).stream().pipeThrough(
    new DecompressionStream('deflate-raw'),
  )
  return new Response(stream).text()
}

// ────────────────────────────────────────────────────────────────── XML

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

export function decodeXmlText(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10))
    return XML_ENTITIES[code] ?? whole
  })
}

/**
 * The shared string table.
 *
 * Excel stores every distinct string once here and has cells reference it by
 * index. A `<si>` can hold one `<t>` or several (rich text runs, one per
 * formatting change), and the runs must be concatenated — otherwise an address
 * where someone bolded the postcode imports as just the unbolded half.
 */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  for (const [, si] of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    let text = ''
    for (const [, run] of si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += run
    out.push(decodeXmlText(text))
  }
  return out
}

/** "BC12" → 55 (0-based column index). */
export function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/**
 * The first worksheet, as rows of strings.
 *
 * The first row is treated as headers, matching every other importer here.
 * Cells are addressed by their `r` reference rather than by position, because
 * a spreadsheet omits empty cells entirely — counting `<c>` elements would
 * shift every value left of a blank into the wrong column.
 */
export function parseSheet(xml: string, shared: string[]): Row[] {
  const grid: string[][] = []

  for (const [, rowXml] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    for (const [, attrs, body] of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]
      const type = /t="(\w+)"/.exec(attrs)?.[1]
      const index = ref ? columnIndex(ref) : cells.length

      let value: string
      if (type === 'inlineStr') {
        value = decodeXmlText(
          [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(([, t]) => t).join(''),
        )
      } else {
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? ''
        value = type === 's' ? (shared[Number(raw)] ?? '') : decodeXmlText(raw)
      }

      cells[index] = value
    }
    grid.push(cells)
  }

  const [headerRow, ...bodyRows] = grid
  if (!headerRow) return []

  const headers = headerRow.map((h, i) => (h ?? '').trim() || `column${i + 1}`)
  return bodyRows
    .map((cells) => {
      const row: Row = {}
      headers.forEach((header, i) => {
        const value = cells[i]
        if (value !== undefined && value !== '') row[header] = value
      })
      return row
    })
    .filter((row) => Object.keys(row).length > 0)
}

/** Read the first worksheet of an .xlsx file. */
export async function parseXlsx(file: File): Promise<Row[]> {
  const entries = readZipEntries(await file.arrayBuffer())
  const byName = new Map(entries.map((e) => [e.name, e]))

  const sheetEntry =
    byName.get('xl/worksheets/sheet1.xml') ??
    entries.find((e) => /^xl\/worksheets\/.*\.xml$/.test(e.name))
  if (!sheetEntry) throw new Error('No worksheet found in this .xlsx file')

  const sharedEntry = byName.get('xl/sharedStrings.xml')
  const shared = sharedEntry ? parseSharedStrings(await inflateEntry(sharedEntry)) : []

  return parseSheet(await inflateEntry(sheetEntry), shared)
}
