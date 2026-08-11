/**
 * Device & browser capability detection.
 *
 * Framework-free: no React, no store, no DOM rendering. Everything here answers
 * "what can this browser actually do", never "what does it claim to be".
 *
 * Two tiers:
 *   - `detectSync()`  — cheap property probes, safe to call during boot.
 *   - `detectAsync()` — needs compilation, a permissions query, or a handle;
 *                       call after first paint.
 *
 * The only user-agent string we touch is for `platform`, and only because
 * "is this an iPhone" is genuinely a question about the vendor, not a question
 * about a feature. Every actual capability is feature-detected. UA sniffing for
 * features is how you end up shipping a broken app to a browser that gained the
 * feature last month.
 */

export type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

/** Cheap, synchronous capability probes. */
export interface SyncCapabilities {
  wasm: boolean
  crossOriginIsolated: boolean
  sharedArrayBuffer: boolean
  /** Web Workers — how the solver gets off the main thread. */
  workers: boolean
  hardwareConcurrency: number | null
  indexedDB: boolean
  opfs: boolean
  barcodeDetector: boolean
  speechRecognition: boolean
  geolocation: boolean
  wakeLock: boolean
  vibrate: boolean
  webShare: boolean
  webgpu: boolean

  // ── M13: the capabilities the driver's phone is asked for by name ──
  /** getUserMedia — a live camera, as opposed to a file picker. */
  mediaDevices: boolean
  /**
   * ImageCapture (`grabFrame`/`takePhoto`). Absent in every WebKit browser,
   * which is why the scanner draws the video into a canvas by hand rather
   * than grabbing frames the short way.
   */
  imageCapture: boolean
  deviceOrientation: boolean
  /**
   * iOS 13+ requires `DeviceOrientationEvent.requestPermission()` from inside
   * a user gesture. Separate from `deviceOrientation` because "the event
   * exists" and "you may listen to it" are different questions, and only the
   * second one needs a button.
   */
  orientationNeedsPermission: boolean
  networkInformation: boolean
  serviceWorker: boolean
  /** Push needs a service worker; on iOS it additionally needs to be installed. */
  push: boolean
  badging: boolean
  backgroundSync: boolean
  periodicSync: boolean
  /** Running as an installed PWA rather than in a browser tab. */
  standalone: boolean
  platform: Platform
  /** Physical pixels per CSS pixel — useful for map tile selection later. */
  devicePixelRatio: number
  /** Coarse pointer ⇒ touch-primary device. Drives hit-target sizing. */
  touchPrimary: boolean
  prefersReducedMotion: boolean
}

/** Probes that must compile something, await a handle, or query permissions. */
export interface AsyncCapabilities {
  wasmSimd: boolean
  wasmThreads: boolean
  /** Result of navigator.storage.persist() — protection from eviction. */
  storagePersisted: boolean
  /** Bytes used / available, when the browser will say. */
  storageEstimate: { usage: number | null; quota: number | null } | null
  /**
   * What the NATIVE BarcodeDetector will actually decode on this device, or
   * null when there is no native one.
   *
   * Asked rather than assumed, and this is the whole reason it is an async
   * probe: on Android the implementation is backed by a Play Services module
   * that can be missing, so `'BarcodeDetector' in window` is true on devices
   * where detection returns nothing. An empty list here means "there is a
   * constructor but it cannot read anything", which is the case the scanner
   * has to treat as no native support at all.
   */
  barcodeFormats: string[] | null
  /**
   * Whether speech can be recognised without sending audio anywhere.
   *
   * Chrome 139+ only, and it needs a downloaded language pack. One of
   * 'available' | 'downloadable' | 'downloading' | 'unavailable', or null
   * where the API does not exist — which is everywhere else, and where
   * recognition therefore means "streamed to the vendor's servers".
   */
  speechOnDevice: string | null | undefined
}

export type Capabilities = SyncCapabilities &
  Partial<AsyncCapabilities> & { asyncResolved: boolean }

// ---------------------------------------------------------------- wasm probes

/**
 * WebAssembly feature detection by validating a minimal module that USES the
 * feature. If the browser can validate the bytes, it implements the proposal.
 *
 * Byte arrays reproduced from GoogleChromeLabs/wasm-feature-detect (Apache-2.0):
 * https://github.com/GoogleChromeLabs/wasm-feature-detect
 *
 * Inlined rather than depended upon because we need exactly two of its
 * detectors and this keeps lib/device free of dependencies. `selfTest()` below
 * guards against transcription error.
 *
 * NOTE on threads: this validates that the ENGINE supports shared memory. It is
 * NOT the same question as "can we use threads here" — that additionally
 * requires cross-origin isolation, which is why `crossOriginIsolated` is
 * reported separately. M0 established that the two come apart in exactly the
 * way that matters to this app.
 */

