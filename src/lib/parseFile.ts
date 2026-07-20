import Papa from 'papaparse'
import type { LatLng, ParseResult } from '../types'
import { toLatLng } from './coordinates'

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
          const point = toLatLng(pick(row, LAT_KEYS), pick(row, LNG_KEYS))
          if (point) waypoints.push(point)
          else errors.push(`Row ${i + 1}: missing or invalid lat/lng`)
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
          const point =
            item && typeof item === 'object'
              ? toLatLng(
                  (item as Record<string, unknown>).lat,
                  (item as Record<string, unknown>).lng,
                )
              : null
          if (point) waypoints.push(point)
          else errors.push(`Item ${i + 1}: missing or invalid lat/lng`)
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
