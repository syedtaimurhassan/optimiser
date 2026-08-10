import { useEffect, useRef, useState } from 'react'
import {
  describeVoiceError,
  startListening,
  voiceAvailability,
  voiceIsLocal,
  type VoiceSession,
} from '../../lib/voice'
import { useDeviceStore } from '../../store/deviceStore'
import { Sheet } from '../ui'
import { MicIcon } from '../ui/icons'

/**
 * Dictate an address.
 *
 * Two screens in one sheet, and the second is the point of the milestone: on a
 * device that cannot do this, the tile still opens, and what it shows is a
 * reason and the next best action rather than nothing.
 */
export function VoiceSheet({
  open,
  onClose,
  onText,
}: {
  open: boolean
  onClose: () => void
  /** The finished transcript. Fired once, then the sheet closes. */
  onText: (text: string) => void
}) {
  const capabilities = useDeviceStore((s) => s.capabilities)
  const availability = voiceAvailability(capabilities)
  const local = voiceIsLocal(capabilities.speechOnDevice)

  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<VoiceSession | null>(null)

  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  useEffect(() => {
    if (!open || !availability.usable) return

    setHeard('')
    setError(null)

    sessionRef.current = startListening(
      {
        onInterim: setHeard,
        onFinal: (text) => {
          setHeard(text)
          onTextRef.current(text)
        },
        onError: (e) => setError(describeVoiceError(e)),
      },
      { preferLocal: true },
    )

    return () => {
      // Stopping on close is not politeness. A recogniser left running keeps
      // the microphone indicator lit, and a driver who sees that in a van has
      // every reason to distrust the app for the rest of the round.
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [open, availability.usable])

  return (
    <Sheet open={open} onClose={onClose} label="Dictate an address" zIndex={2150}>
      <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {availability.usable ? (
          <>
            <div className="flex items-center gap-3 px-1 pt-1">
              <span className="flex h-touch w-touch items-center justify-center rounded-pill bg-primary/10 text-primary">
                <MicIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-label font-semibold text-on-surface">
                  {error ? 'Not listening' : 'Listening…'}
                </p>
                <p className="text-meta text-on-surface-variant">
                  {error ?? 'Say the address, then pause.'}
                </p>
              </div>
            </div>

            <p
              aria-live="polite"
              className="mt-3 min-h-16 rounded-row bg-surface-variant p-3 text-label text-on-surface"
            >
              {heard || <span className="text-on-surface-variant">…</span>}
            </p>

            {/* Said plainly, because the app's whole claim is that it computes
                on the device, and this one feature may not. */}
            <p className="px-1 pt-2 text-meta text-on-surface-variant">
              {local
                ? 'Recognised on this device. Your voice is not sent anywhere.'
                : 'Your browser sends the audio to its speech service to transcribe it.'}
            </p>
          </>
        ) : (
          <>
            <p className="px-1 pt-1 text-label font-semibold text-on-surface">
              {availability.message}
            </p>
            <p className="px-1 pt-1 text-meta text-on-surface-variant">{availability.fallback}</p>
            <button
              type="button"
              data-testid="voice-type-instead"
              onClick={onClose}
              className="mt-3 flex min-h-touch w-full items-center justify-center rounded-row bg-primary px-4 text-label font-semibold text-on-primary"
            >
              Type it instead
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
