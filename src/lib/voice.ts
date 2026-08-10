import { speechUsable, type SyncCapabilities } from './device/capabilities.ts'

/**
 * Dictating an address instead of typing it, where that is possible.
 *
 * Framework-free: this owns the recogniser's lifecycle and nothing about the
 * screen. `speechUsable` in device/capabilities.ts owns the one platform rule
 * that feature detection cannot express.
 */

// The Web Speech API is still prefixed in WebKit and is not in lib.dom for
// the prefixed name, so the shape we use is declared rather than imported.
interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  processLocally?: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function recognitionCtor(): RecognitionCtor | null {
  const g = globalThis as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null
}

export type VoiceUnavailable = 'unsupported' | 'ios-standalone'

export interface VoiceAvailability {
  usable: boolean
  reason: VoiceUnavailable | null
  /** What to tell the driver. Never a dead control with no explanation. */
  message: string | null
  /** The action that replaces it. */
  fallback: string | null
}

/**
 * Can this device dictate, and if not, what do we say instead?
 *
 * The iOS case is the one worth spelling out. `webkitSpeechRecognition` EXISTS
 * in an installed Home Screen web app and fails the moment it is started —
 * it errors without even prompting for the microphone. A tile that looked
 * enabled and did nothing would be indistinguishable from a bug, so the tile
 * stays live, says why, and does the useful thing instead.
 */
export function voiceAvailability(caps: SyncCapabilities): VoiceAvailability {
  if (speechUsable(caps)) return { usable: true, reason: null, message: null, fallback: null }

  if (caps.speechRecognition && caps.platform === 'ios' && caps.standalone) {
    return {
      usable: false,
      reason: 'ios-standalone',
      message: 'Voice does not work in an installed app on iPhone — Apple blocks it here.',
      fallback: 'Open this route in Safari to dictate, or type the address instead.',
    }
  }

  return {
    usable: false,
    reason: 'unsupported',
    message: 'This browser cannot do speech recognition.',
    fallback: 'Type the address instead.',
  }
}

/**
 * Whether the driver's voice leaves the device.
 *
 * Chrome streams audio to Google's servers unless an on-device language pack
 * is installed and asked for (Chrome 139+). For an app whose whole premise is
 * that it computes everything locally, that is a disclosure the UI owes the
 * driver rather than a footnote.
 */
export function voiceIsLocal(onDevice: string | null | undefined): boolean {
  return onDevice === 'available'
}

export interface VoiceSession {
  stop(): void
}

export interface VoiceHandlers {
  /** Fired repeatedly with the best transcript so far. */
  onInterim?: (text: string) => void
  /** Fired once, with the text the driver actually said. */
  onFinal: (text: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

/**
 * Start listening. Returns a handle, or null when there is nothing to start.
 *
 * `continuous` is false: this dictates ONE address into a search field, and a
 * recogniser that keeps listening after the driver stops talking is one that
 * keeps the microphone indicator lit in a van for the rest of the round.
 */
export function startListening(
  handlers: VoiceHandlers,
  options: { lang?: string; preferLocal?: boolean } = {},
): VoiceSession | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = options.lang ?? navigator.language ?? 'en-US'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  // Ignored everywhere it is not implemented, which is everywhere but recent
  // Chrome. Asking costs nothing and is the difference between the audio
  // staying on the phone and not.
  if (options.preferLocal) recognition.processLocally = true

  recognition.onresult = (e) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) final += text
      else interim += text
    }
    if (final.trim()) handlers.onFinal(final.trim())
    else if (interim.trim()) handlers.onInterim?.(interim.trim())
  }

  recognition.onerror = (e) => handlers.onError?.(e.error ?? 'unknown')
  recognition.onend = () => handlers.onEnd?.()

  try {
    recognition.start()
  } catch {
    // Starting twice throws. Treat it as "already listening" rather than as
    // a failure the driver needs to hear about.
    return { stop: () => recognition.abort() }
  }

  return { stop: () => recognition.stop() }
}

/** Plain-English reasons, because "not-allowed" is not a sentence. */
export function describeVoiceError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission is off for this site.'
    case 'no-speech':
      return 'Nothing was heard. Try again, closer to the phone.'
    case 'audio-capture':
      return 'No microphone was available.'
    case 'network':
      return 'Speech recognition needs a network here, and there is none.'
    case 'aborted':
      return 'Listening stopped.'
    default:
      return 'Speech recognition failed.'
  }
}
