import { useEffect, useRef, useState } from 'react'
import { createScanner, type ScanResult, type Scanner } from '../../lib/scan'
import { hapticTap } from '../../lib/device/haptics'
import { Sheet } from '../ui'
import { CloseIcon } from '../ui/icons'

/**
 * The camera, pointed at a parcel.
 *
 * ── Why we draw our own frames ────────────────────────────────────────────
 *
 * The short way to sample a camera is `ImageCapture.grabFrame()`. No WebKit
 * browser implements it, so on the platform that most needs the WASM decoder
 * there is nothing to grab with. Drawing the video into a canvas works
 * everywhere and has a second benefit: we choose the resolution, and decoding
 * a 720px frame instead of a 4K one is the difference between a scanner that
 * keeps up and one that heats the phone.
 *
 * ── Why a timer and not requestAnimationFrame ─────────────────────────────
 *
 * rAF offers 60 frames a second. A decode takes tens of milliseconds and the
 * driver's hand does not move that fast, so all rAF would buy is a hot phone
 * and a flat battery. Eight attempts a second finds a code as fast as a person
 * can present one.
 */

const SCAN_INTERVAL_MS = 125
/** Frames are downscaled to this width before decoding. */
const DECODE_WIDTH = 720

type Status = 'starting' | 'scanning' | 'denied' | 'nocamera' | 'error'

export interface ScannerSheetProps {
  open: boolean
  onClose: () => void
  /** Called once per accepted code. The sheet stops scanning immediately after. */
  onScan: (result: ScanResult) => void
  title?: string
  /** The line under the title — what this particular scan is FOR. */
  hint?: string
}

