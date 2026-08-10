/**
 * Where the OCR models live, and whether they are here at all.
 *
 * They are downloaded into `public/models/ocr/` by `npm run ocr:models` and
 * served from our own origin — see that script for why. This module is the
 * single place that knows the filenames, so the script and the engine cannot
 * drift apart without the check below failing loudly.
 */

/** Must match FILES in scripts/fetch-ocr-models.mjs. */
export const MODEL_FILES = {
  detection: 'detection.ort',
  recognition: 'recognition.ort',
  charactersDictionary: 'dictionary.txt',
} as const

const base = (): string =>
  typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'

export function modelUrls(): { detection: string; recognition: string; charactersDictionary: string } {
  const root = `${base()}models/ocr/`
  return {
    detection: `${root}${MODEL_FILES.detection}`,
    recognition: `${root}${MODEL_FILES.recognition}`,
    charactersDictionary: `${root}${MODEL_FILES.charactersDictionary}`,
  }
}

/**
 * Are the models actually deployed here?
 *
 * A HEAD request rather than an optimistic load. A deploy that skipped the
 * download step would otherwise fetch three 404 pages, hand them to ONNX
 * Runtime as models, and fail somewhere deep inside a WebAssembly module with
 * a message nobody can act on. Asking first turns that into one honest
 * sentence in the UI.
 */
export async function modelsPresent(): Promise<boolean> {
  const urls = modelUrls()
  try {
    const checks = await Promise.all(
      Object.values(urls).map((url) => fetch(url, { method: 'HEAD' }).then((r) => r.ok)),
    )
    return checks.every(Boolean)
  } catch {
    return false
  }
}
