import type { AddressedStop, LatLng } from '../types'
import { toLatLng } from './coordinates.ts'

/**
 * Barcode scanning: which engine reads the code, and what the code means.
 *
 * Framework-free. The camera and the sheet live in components/scan; everything
 * here is "given these bytes, which stop is this parcel".
 */

// ------------------------------------------------------------------ formats

/**
 * What we ask a detector to look for.
 *
 * Narrower than "everything" on purpose: every extra format is another set of
 * localisation passes over each frame, and a scanner that runs at four frames
 * a second on a mid-range phone is a scanner nobody points at a parcel twice.
 *
 * The first four are the shipping-label formats — Data Matrix is what most
 * European carriers print, PDF417 is what the big US ones use, Aztec turns up
 * on returns labels, and Code 128 is the workhorse of every tracking number
 * ever printed. The rest are there because a driver will inevitably point this
 * at a retail box, and reading it is cheaper than explaining why we didn't.
 */
export const SCAN_FORMATS = [
  'data_matrix',
  'pdf417',
  'aztec',
  'code_128',
  'qr_code',
  'code_39',
  'itf',
  'ean_13',
  'upc_a',
] as const

export type ScanFormat = (typeof SCAN_FORMATS)[number]

/**
 * The formats that decide whether the native detector is good enough.
 *
 * If a platform's BarcodeDetector cannot read these, it cannot read a shipping
 * label, and "native but blind to Data Matrix" is worse than the WASM path —
 * it fails silently, pointed at the one code the driver most needs read.
 */
export const LABEL_FORMATS: readonly ScanFormat[] = ['data_matrix', 'pdf417', 'code_128', 'qr_code']

/** Does this native detector cover the formats a parcel actually carries? */
export function nativeIsSufficient(supported: readonly string[] | null | undefined): boolean {
  if (!supported || supported.length === 0) return false
  const have = new Set(supported)
  return LABEL_FORMATS.every((f) => have.has(f))
}

// ------------------------------------------------------------------ matching

export interface ScanResult {
  text: string
  format: string
}

/**
 * What a scanned payload turned out to be.
 *
 * `ambiguous` is not defensiveness. `stopId` is an immutable DISPLAY label and
 * "Reset Stop IDs" can leave two stops sharing one — types.ts says so — so a
 * matcher that returned the first hit would silently send a driver to the
 * wrong parcel roughly half the time it happened. Two candidates is a question
 * for the driver, not a coin toss.
 */
export type ScanMatch =
  | { kind: 'stop'; stopId: string; via: 'barcode' | 'label' }
  | { kind: 'ambiguous'; stopIds: string[]; text: string }
  | { kind: 'coordinates'; point: LatLng; text: string }
  | { kind: 'unknown'; text: string }

/** Uppercase, and strip everything that is not a letter or a digit. */
const fold = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** The alphanumeric runs in a payload — "D7" inside "PKG-D7/2026". */
const tokens = (s: string): string[] => s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)

/**
 * A `geo:` URI, or a bare "lat,lng" pair.
 *
 * Worth handling because a QR code on a job sheet is one of the few barcodes
 * that genuinely names a place, and turning it into a stop is the whole
 * "add-stop-by-barcode" flow. Anything else is a tracking number, and a
 * tracking number is not a location however much it looks like digits.
 */
export function coordinatesIn(text: string): LatLng | null {
  const cleaned = text.trim().replace(/^geo:/i, '')
  // geo: URIs carry ;u=35 accuracy hints and ?q= labels. Neither is a coordinate.
  const head = cleaned.split(/[;?]/)[0]
  const parts = head.split(',')
  if (parts.length < 2) return null
  return toLatLng(Number(parts[0]), Number(parts[1]))
}

/**
 * Which stop, if any, this parcel belongs to.
 *
 * Order matters. A barcode explicitly linked to a stop beats a label that
 * merely appears in the payload, because the link was an act of intent and the
 * label match is a guess about a substring.
 */