export function ScannerSheet({
  open,
  onClose,
  onScan,
  title = 'Scan a barcode',
  hint,
}: ScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [engine, setEngine] = useState<Scanner['engine'] | null>(null)
  const [torch, setTorch] = useState<boolean | null>(null)

  /**
   * The scanner, kept across renders so the file fallback can reuse it.
   *
   * Loading ZXing costs a megabyte; a driver who has just been denied camera
   * permission and reaches for the photo picker should not pay it twice.
   */
  const scannerRef = useRef<Scanner | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  /**
   * Guards against a second delivery.
   *
   * The decode loop is already in flight when a code is found, and a barcode
   * sits in frame for several hundred milliseconds — long enough for three
   * more decodes of the same code. Without this the driver gets one scan and
   * four navigations.
   */
  const doneRef = useRef(false)

  /**
   * The callback, held in a ref so it is not an effect dependency.
   *
   * `onScan` is written inline at every call site, so it is a new function on
   * every parent render. As a dependency it would tear down and restart the
   * camera each time anything on the sheet behind us changed — a preview that
   * flickers, a permission prompt that can reappear, and a decode loop that
   * never gets far enough to read anything.
   */
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!open) return

    doneRef.current = false
    setStatus('starting')
    setEngine(null)
    setTorch(null)

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let stream: MediaStream | null = null
    /**
     * The element we actually attached the stream to.
     *
     * Held locally rather than read from the ref at cleanup: `Sheet` mounts its
     * children a render after `open` flips, so the ref is still null when this
     * effect starts, and by the time cleanup runs the ref may already point
     * somewhere else. The element that was given a stream is the one that has
     * to be handed it back.
     */
    let videoEl: HTMLVideoElement | null = null
    const canvas = document.createElement('canvas')

    const deliver = (result: ScanResult) => {
      if (doneRef.current) return
      doneRef.current = true
      // The one confirmation that reaches a driver who is looking at a parcel
      // rather than at the screen.
      hapticTap()
      onScanRef.current(result)
    }

    const tick = async () => {
      const video = videoRef.current
      const scanner = scannerRef.current
      if (cancelled || doneRef.current || !video || !scanner) return

      // readyState < 2 means there is no frame yet — the first few ticks after
      // play() land here, and drawing then throws.
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const scale = Math.min(1, DECODE_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          try {
            const found = await scanner.detect(canvas)
            if (found.length > 0) {
              deliver(found[0])
              return
            }
          } catch {
            // A frame that fails to decode is the normal case, not an error.
          }
        }
      }

      if (!cancelled && !doneRef.current) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS)
    }

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus('nocamera')
          return
        }

        // The decoder first: asking for the camera and then spending a second
        // fetching a wasm module leaves the preview live and inert, which
        // looks exactly like a scanner that cannot read anything.
        scannerRef.current ??= await createScanner()
        if (cancelled) return
        setEngine(scannerRef.current.engine)

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            // `ideal`, not `exact`: a laptop has no environment camera and
            // `exact` would fail rather than fall back to the one it has.
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        const video = videoRef.current
        if (!video) return
        videoEl = video
        video.srcObject = stream
        // iOS refuses to play an inline video without both of these, and a
        // muted autoplay is the only kind it will start without a gesture.
        video.setAttribute('playsinline', 'true')
        await video.play()

        const track = stream.getVideoTracks()[0] ?? null
        trackRef.current = track
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined
        setTorch(caps?.torch ? false : null)

        setStatus('scanning')
        void tick()
      } catch (e) {
        if (cancelled) return
        const name = e instanceof DOMException ? e.name : ''
        setStatus(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'nocamera'
              : 'error',
        )
      }
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      // Releasing the track is what turns the camera light off. A sheet that
      // closes without doing this leaves a driver looking at a phone that says
      // it is still recording them.
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
      if (videoEl) videoEl.srcObject = null
    }
  }, [open])

  async function toggleTorch() {
    const track = trackRef.current
    if (!track || torch === null) return
    const next = !torch
    try {
      // `torch` is a real constraint on Android and is absent from the DOM
      // typings, which describe the spec rather than what shipped.
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setTorch(next)
    } catch {
      // Some devices advertise torch and refuse it while the stream is live.
      setTorch(null)
    }
  }

  /** The way in when the camera is unavailable: a photo, from anywhere. */
  async function scanFile(file: File) {
    try {
      scannerRef.current ??= await createScanner()
      // A File is not a CanvasImageSource, and the native detector will not
      // take one. An ImageBitmap is accepted by both implementations.
      const bitmap = await createImageBitmap(file)
      const found = await scannerRef.current.detect(bitmap)
      bitmap.close()
      if (found.length > 0) {
        hapticTap()
        onScanRef.current(found[0])
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} side="full" label={title} zIndex={2200}>
      <div className="relative flex h-full w-full flex-col bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Chrome above the picture. */}
        <div className="relative flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p className="text-label font-semibold text-white drop-shadow">{title}</p>
            {hint && <p className="truncate text-meta text-white/80 drop-shadow">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            data-testid="scanner-close"
            className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill bg-black/40 text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* The reticle. Decoding uses the whole frame — this is an aiming aid,
            not a crop, because a driver who lines a label up inside a box and
            gets nothing has been lied to. */}
        <div className="pointer-events-none relative flex flex-1 items-center justify-center">
          {status === 'scanning' && (
            <div className="h-40 w-64 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          )}
        </div>

        <div className="relative space-y-2 p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {status === 'starting' && (
            <p className="rounded-row bg-black/50 p-3 text-label text-white">Starting the camera…</p>
          )}

          {status === 'scanning' && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-meta text-white/70">
                {engine === 'wasm' ? 'Reading with ZXing' : 'Reading with the system scanner'}
              </p>
              {torch !== null && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  data-testid="scanner-torch"
                  aria-pressed={torch}
                  className="min-h-touch rounded-pill bg-white/15 px-4 text-label font-semibold text-white"
                >
                  {torch ? 'Light off' : 'Light on'}
                </button>
              )}
            </div>
          )}

          {(status === 'denied' || status === 'nocamera' || status === 'error') && (
            <div className="space-y-2 rounded-row bg-surface p-3">
              <p className="text-label font-semibold text-on-surface">
                {status === 'denied'
                  ? 'Camera permission is off'
                  : status === 'nocamera'
                    ? 'No camera available'
                    : 'That image had no barcode we could read'}
              </p>
              <p className="text-meta text-on-surface-variant">
                {status === 'denied'
                  ? 'Allow camera access for this site in your browser settings, or pick a photo of the label instead.'
                  : 'Pick a photo of the label instead — it is read on this device, exactly the same way.'}
              </p>
              {/* Not a dead end. The file input reaches the same decoder, and
                  on a phone `capture` opens the camera app directly. */}
              <label className="flex min-h-touch cursor-pointer items-center justify-center rounded-row bg-primary px-4 text-label font-semibold text-on-primary">
                Choose a photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  data-testid="scanner-file"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void scanFile(file)
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
