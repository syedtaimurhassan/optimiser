import Papa from 'papaparse'
import type { LatLng, ParseResult } from '../types.ts'
import { toLatLngResult, type CoordReason } from './coordinates.ts'
import { classifyRows, type ClassifiedRows, type Row as ImportRow } from './importRows.ts'
import { parseXlsx } from './xlsx.ts'

const reasonText = (reason: CoordReason, label: string, i: number) =>
  reason === 'range'
    ? `${label} ${i + 1}: coordinates out of range (lat ±90, lng ±180)`
    : `${label} ${i + 1}: non-numeric or missing coordinates`

/**
 * Accepted header aliases. The milestone requires `lat`/`lng`, but we tolerate
 * a few common spellings so real-world files "just work".
 */
const LAT_KEYS = ['lat', 'latitude']
const LNG_KEYS = ['lng', 'lon', 'long', 'longitude']

type Row = Record<string, unknown>

/** Case-insensitively pull the first matching column from a parsed CSV row. */
function pick(row: Row, keys: string[]): unknown {
  const lowered: Row = {}
  for (const key of Object.keys(row)) {
    lowered[key.trim().toLowerCase()] = row[key]
  }
  for (const key of keys) {
    if (key in lowered) return lowered[key]
  }
  return undefined
}

/** Parse a CSV file with a header row, looking for lat/lng columns. */
export function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const waypoints: LatLng[] = []
        const errors: string[] = []

        results.data.forEach((row, i) => {
          const r = toLatLngResult(pick(row, LAT_KEYS), pick(row, LNG_KEYS))
          if (r.ok) waypoints.push(r.point)
          else errors.push(reasonText(r.reason, 'Row', i))
        })

        if (waypoints.length === 0 && results.data.length > 0) {
          errors.unshift(
            'No valid coordinates found. Expected columns named "lat" and "lng".',
          )
        }
        resolve({ waypoints, errors })
      },
      error: (err) => resolve({ waypoints: [], errors: [err.message] }),
    })
  })
}

/** Parse a JSON file expected to be an array of { lat, lng } objects. */
export function parseJson(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const waypoints: LatLng[] = []
      const errors: string[] = []

      try {
        const data: unknown = JSON.parse(String(reader.result))
        if (!Array.isArray(data)) {
          resolve({
            waypoints: [],
            errors: ['JSON root must be an array of { lat, lng } objects.'],
          })
          return
        }

        data.forEach((item, i) => {
          const r =
            item && typeof item === 'object'
              ? toLatLngResult(
                  (item as Record<string, unknown>).lat,
                  (item as Record<string, unknown>).lng,
                )
              : ({ ok: false, reason: 'invalid' } as const)
          if (r.ok) waypoints.push(r.point)
          else errors.push(reasonText(r.reason, 'Item', i))
        })
      } catch (e) {
        errors.push(`Invalid JSON: ${(e as Error).message}`)
      }

      resolve({ waypoints, errors })
    }

    reader.onerror = () =>
      resolve({ waypoints: [], errors: ['Could not read file.'] })
    reader.readAsText(file)
  })
}

/** Dispatch to the right parser based on file extension, falling back to MIME type. */
export function parseWaypointFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) return parseJson(file)
  if (name.endsWith('.csv')) return parseCsv(file)
  if (file.type.includes('json')) return parseJson(file)
  return parseCsv(file)
}

// ──────────────────────────────────────────────── M6: the address importer

/**
 * The richer import path.
 *
 * `parseWaypointFile` above is unchanged and still the coordinate-only API —
 * `routeStore.addWaypoints` and the M1 uploader both still call it, and both
 * still behave exactly as they did. This is a SECOND entry point rather than a
 * replacement, because the two answer different questions: the old one returns
 * points, this one returns rows that may still need geocoding.
 */

/**
 * Delimited text: CSV and TSV, told apart by Papa rather than by us.
 *
 * The text is read first and parsed as a STRING rather than handing Papa the
 * `File`. Papa's file path goes through `FileReaderSync`, which only exists
 * inside a worker — so passing a File makes this function unrunnable anywhere
 * except a browser main thread, and untestable outside one. Reading first
 * behaves identically in the browser and works everywhere else too.
 */
async function parseDelimited(file: File): Promise<ImportRow[]> {
  const results = Papa.parse<ImportRow>(await file.text(), {
    header: true,
    skipEmptyLines: true,
    // Empty string means "sniff it". This is the whole of TSV support: the
    // format differs from CSV by one character, and Papa already detects it
    // more reliably than a filename extension does.
    delimiter: '',
  })
  return results.data
}

/** Rows from a JSON array, for parity with the coordinate importer. */
async function parseJsonRows(file: File): Promise<ImportRow[]> {
  const data: unknown = JSON.parse(await file.text())
  if (!Array.isArray(data)) throw new Error('JSON root must be an array of objects.')
  return data.filter((d): d is ImportRow => Boolean(d) && typeof d === 'object')
}

export interface ImportFileResult extends ClassifiedRows {
  /** What the file was read as, for the report the user sees. */
  format: 'csv' | 'xlsx' | 'json'
}

/**
 * Read any supported file into classified rows.
 *
 * Errors are RETURNED, not thrown: a file that cannot be read at all is the
 * same kind of event as a file with three bad rows, and the caller should have
 * one thing to render rather than a try/catch and a result type.
 */
export async function importStopFile(file: File): Promise<ImportFileResult> {
  const name = file.name.toLowerCase()
  const format: ImportFileResult['format'] = name.endsWith('.xlsx')
    ? 'xlsx'
    : name.endsWith('.json')
      ? 'json'
      : 'csv'

  try {
    const rows =
      format === 'xlsx'
        ? await parseXlsx(file)
        : format === 'json'
          ? await parseJsonRows(file)
          : await parseDelimited(file)
    return { ...classifyRows(rows), format }
  } catch (e) {
    return { rows: [], needsGeocoding: 0, errors: [(e as Error).message], format }
  }
}
