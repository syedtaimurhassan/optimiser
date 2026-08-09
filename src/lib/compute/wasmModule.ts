/**
 * Loading the Rust engine, and the rules for touching its memory.
 *
 * ── Two artefacts, chosen here ────────────────────────────────────────────
 *
 * WebAssembly has no runtime feature detection, so a module either contains
 * v128 instructions and requires an engine that understands them, or it does
 * not. rustc is explicit about it: "WebAssembly does not currently have dynamic
 * detection at runtime as to whether SIMD is supported." The feature-detection
 * proposal that would fix this is still a prototype.
 *
 * So we ship both builds and pick in JavaScript, using the `wasmSimd()` probe
 * the app already has — it validates a module that USES v128, which is the only
 * honest way to ask. Support floor for the SIMD build is Safari/iOS 16.4 and
 * Chrome 91; the scalar build reaches Safari/iOS 15 and Chrome 75. Anything
 * older gets tier D, which is TypeScript and needs nothing.
 *
 * ── The one memory rule ───────────────────────────────────────────────────
 *
 * NEVER hold a view across a call that can grow linear memory.
 *
 * Growing detaches every existing TypedArray, and a detached view reads as
 * zeros rather than throwing — a matrix of zeros is a matrix where all travel is
 * free, which produces a confident, fast, completely wrong route. `engine_alloc`
 * is the only export that can grow memory, so every view here is derived
 * immediately before use and never stored.
 *
 * ── Nothing is imported ───────────────────────────────────────────────────
 *
 * The import object below is `{}`, and it is not a simplification: the module
 * declares no imports at all, so there is no way for the search to call back
 * into JavaScript. `scripts/build-engine.mjs` fails the build if that ever stops
 * being true. This is the entire point of M10 — the OR-Tools build it replaces
 * invokes a JS callback once per arc evaluation.
 *
 * Pure `lib/`: no React, no store, no DOM beyond `fetch` and `WebAssembly`.
 */

export type EngineVariant = 'simd' | 'scalar'

/** The exported surface, exactly as declared in `engine/src/ffi.rs`. */
interface EngineExports {
  memory: WebAssembly.Memory
  engine_alloc: (bytes: number) => number
  engine_dealloc: (ptr: number, bytes: number) => void
  engine_create: (
    n: number,
    cost: number,
    optional: number,
    selectK: number,
    skipPenalty: number,
    start: number,
    end: number,
    seed: number,
    seedOrder: number,
    seedOrderLen: number,
    flags: number,
    time: number,
    service: number,
    twOpen: number,
    twClose: number,
    departAt: number,
    pin: number,
  ) => number
  engine_destroy: (driver: number) => void
  engine_step: (driver: number, budget: number) => number
  engine_best_ptr: (driver: number) => number
  engine_best_len: (driver: number) => number
  engine_best_objective: (driver: number) => number
  engine_time_warp: (driver: number) => number
  engine_iterations: (driver: number) => number
}

/**
 * Where the artefacts live.
 *
 * `new URL(..., import.meta.url)` rather than a bare string: Vite rewrites it to
 * the hashed asset path, which is what keeps this working under the
 * `/optimiser/` base on GitHub Pages. A plain path would resolve against the
 * document and 404 — the same trap `engineWorkers.ts` documents for workers.
 */
const ARTEFACTS: Record<EngineVariant, () => URL> = {
  simd: () => new URL('./wasm/engine-simd.wasm', import.meta.url),
  scalar: () => new URL('./wasm/engine.wasm', import.meta.url),
}

async function instantiate(url: URL): Promise<WebAssembly.Instance> {
  // The empty import object is the point. There is nothing to call.
  const imports = {}
  try {
    const { instance } = await WebAssembly.instantiateStreaming(fetch(url), imports)
    return instance
  } catch {
    // instantiateStreaming needs `application/wasm`. Every host we target sends
    // it, but a dev proxy or a file:// load may not, and falling back costs one
    // extra copy rather than the whole engine.
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`could not fetch the solver engine (${response.status} ${url.pathname})`)
    }
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), imports)
    return instance
  }
}

