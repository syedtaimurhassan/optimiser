import { useState } from 'react'
import { compressPhoto } from '../../lib/photos'
import { describeEngine, readText, type OcrResult } from '../../lib/ocr/engine'
import { bestAddress, manifestCandidates } from '../../lib/ocr/parseAddress'
import { Sheet } from '../ui'

/**
 * Read an address off a label or a round sheet.
 *
 * ── This is an assist, and it says so ─────────────────────────────────────
 *
 * Nothing here geocodes anything until the driver has seen the text and had
 * the chance to change it. The recogniser is right most of the time and wrong
 * in ways that look plausible — a 6 for a 5, "Løvfrøvej" for "Lovfrovej" — and
 * the cost of a silent wrong answer is a van at the wrong door. The cost of
 * this confirm step is one tap.
 *
 * ── A still, not a live camera ────────────────────────────────────────────
 *
 * The barcode scanner reads frames continuously because a barcode either
 * decodes or does not. Text recognition takes seconds per image on the CPU
 * path, so a live loop would be a queue of stale frames and a hot phone. One
 * photo, one read, one result to check.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'done'; result: OcrResult; lines: string[] }
  | { kind: 'error'; message: string }

export function ScanTextSheet({
  open,
  onClose,
  mode,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  /** One address off a parcel, or many off a printed round sheet. */
  mode: 'address' | 'manifest'
  onConfirm: (texts: string[]) => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [chosen, setChosen] = useState<Record<number, boolean>>({})
  const [edited, setEdited] = useState('')

  async function run(file: File) {
    setPhase({ kind: 'reading' })
    try {
      // Bigger and cleaner than a delivery photo: the recogniser needs the
      // strokes, and 1600px is where a label's small print survives.
      const image = await compressPhoto(file, 1600, 0.92)
      const result = await readText(image)

      if ('ok' in result) {
        setPhase({
          kind: 'error',
          message:
            result.reason === 'models-missing'
              ? 'The text-recognition models are not installed on this deployment. Run `npm run ocr:models` and redeploy.'
              : `Text recognition could not start. ${result.detail}`,
        })
        return
      }

      const texts = result.lines.map((l) => l.text)
      const lines = mode === 'manifest' ? manifestCandidates(texts) : texts
      setChosen(Object.fromEntries(lines.map((_, i) => [i, true])))
      setEdited(mode === 'address' ? (bestAddress(texts) ?? '') : '')
      setPhase({ kind: 'done', result, lines })
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'That image could not be read.' })
    }
  }

  function confirm() {
    if (phase.kind !== 'done') return
    const texts =
      mode === 'address'
        ? edited.trim()
          ? [edited.trim()]
          : []
        : phase.lines.filter((_, i) => chosen[i])
    if (texts.length > 0) onConfirm(texts)
    onClose()
    setPhase({ kind: 'idle' })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={mode === 'manifest' ? 'Scan a route manifest' : 'Scan an address'}
      zIndex={2200}
    >
      <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="px-1 pt-1 text-label font-semibold text-on-surface">
          {mode === 'manifest' ? 'Scan a route manifest' : 'Scan an address'}
        </p>
        <p className="px-1 pb-3 pt-0.5 text-meta text-on-surface-variant">
          {mode === 'manifest'
            ? 'Photograph the printed sheet. Everything found is shown for you to tick before it is added.'
            : 'Photograph the label. What is read is shown for you to correct before anything is looked up.'}
        </p>

        {phase.kind === 'idle' && (
          <label className="flex min-h-touch cursor-pointer items-center justify-center rounded-row bg-primary px-4 text-label font-semibold text-on-primary">
            Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              data-testid="ocr-file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void run(file)
              }}
            />
          </label>
        )}

        {phase.kind === 'reading' && (
          <p role="status" className="rounded-row bg-surface-variant p-3 text-label text-on-surface">
            Reading the image… this runs on your device and can take a few seconds.
          </p>
        )}

        {phase.kind === 'error' && (
          <div className="space-y-2">
            <p className="rounded-row bg-danger-container p-3 text-label text-on-danger-container">
              {phase.message}
            </p>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'idle' })}
              className="flex min-h-touch w-full items-center justify-center rounded-row border border-outline text-label font-semibold text-on-surface"
            >
              Try another photo
            </button>
          </div>
        )}

        {phase.kind === 'done' && (
          <div className="space-y-2">
            {/* The honest header: which engine ran and how long it took, so a
                driver deciding whether this is worth doing again has the
                number rather than a feeling. */}
            <p className="px-1 text-meta text-on-surface-variant">
              {describeEngine(phase.result.engine)} Took {(phase.result.elapsedMs / 1000).toFixed(1)}s.
            </p>

            {phase.lines.length === 0 ? (
              <p className="rounded-row bg-surface-variant p-3 text-label text-on-surface">
                Nothing address-shaped was found. Try again with the label filling more of the frame.
              </p>
            ) : mode === 'address' ? (
              <label className="block">
                <span className="px-1 text-meta text-on-surface-variant">Address — edit if wrong</span>
                <input
                  value={edited}
                  onChange={(e) => setEdited(e.target.value)}
                  data-testid="ocr-address"
                  className="mt-1 min-h-touch w-full rounded-row border border-outline px-3 text-label text-on-surface"
                />
              </label>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {phase.lines.map((line, i) => (
                  <label
                    key={`${line}-${i}`}
                    className="flex min-h-touch items-center gap-3 rounded-row border border-outline px-3"
                  >
                    <input
                      type="checkbox"
                      checked={chosen[i] ?? false}
                      onChange={(e) => setChosen((c) => ({ ...c, [i]: e.target.checked }))}
                      className="h-5 w-5"
                    />
                    <span className="min-w-0 flex-1 truncate text-label text-on-surface">{line}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={confirm}
              data-testid="ocr-confirm"
              className="flex min-h-touch w-full items-center justify-center rounded-row bg-primary px-4 text-label font-semibold text-on-primary"
            >
              {mode === 'manifest'
                ? `Add ${Object.values(chosen).filter(Boolean).length} stops`
                : 'Look up this address'}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
