/**
 * Turning a spreadsheet row into something importable.
 *
 * The old importer looked for `lat`/`lng` and threw away every other column.
 * That was fine when a stop was a coordinate; it is not fine now that a stop
 * has an address, a recipient and a note, all of which are usually sitting
 * right there in the file being ignored.
 *
 * ── Coordinates win when both are present ─────────────────────────────────
 *
 * A row with both coordinates and an address string uses the coordinates. They
 * are exact, free, and already correct, whereas geocoding the address costs a
 * request and can land on the wrong side of a dual carriageway. The address is
 * still kept — it becomes the stop's displayed title, which is strictly better
 * than the "55.74721, 12.45382" a coordinate-only import produces today.
 *
 * Pure module: no React, no store, no I/O.
 */

import type { Address, LatLng } from '../types.ts'
import { toLatLngResult } from './coordinates.ts'

export type Row = Record<string, unknown>

/**
 * Header aliases, lowercased.
 *
 * Danish spellings are in here alongside English because that is the language
 * the files this app imports are actually written in — a driver exporting from
 * a Danish system gets "adresse" and "modtager", and an importer that only
 * knows English silently ignores every useful column.
 */
const LAT_KEYS = ['lat', 'latitude', 'breddegrad']
const LNG_KEYS = ['lng', 'lon', 'long', 'longitude', 'længdegrad', 'laengdegrad']
const ADDRESS_KEYS = [
  'address',
  'adresse',
  'full address',
  'address1',
  'address line 1',
  'addressline1',
  'street address',
  'location',
  'destination',
]
const STREET_KEYS = ['street', 'gade', 'vej', 'road', 'street name']
const HOUSENUMBER_KEYS = ['housenumber', 'house number', 'number', 'nr', 'husnummer', 'no']
const CITY_KEYS = ['city', 'by', 'town', 'postal town', 'place']
const POSTCODE_KEYS = ['postcode', 'postnummer', 'postnr', 'zip', 'zipcode', 'zip code', 'post code']
const COUNTRY_KEYS = ['country', 'land']
const RECIPIENT_KEYS = ['recipient', 'modtager', 'name', 'navn', 'customer', 'kunde', 'contact']
const NOTES_KEYS = ['notes', 'note', 'bemærkning', 'bemaerkning', 'comment', 'kommentar', 'instructions']
const PHONE_KEYS = ['phone', 'telefon', 'tlf', 'mobile', 'mobil']

/** Lowercase every key once, so a row can be probed repeatedly without cost. */
export function normalizeRow(row: Row): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(row)) {
    const value = row[key]
    if (value === null || value === undefined) continue
    out[key.trim().toLowerCase()] = String(value).trim()
  }
  return out
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (value) return value
  }
  return undefined
}

/** One source row, classified. */
export interface ImportedRow {
  /** 1-based position in the source file, for the error report. */
  line: number
  /** Present when the row carried usable coordinates. */
  point?: LatLng
  /** Present when the row must be geocoded to become a stop. */
  query?: string
  /** Whatever address parts the file supplied, for display before geocoding. */
  address?: Address
  recipient?: string
  notes?: string
  /** Set when the row could not be used at all. */
  error?: string
}

/**
 * Build the single-line query a geocoder is given for this row.
 *
 * Either the file had one address column, or it had the parts spread across
 * several and they are joined back together. Joining is safe in a way that
 * SPLITTING would not be — assembling "Løvfrøvej 6, 2880 Bagsværd" from known
 * fields is unambiguous, while tearing that string apart into fields is the
 * problem geocoders exist to solve.
 */