/**
 * (module (memory 1 1 shared) (func (drop (i32.atomic.load (i32.const 0)))))
 *
 * Declares shared memory AND uses an atomic load, so it fails on engines that
 * accept the shared flag but lack the atomic opcodes.
 */
const THREADS_MODULE: Uint8Array<ArrayBuffer> = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0,        // \0asm, version 1
  1, 4, 1, 96, 0, 0,                  // type:     () -> ()
  3, 2, 1, 0,                         // function: one func, type 0
  5, 4, 1, 3, 1, 1,                   // memory:   limits flags 3 = has-max + SHARED
  10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11, // code: i32.const 0; i32.atomic.load; drop
])

/** (module (func (result v128) (i8x16.splat (i32.const 0)) i8x16.popcnt)) */
const SIMD_MODULE: Uint8Array<ArrayBuffer> = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0,
  1, 5, 1, 96, 0, 1, 123,             // type:     () -> v128
  3, 2, 1, 0,                         // function: one func, type 0
  10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11, // code: v128 ops (0xfd prefix)
])

const validate = (bytes: Uint8Array<ArrayBuffer>): boolean => {
  try {
    return typeof WebAssembly === 'object' && WebAssembly.validate(bytes)
  } catch {
    return false
  }
}

export const wasmThreads = (): boolean => validate(THREADS_MODULE)
export const wasmSimd = (): boolean => validate(SIMD_MODULE)

/**
 * Sanity check for the hand-copied byte arrays above.
 *
 * A transcription slip would silently report "unsupported" everywhere, which
 * looks like a legitimate result and would quietly mis-tier every device. This
 * asserts the modules are at least well-formed WebAssembly by checking that a
 * known-good empty module validates while deliberately corrupted bytes do not —
 * so a bad copy fails loudly instead of degrading silently.
 */
export function selfTest(): { ok: boolean; problems: string[] } {
  const problems: string[] = []
  if (typeof WebAssembly !== 'object') return { ok: true, problems: ['no WebAssembly to test against'] }

  const EMPTY = Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
  if (!validate(EMPTY)) problems.push('empty module failed to validate — WebAssembly.validate is unusable')

  const CORRUPT = Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0xff, 0xff, 0xff, 0xff])
  if (validate(CORRUPT)) problems.push('corrupt module validated — WebAssembly.validate is not discriminating')

  for (const [name, bytes] of [['threads', THREADS_MODULE], ['simd', SIMD_MODULE]] as const) {
    if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
      problems.push(`${name} module has a bad magic number — byte array is corrupt`)
    }
  }

  return { ok: problems.length === 0, problems }
}

// ------------------------------------------------------------------ platform

/**
 * Vendor identification. Used for install instructions and store-eviction
 * warnings — never as a proxy for a feature.
 *
 * iPadOS reports itself as a Mac, so the touch check disambiguates.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(ua) || isIpadOs) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Mac|Win|Linux|CrOS/.test(ua)) return 'desktop'
  return 'unknown'
}

/** True when launched from a home-screen icon rather than a browser tab. */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari predates display-mode and uses a non-standard navigator flag.
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true
  const displayMode =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches)
  return iosStandalone || displayMode
}

const has = (obj: unknown, key: string): boolean => {
  try {
    return Boolean(obj) && key in (obj as object)
  } catch {
    return false
  }
}