/**
 * A loaded engine, and the only way to talk to it.
 *
 * One instance can serve many solves sequentially. It holds no per-solve state —
 * that lives in a `Driver` allocated inside linear memory and released when the
 * solve ends.
 */
export class WasmEngineModule {
  readonly variant: EngineVariant
  private readonly exports: EngineExports

  private constructor(variant: EngineVariant, instance: WebAssembly.Instance) {
    this.variant = variant
    this.exports = instance.exports as unknown as EngineExports
  }

  /**
   * Load one. `variant` defaults to whatever this browser can run.
   *
   * `bytes` exists for Node, which cannot `fetch` a `file:` URL — the test suite
   * reads the artefact off disk and hands it over.
   */
  static async load(options?: {
    variant?: EngineVariant
    bytes?: BufferSource
  }): Promise<WasmEngineModule> {
    const variant = options?.variant ?? (supportsSimd() ? 'simd' : 'scalar')
    const instance = options?.bytes
      ? (await WebAssembly.instantiate(options.bytes, {})).instance
      : await instantiate(ARTEFACTS[variant]())
    return new WasmEngineModule(variant, instance)
  }

  // ─────────────────────────────────────────────────── memory, carefully

  /** A view valid ONLY until the next call that can allocate. */
  private i32(ptr: number, length: number): Int32Array {
    return new Int32Array(this.exports.memory.buffer, ptr, length)
  }

  private u8(ptr: number, length: number): Uint8Array {
    return new Uint8Array(this.exports.memory.buffer, ptr, length)
  }

  /**
   * Copy a typed array into fresh linear memory and return its pointer.
   *
   * The view is derived AFTER the allocation, never before, because the
   * allocation is the thing that can detach it.
   */
  private write(source: Int32Array | Uint8Array): number {
    const bytes = source.byteLength
    const ptr = this.exports.engine_alloc(bytes)
    if (ptr === 0) throw new Error(`the solver engine could not allocate ${bytes} bytes`)
    if (source instanceof Int32Array) {
      this.i32(ptr, source.length).set(source)
    } else {
      this.u8(ptr, source.length).set(source)
    }
    return ptr
  }

  private free(ptr: number, bytes: number): void {
    if (ptr !== 0) this.exports.engine_dealloc(ptr, bytes)
  }

  // ─────────────────────────────────────────────────────────── the solve

  /**
   * Hand the problem over and get a handle back.
   *
   * The staging buffers are freed before this returns: the engine copies what it
   * needs, so holding them would double the matrix for the whole solve — 8 MB
   * rather than 4 at n = 1000. Transient is fine; sustained is waste.
   */
  createDriver(input: {
    n: number
    cost: Int32Array
    optional: Uint8Array
    selectK: number
    skipPenalty: number
    start: number
    end: number
    seed: number
    seedOrder?: Int32Array
    flags?: number
    /**
     * The schedule. All four arrays or none of them — the engine treats a
     * partial schedule as no schedule rather than applying three of the four,
     * because a half-applied schedule is a route that looks constrained and is
     * not.
     */
    time?: Int32Array
    serviceTimeSec?: Int32Array
    twOpenSec?: Int32Array
    twCloseSec?: Int32Array
    departAtSec?: number
    /** One byte per node: 0 anywhere, 1 first, 2 last. Omit for no pins. */
    pin?: Uint8Array
  }): WasmDriver {
    const costPtr = this.write(input.cost)
    const optionalPtr = this.write(input.optional)
    const seedOrderPtr = input.seedOrder?.length ? this.write(input.seedOrder) : 0

    const timed = Boolean(input.time && input.serviceTimeSec && input.twOpenSec && input.twCloseSec)
    const timePtr = timed ? this.write(input.time!) : 0
    const servicePtr = timed ? this.write(input.serviceTimeSec!) : 0
    const twOpenPtr = timed ? this.write(input.twOpenSec!) : 0
    const twClosePtr = timed ? this.write(input.twCloseSec!) : 0
    const pinned = Boolean(input.pin?.some((p) => p !== 0))
    const pinPtr = pinned ? this.write(input.pin!) : 0

    const driver = this.exports.engine_create(
      input.n,
      costPtr,
      optionalPtr,
      input.selectK,
      input.skipPenalty,
      input.start,
      input.end,
      input.seed,
      seedOrderPtr,
      input.seedOrder?.length ?? 0,
      input.flags ?? 0,
      timePtr,
      servicePtr,
      twOpenPtr,
      twClosePtr,
      input.departAtSec ?? 0,
      pinPtr,
    )

    this.free(costPtr, input.cost.byteLength)
    this.free(optionalPtr, input.optional.byteLength)
    if (seedOrderPtr !== 0) this.free(seedOrderPtr, input.seedOrder!.byteLength)
    if (timed) {
      this.free(timePtr, input.time!.byteLength)
      this.free(servicePtr, input.serviceTimeSec!.byteLength)
      this.free(twOpenPtr, input.twOpenSec!.byteLength)
      this.free(twClosePtr, input.twCloseSec!.byteLength)
    }
    if (pinPtr !== 0) this.free(pinPtr, input.pin!.byteLength)

    if (driver === 0) {
      throw new Error('the solver engine rejected the request as malformed')
    }
    return new WasmDriver(this.exports, driver)
  }
}

