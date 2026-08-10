/**
 * Download the OCR models into public/, so the deployed app serves its own.
 *
 *   npm run ocr:models
 *
 * ── Why this is a script and not a dependency ─────────────────────────────
 *
 * ppu-paddle-ocr defaults its model URLs to GitHub's media host. Left alone
 * that would put a third-party origin on the critical path of a feature a
 * driver reaches for in a stairwell, and it would break entirely offline —
 * the same trap as the barcode decoder's jsDelivr default, for the same
 * reason. Self-hosting is the fix; downloading them at build time rather than
 * committing them is what keeps ~9 MB of binary out of the git history.
 *
 * `public/models/` is gitignored and copied into `dist/` by Vite, so a deploy
 * that has run this script serves the models from its own origin. A deploy
 * that has NOT run it simply has no OCR — the engine checks and says so,
 * rather than silently reaching for the internet.
 *
 * PP-OCRv5 English mobile, INT8: the smallest set that reads a Latin shipping
 * label. The multilingual v6 models are three times the size for languages a
 * Danish delivery round does not print addresses in.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'ocr')

/**
 * The URLs come from the library's own catalogue rather than being written out
 * here. Hard-coding them is how you end up downloading three 404 pages: the
 * paths are not guessable, and they are the library's to change.
 */
const { V5_EN_MOBILE_INT8_MODEL } = await import(
  new URL('../node_modules/ppu-paddle-ocr/model-catalogue.js', import.meta.url).href
)

/** Local names. Must match MODEL_FILES in src/lib/ocr/models.ts. */
const FILES = [
  ['detection.ort', V5_EN_MOBILE_INT8_MODEL.detection],
  ['recognition.ort', V5_EN_MOBILE_INT8_MODEL.recognition],
  ['dictionary.txt', V5_EN_MOBILE_INT8_MODEL.charactersDictionary],
]

mkdirSync(OUT, { recursive: true })

let failed = 0
for (const [name, url] of FILES) {
  const target = join(OUT, name)
  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`${name.padEnd(18)} already present (${(statSync(target).size / 1048576).toFixed(1)} MB)`)
    continue
  }
  try {
    process.stdout.write(`${name.padEnd(18)} downloading… `)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    // Git LFS pointers are a few hundred bytes of text and look like a
    // successful download until the model fails to parse hours later.
    if (bytes.subarray(0, 20).toString().startsWith('version https://')) {
      throw new Error('got an LFS pointer, not the file itself')
    }
    // A size floor for the models only. The character dictionary is a few
    // hundred bytes of ASCII and would fail any threshold big enough to catch
    // a truncated model.
    if (bytes.length === 0) throw new Error('empty file')
    if (name.endsWith('.ort') && bytes.length < 100_000) {
      throw new Error(`only ${bytes.length} bytes — that is not a model`)
    }
    writeFileSync(target, bytes)
    console.log(`${(bytes.length / 1048576).toFixed(1)} MB`)
  } catch (e) {
    failed++
    console.log(`FAILED — ${e.message}`)
    console.log(`  ${url}`)
  }
}

// ONNX Runtime's own .wasm is NOT copied here. Vite resolves it through the
// bundler and emits it as a hashed asset, which is already self-hosted and
// already cached offline by the service worker. Copying it into public/ as
// well would ship the same 26 MB binary twice.

if (failed > 0) {
  console.log(`\n${failed} file(s) failed. OCR will report itself unavailable until they are here.`)
  process.exitCode = 1
} else {
  console.log(`\nOCR models are in public/models/ocr/ and will ship with the next build.`)
}