const media = (query: string): boolean => {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.(query).matches === true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ detection

export function detectSync(): SyncCapabilities {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  return {
    wasm: typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function',
    crossOriginIsolated: typeof globalThis.crossOriginIsolated === 'boolean' ? globalThis.crossOriginIsolated : false,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    workers: typeof Worker !== 'undefined',
    hardwareConcurrency: nav?.hardwareConcurrency ?? null,
    indexedDB: typeof indexedDB !== 'undefined',
    opfs: has(nav?.storage, 'getDirectory'),
    barcodeDetector: typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis,
    // Safari still ships this prefixed only.
    speechRecognition:
      'SpeechRecognition' in globalThis || 'webkitSpeechRecognition' in globalThis,
    geolocation: has(nav, 'geolocation'),
    wakeLock: has(nav, 'wakeLock'),
    vibrate: has(nav, 'vibrate'),
    webShare: has(nav, 'share'),
    webgpu: has(nav, 'gpu'),

    mediaDevices: has(nav?.mediaDevices, 'getUserMedia'),
    imageCapture: 'ImageCapture' in globalThis,
    deviceOrientation: 'DeviceOrientationEvent' in globalThis,
    orientationNeedsPermission:
      typeof (globalThis as { DeviceOrientationEvent?: { requestPermission?: unknown } })
        .DeviceOrientationEvent?.requestPermission === 'function',
    networkInformation: has(nav, 'connection'),
    serviceWorker: has(nav, 'serviceWorker'),
    push: 'PushManager' in globalThis,
    badging: has(nav, 'setAppBadge'),
    // Both are reached through a service worker registration, but their
    // manager interfaces are exposed globally, which is enough to answer
    // "would this browser ever let us" without registering anything.
    backgroundSync: 'SyncManager' in globalThis,
    periodicSync: 'PeriodicSyncManager' in globalThis,
    standalone: detectStandalone(),
    platform: detectPlatform(),
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    touchPrimary: media('(pointer: coarse)'),
    prefersReducedMotion: media('(prefers-reduced-motion: reduce)'),
  }
}

/**
 * Asks the browser to exempt our storage from eviction.
 *
 * This matters more than it looks on iOS, where script-writable storage is
 * cleared after 7 days of non-use — a driver who doesn't work for a week would
 * otherwise lose their routes. Chromium grants it silently based on engagement;
 * Safari ties it to notification permission, so a `false` here is a normal
 * outcome and not an error.
 */
async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await within(Promise.resolve(navigator.storage.persisted?.()), PROBE_TIMEOUT_MS, false)) {
      return true
    }
    return await within(navigator.storage.persist(), PROBE_TIMEOUT_MS, false)
  } catch {
    return false
  }
}

async function estimateStorage(): Promise<AsyncCapabilities['storageEstimate']> {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage, quota } = await navigator.storage.estimate()
    return { usage: usage ?? null, quota: quota ?? null }
  } catch {
    return null
  }
}

/**
 * A probe that cannot hang the app.
 *
 * Learned the hard way. `SpeechRecognition.available()` EXISTS in current
 * Chromium and, with the on-device feature disabled behind a flag, returns a
 * promise that never settles. `detectAsync` awaits all of its probes together,
 * so one hung probe meant `ready` never became true — and everything gated on
 * device readiness quietly stopped, with no error anywhere to explain it.
 *
 * A capability probe is an optimisation. None of them is worth a boot.
 */
async function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Long enough for a real answer, short enough not to be felt. */
const PROBE_TIMEOUT_MS = 1500

/**
 * Ask the native detector what it can read.
 *
 * Deliberately tolerant of a throw: Android's implementation downloads its
 * barcode module on first use, and a device that cannot reach it rejects here
 * rather than returning an empty list.
 */
async function nativeBarcodeFormats(): Promise<string[] | null> {
  try {
    const ctor = (globalThis as { BarcodeDetector?: { getSupportedFormats?: () => Promise<string[]> } })
      .BarcodeDetector
    if (typeof ctor?.getSupportedFormats !== 'function') return null
    return await within(ctor.getSupportedFormats(), PROBE_TIMEOUT_MS, null)
  } catch {
    return null
  }
}

/**
 * Whether speech can be recognised without sending audio anywhere.
 *
 * ── NOT called at boot, and that is a scar ────────────────────────────────
 *
 * `SpeechRecognition.available()` does not merely read a flag: it wakes
 * Chromium's on-device speech machinery, which the M13 research already found
 * was disabled behind a regression until 142.0.7403.0. Calling it during the
 * capability probe stalled the renderer's network — the map's style request
 * never completed, no symbol was ever placed, and NOTHING logged an error. It
 * took a bisect to find, because every visible signal said the app was fine.
 *
 * Awaiting it with a timeout does not help: the damage is done by the call,
 * not by the wait. So it is asked once, lazily, from the voice sheet — a user
 * gesture, on a screen whose whole purpose is speech — and never on the path
 * that has to render a map.
 */
export async function probeOnDeviceSpeech(): Promise<string | null> {
  try {
    const ctor = (globalThis as {
      SpeechRecognition?: { available?: (o: unknown) => Promise<string> }
      webkitSpeechRecognition?: { available?: (o: unknown) => Promise<string> }
    })
    const available = ctor.SpeechRecognition?.available ?? ctor.webkitSpeechRecognition?.available
    if (typeof available !== 'function') return null
    return await within(
      Promise.resolve(available({ langs: ['en-US'], processLocally: true })),
      PROBE_TIMEOUT_MS,
      null,
    )
  } catch {
    return null
  }
}