/**
 * One solve in progress.
 *
 * Must be `destroy()`ed. The caller owns that, including on the error and
 * cancellation paths, which is why every use of it is inside a `try/finally`.
 */
export class WasmDriver {
  private readonly exports: EngineExports
  private handle: number

  constructor(exports: EngineExports, handle: number) {
    this.exports = exports
    this.handle = handle
  }

  /**
   * Run for at most `budget` units of work. Returns true when the search has
   * converged and further steps would do nothing.
   *
   * This is the only call made during a solve, and it makes no calls back. The
   * host decides between steps whether to continue — that is how both the time
   * budget and cancellation are enforced, because nothing inside the engine can
   * read a clock or an AbortSignal.
   */
  step(budget: number): boolean {
    return this.exports.engine_step(this.handle, budget) === 1
  }

  /** A copy of the best order found so far. Copied, not viewed — see the rule. */
  best(): Int32Array {
    const length = this.exports.engine_best_len(this.handle)
    if (length === 0) return new Int32Array(0)
    const ptr = this.exports.engine_best_ptr(this.handle)
    return new Int32Array(this.exports.memory.buffer, ptr, length).slice()
  }

  bestObjective(): number {
    return this.exports.engine_best_objective(this.handle)
  }

  /**
   * Total lateness of the route `best()` returns, in seconds.
   *
   * Read for diagnostics only. `toResult` re-derives the schedule from the order
   * for every engine, and that is the number anything downstream acts on — an
   * engine never grades its own work, and "did I meet the windows" is the last
   * question to start trusting it on.
   */
  timeWarp(): number {
    return this.exports.engine_time_warp(this.handle)
  }

  iterations(): number {
    return this.exports.engine_iterations(this.handle)
  }

  destroy(): void {
    if (this.handle !== 0) {
      this.exports.engine_destroy(this.handle)
      this.handle = 0
    }
  }
}

/**
 * Does this engine implement fixed-width SIMD?
 *
 * The same bytes `capabilities.ts` uses — a module that declares a v128 result
 * and executes `i8x16.splat` + `i8x16.popcnt`. Duplicated rather than imported
 * because this module runs inside a worker, where pulling in `lib/device/` would
 * drag along the platform and storage probes for no reason.
 *
 * Byte array from GoogleChromeLabs/wasm-feature-detect (Apache-2.0).
 */
function supportsSimd(): boolean {
  try {
    return (
      typeof WebAssembly === 'object' &&
      WebAssembly.validate(
        Uint8Array.from([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65,
          0, 253, 15, 253, 98, 11,
        ]),
      )
    )
  } catch {
    return false
  }
}

export { supportsSimd }