export function buildQuery(row: Record<string, string>): string | undefined {
  const whole = pick(row, ADDRESS_KEYS)
  const street = pick(row, STREET_KEYS)
  const houseNumber = pick(row, HOUSENUMBER_KEYS)
  const city = pick(row, CITY_KEYS)
  const postcode = pick(row, POSTCODE_KEYS)
  const country = pick(row, COUNTRY_KEYS)

  const streetLine = whole ?? [street, houseNumber].filter(Boolean).join(' ')
  const localityLine = [postcode, city].filter(Boolean).join(' ')
  const parts = [streetLine, localityLine, country].map((p) => p?.trim()).filter(Boolean)

  const query = parts.join(', ')
  return query || undefined
}

/**
 * The address as the FILE describes it.
 *
 * Marked `source: 'import'` so it is distinguishable later from something a
 * geocoder asserted. It is a placeholder: once the row is geocoded the
 * provider's own answer replaces it, because the provider knows which line is
 * the street line for that country and the file does not.
 */
export function addressFromRow(row: Record<string, string>): Address | undefined {
  const query = buildQuery(row)
  if (!query) return undefined

  const whole = pick(row, ADDRESS_KEYS)
  const street = pick(row, STREET_KEYS)
  const houseNumber = pick(row, HOUSENUMBER_KEYS)
  const city = pick(row, CITY_KEYS)
  const postcode = pick(row, POSTCODE_KEYS)
  const country = pick(row, COUNTRY_KEYS)

  const title = whole ?? [street, houseNumber].filter(Boolean).join(' ')
  const subtitle = [postcode, city].filter(Boolean).join(' ')

  return {
    title: title || query,
    subtitle,
    formatted: query,
    street: [street, houseNumber].filter(Boolean).join(' ') || undefined,
    area: city,
    postcode,
    country,
    source: 'import',
  }
}

/**
 * Classify one row.
 *
 * The three outcomes are: usable coordinates, an address to geocode, or an
 * error naming the line — never a silent drop. A file where one row in forty
 * is malformed is the normal case, and the driver needs to know WHICH.
 */
export function classifyRow(raw: Row, line: number): ImportedRow {
  const row = normalizeRow(raw)
  const address = addressFromRow(row)
  const recipient = pick(row, RECIPIENT_KEYS)
  const phone = pick(row, PHONE_KEYS)
  const note = pick(row, NOTES_KEYS)
  // The phone number is appended to notes rather than dropped: there is no
  // field for it on a stop yet, and losing it on import would be worse than
  // putting it somewhere the driver can still read.
  const notes = [note, phone].filter(Boolean).join(' · ') || undefined

  const latRaw = pick(row, LAT_KEYS)
  const lngRaw = pick(row, LNG_KEYS)

  if (latRaw !== undefined || lngRaw !== undefined) {
    const result = toLatLngResult(latRaw, lngRaw)
    if (result.ok) return { line, point: result.point, address, recipient, notes }
    // Coordinates were offered and are unusable. Fall through to the address
    // if there is one — a bad lat/lng column should not condemn a row that
    // also says where it is in words.
    if (!address) {
      return {
        line,
        error:
          result.reason === 'range'
            ? `Row ${line}: coordinates out of range (lat ±90, lng ±180)`
            : `Row ${line}: non-numeric or missing coordinates`,
      }
    }
  }

  const query = buildQuery(row)
  if (query) return { line, query, address, recipient, notes }

  return { line, error: `Row ${line}: no coordinates and no address` }
}

export interface ClassifiedRows {
  rows: ImportedRow[]
  /** Rows that need a geocoder before they can become stops. */
  needsGeocoding: number
  errors: string[]
}

export function classifyRows(raw: Row[]): ClassifiedRows {
  const rows = raw.map((r, i) => classifyRow(r, i + 1))
  const errors = rows.flatMap((r) => (r.error ? [r.error] : []))
  const usable = rows.filter((r) => !r.error)

  if (usable.length === 0 && raw.length > 0) {
    errors.unshift(
      'No stops found. Expected columns named "lat" and "lng", or an "address" column.',
    )
  }

  return {
    rows: usable,
    needsGeocoding: usable.filter((r) => !r.point && r.query).length,
    errors,
  }
}