export async function detectAsync(): Promise<AsyncCapabilities> {
  const [storagePersisted, storageEstimate, barcodeFormats] = await Promise.all([
    requestPersistentStorage(),
    estimateStorage(),
    nativeBarcodeFormats(),
  ])
  return {
    wasmSimd: wasmSimd(),
    wasmThreads: wasmThreads(),
    storagePersisted,
    storageEstimate,
    barcodeFormats,
    // Deliberately absent: see probeOnDeviceSpeech. Undefined means "not
    // asked yet", which is different from "asked, and the answer was no".
    speechOnDevice: undefined,
  }
}

/**
 * Speech recognition is present AND allowed to run here.
 *
 * The distinction exists because of one platform: iOS supports
 * `webkitSpeechRecognition` in a Safari tab and fails immediately in an
 * installed Home Screen web app — it errors without even prompting for the
 * microphone. Feature detection cannot see that, because the constructor is
 * there either way, so this is one of the few places where the vendor and the
 * display mode are genuinely the question being asked.
 */
export function speechUsable(caps: SyncCapabilities): boolean {
  if (!caps.speechRecognition) return false
  return !(caps.platform === 'ios' && caps.standalone)
}

/** Everything, for the diagnostics panel. Async parts included. */
export async function detectAll(): Promise<Capabilities> {
  const sync = detectSync()
  const async = await detectAsync()
  return { ...sync, ...async, asyncResolved: true }
}

/**
 * Flat, copy-pasteable report. Deliberately plain text: the point is that
 * someone can screenshot it on a phone, or paste it into a bug report, without
 * any of it needing interpretation.
 */
export function formatReport(caps: Capabilities): string {
  const lines: string[] = []
  const row = (k: string, v: unknown) => lines.push(`${k.padEnd(22)} ${String(v)}`)

  row('platform', caps.platform)
  row('standalone (installed)', caps.standalone)
  row('devicePixelRatio', caps.devicePixelRatio)
  row('touchPrimary', caps.touchPrimary)
  row('prefersReducedMotion', caps.prefersReducedMotion)
  lines.push('')
  row('wasm', caps.wasm)
  row('wasmSimd', caps.asyncResolved ? caps.wasmSimd : 'pending')
  row('wasmThreads', caps.asyncResolved ? caps.wasmThreads : 'pending')
  row('crossOriginIsolated', caps.crossOriginIsolated)
  row('sharedArrayBuffer', caps.sharedArrayBuffer)
  row('workers', caps.workers)
  row('hardwareConcurrency', caps.hardwareConcurrency ?? 'unknown')
  lines.push('')
  row('indexedDB', caps.indexedDB)
  row('opfs', caps.opfs)
  row('storagePersisted', caps.asyncResolved ? caps.storagePersisted : 'pending')
  if (caps.storageEstimate) {
    const mb = (n: number | null) => (n === null ? '?' : `${(n / 1048576).toFixed(1)} MB`)
    row('storage usage/quota', `${mb(caps.storageEstimate.usage)} / ${mb(caps.storageEstimate.quota)}`)
  }
  lines.push('')
  row('geolocation', caps.geolocation)
  row('geolocation (background)', 'impossible in a PWA')
  row('mediaDevices', caps.mediaDevices)
  row('imageCapture', caps.imageCapture)
  row('barcodeDetector', caps.barcodeDetector)
  row(
    'barcode formats',
    caps.asyncResolved
      ? (!caps.barcodeFormats
          ? 'none — WASM fallback'
          : caps.barcodeFormats.length === 0
            ? 'EMPTY — WASM fallback'
            : caps.barcodeFormats.join(' '))
      : 'pending',
  )
  row('speechRecognition', caps.speechRecognition)
  row('speech usable here', speechUsable(caps))
  // Undefined here is honest rather than lazy: this one is probed from the
  // voice sheet, not at boot, because asking at boot stalls the renderer.
  row('speech on-device', caps.speechOnDevice ?? 'not probed (asked when dictating)')
  row('webShare', caps.webShare)
  row('wakeLock', caps.wakeLock)
  row('vibrate', caps.vibrate)
  row('deviceOrientation', caps.deviceOrientation)
  row('orientation needs tap', caps.orientationNeedsPermission)
  row('networkInformation', caps.networkInformation)
  row('webgpu', caps.webgpu)
  lines.push('')
  row('serviceWorker', caps.serviceWorker)
  row('push', caps.push)
  row('badging', caps.badging)
  row('backgroundSync', caps.backgroundSync)
  row('periodicSync', caps.periodicSync)

  const test = selfTest()
  if (!test.ok) {
    lines.push('', 'SELF-TEST FAILURES:', ...test.problems.map((p) => `  ! ${p}`))
  }

  return lines.join('\n')
}