export function matchScan(text: string, stops: readonly AddressedStop[]): ScanMatch {
  const trimmed = text.trim()
  if (!trimmed) return { kind: 'unknown', text }

  // 1. A code the driver has already linked to a stop.
  const linked = stops.filter((s) => s.barcodes?.some((b) => b.trim() === trimmed))
  if (linked.length === 1) return { kind: 'stop', stopId: linked[0].id, via: 'barcode' }
  if (linked.length > 1) {
    return { kind: 'ambiguous', stopIds: linked.map((s) => s.id), text: trimmed }
  }

  // 2. A stop label written on the box, whole — "D7", not the D7 inside "AD73".
  const folded = fold(trimmed)
  const parts = new Set(tokens(trimmed))
  const labelled = stops.filter((s) => {
    const label = fold(s.stopId)
    return label.length > 0 && (folded === label || parts.has(label))
  })
  if (labelled.length === 1) return { kind: 'stop', stopId: labelled[0].id, via: 'label' }
  if (labelled.length > 1) {
    return { kind: 'ambiguous', stopIds: labelled.map((s) => s.id), text: trimmed }
  }

  // 3. A place rather than a parcel.
  const point = coordinatesIn(trimmed)
  if (point) return { kind: 'coordinates', point, text: trimmed }

  return { kind: 'unknown', text: trimmed }
}

// ------------------------------------------------------------------- engine

export interface Scanner {
  /** Which implementation read this — reported in the sheet and diagnostics. */
  readonly engine: 'native' | 'wasm'
  detect(source: CanvasImageSource | Blob | ImageData): Promise<ScanResult[]>
}

interface NativeDetector {
  detect(source: unknown): Promise<{ rawValue: string; format: string }[]>
}

/**
 * The best scanner this device can give us.
 *
 * Native first where it is genuinely capable, because it is hardware-backed,
 * faster and far cheaper on battery than decoding every frame in WebAssembly.
 * "Capable" is checked against the formats a shipping label actually uses
 * rather than against the constructor existing — see `nativeIsSufficient`.
 *
 * The WASM path is imported dynamically so that a megabyte of ZXing lands only
 * on the devices that open the scanner, and never during boot.
 */
export async function createScanner(): Promise<Scanner> {
  const Native = (globalThis as { BarcodeDetector?: new (o: unknown) => NativeDetector })
    .BarcodeDetector
  const statics = Native as unknown as { getSupportedFormats?: () => Promise<string[]> } | undefined

  if (Native && typeof statics?.getSupportedFormats === 'function') {
    try {
      const supported = await statics.getSupportedFormats()
      if (nativeIsSufficient(supported)) {
        const formats = SCAN_FORMATS.filter((f) => supported.includes(f))
        const detector = new Native({ formats })
        return {
          engine: 'native',
          async detect(source) {
            const found = await detector.detect(source)
            return found.map((b) => ({ text: b.rawValue, format: b.format }))
          },
        }
      }
    } catch {
      // Android downloads its barcode module on first use. A device that
      // cannot reach it rejects here, which is a WASM answer, not an error.
    }
  }

  return createWasmScanner()
}

/**
 * ZXing-C++ compiled to WebAssembly, which is the only way iOS scans anything.
 *
 * ── The wasm is ours, not a CDN's ─────────────────────────────────────────
 *
 * `prepareZXingModule` defaults its `locateFile` to a jsDelivr URL. Left alone
 * that would put a third-party origin on the critical path of a driver's
 * scanner and break it entirely in a dead zone — which is the exact situation
 * this app is built for. The override points at a hashed asset Vite emits
 * beside the rest of the bundle.
 */
async function createWasmScanner(): Promise<Scanner> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])

  prepareZXingModule({ overrides: { locateFile: () => wasmUrl } })

  const detector = new BarcodeDetector({ formats: [...SCAN_FORMATS] })
  return {
    engine: 'wasm',
    async detect(source) {
      const found = await detector.detect(source as ImageBitmapSource)
      return found.map((b) => ({ text: b.rawValue, format: b.format }))
    },
  }
}
