import { modelUrls, modelsPresent } from './models.ts'

/**
 * Reading text off a label, on the device.
 *
 * ── The execution provider is the whole performance story ─────────────────
 *
 * ONNX Runtime's multithreaded WebAssembly backend needs SharedArrayBuffer,
 * which needs cross-origin isolation, which M9 deliberately deleted from this
 * app: `coi-serviceworker` cost every visitor a forced reload and effectively
 * limited us to Chromium. Reintroducing it so OCR can use four threads would
 * trade a feature nobody has asked for against the app's reach, so it is not
 * on the table.
 *
 * That leaves two providers:
 *
 *   webgpu — Android Chrome, and iOS 26+ where Safari shipped WebGPU. Needs no
 *            isolation, and is the only configuration that is quick.
 *   wasm   — single-threaded, everywhere else, and honestly slow. Seconds per
 *            image on a mid-range phone.
 *
 * Which is why this ships behind a flag that is OFF by default. The brief
 * asked for an assist, and an assist that takes eight seconds is a wait.
 * `describeEngine()` exists so the UI can tell the driver which one they got
 * before they decide to wait for it.
 *
 * ── Loaded lazily, always ─────────────────────────────────────────────────
 *
 * ONNX Runtime plus a detection and a recognition model is several megabytes.
 * None of it is fetched until a driver actually asks to scan text.
 */

export interface OcrLine {
  text: string
  /** 0..1, as reported by the recogniser. Drives the confidence hint. */
  confidence: number
}

export interface OcrResult {
  lines: OcrLine[]
  /** Which provider actually ran, for the "this may be slow" message. */
  engine: 'webgpu' | 'wasm'
  /** Wall-clock milliseconds, so the device test has a number to record. */
  elapsedMs: number
}

export type OcrUnavailable =
  | { ok: false; reason: 'models-missing' }
  | { ok: false; reason: 'load-failed'; detail: string }

let servicePromise: Promise<OcrService> | null = null

interface OcrService {
  engine: 'webgpu' | 'wasm'
  recognize(image: Blob): Promise<OcrLine[]>
}

/** WebGPU without the isolation requirement, where the browser has it. */
async function preferredProviders(): Promise<{ providers: string[]; engine: 'webgpu' | 'wasm' }> {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (gpu) {
    try {
      if (await gpu.requestAdapter()) return { providers: ['webgpu', 'wasm'], engine: 'webgpu' }
    } catch {
      // An adapter request can fail on a machine that has the API and no
      // usable device. That is a wasm answer, not an error.
    }
  }
  return { providers: ['wasm'], engine: 'wasm' }
}

async function load(): Promise<OcrService> {
  const [{ PaddleOcrService }, ort] = await Promise.all([
    import('ppu-paddle-ocr/web'),
    import('onnxruntime-web'),
  ])

  // `wasmPaths` is deliberately NOT set. Vite already resolves onnxruntime's
  // own .wasm through the bundler and emits it as a hashed asset beside
  // everything else, which is self-hosted, cache-busted and cached offline by
  // the service worker's /assets/ rule. Overriding the path to a hand-copied
  // public/ directory would give us a second 26 MB copy of the same binary
  // and a filename to keep in step by hand.
  //
  // Single-threaded by construction — see the note above about isolation.
  ort.env.wasm.numThreads = 1

  const { providers, engine } = await preferredProviders()

  const service = new PaddleOcrService({
    model: modelUrls(),
    session: { executionProviders: providers as never },
    debugging: { verbose: false },
  })
  await service.initialize()

  return {
    engine,
    async recognize(image: Blob) {
      const buffer = await image.arrayBuffer()
      const result = await service.recognize(buffer as never, { flatten: true } as never)
      const raw = (result as { texts?: { text: string; score?: number }[]; text?: string }).texts
      if (Array.isArray(raw)) {
        return raw
          .map((r) => ({ text: String(r.text ?? '').trim(), confidence: Number(r.score ?? 0) }))
          .filter((l) => l.text.length > 0)
      }
      // `flatten` gives one string; split it back into lines so the confirm
      // step can offer them individually.
      const text = String((result as { text?: string }).text ?? '')
      return text
        .split(/\r?\n/)
        .map((line) => ({ text: line.trim(), confidence: 0 }))
        .filter((l) => l.text.length > 0)
    },
  }
}

/**
 * Read text from an image.
 *
 * Returns a discriminated failure rather than throwing for the two cases the
 * UI must explain differently: models that were never deployed, and a runtime
 * that would not start.
 */
export async function readText(image: Blob): Promise<OcrResult | OcrUnavailable> {
  if (!(await modelsPresent())) return { ok: false, reason: 'models-missing' }

  try {
    servicePromise ??= load()
    const service = await servicePromise
    const started = performance.now()
    const lines = await service.recognize(image)
    return { lines, engine: service.engine, elapsedMs: Math.round(performance.now() - started) }
  } catch (e) {
    // A failed load must not poison every later attempt — the usual cause is a
    // transient fetch, and the driver's second try should be allowed to work.
    servicePromise = null
    return { ok: false, reason: 'load-failed', detail: e instanceof Error ? e.message : String(e) }
  }
}

/** What to warn the driver about before they wait for it. */
export function describeEngine(engine: 'webgpu' | 'wasm'): string {
  return engine === 'webgpu'
    ? 'Reading on the GPU — usually a second or two.'
    : 'Reading on the CPU — this can take several seconds on a phone.'
}
