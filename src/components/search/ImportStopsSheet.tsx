import { useRef, useState } from 'react'
import { importStopFile, type ImportFileResult } from '../../lib/parseFile'
import { useAddStops } from '../../hooks/useAddStops'
import { FullWidthButton } from '../ui/FullWidthButton'
import { Sheet } from '../ui/Sheet'

/**
 * Importing a file of stops.
 *
 * Three states in one sheet — pick a file, confirm what was found, watch it
 * geocode — because they are one task and a wizard would make the driver
 * navigate between steps they cannot go back to anyway.
 *
 * ── The report is the feature ─────────────────────────────────────────────
 *
 * The old importer answered "here are your waypoints" and silently dropped
 * everything it could not read. A file where row 34 has a typo is the normal
 * case, and a count that quietly disagrees with the spreadsheet is how a
 * driver ends the day one parcel short with no idea which. So every row that
 * fails is listed, by line, and the failures are shown AFTER the import rather
 * than instead of it — the good rows should not wait for the bad ones.
 */
export interface ImportStopsSheetProps {
  open: boolean
  onClose: () => void
}

export function ImportStopsSheet({ open, onClose }: ImportStopsSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ImportFileResult | null>(null)
  const [fileName, setFileName] = useState('')
  const { addFromImportedRows, cancel, progress, resetProgress } = useAddStops()

  function reset() {
    setParsed(null)
    setFileName('')
    resetProgress()
  }

  function close() {
    reset()
    onClose()
  }

  const finished = progress.total > 0 && !progress.running

  return (
    <Sheet open={open} onClose={close} side="full" label="Import stops from a file" zIndex={2100}>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-outline px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-title font-semibold text-on-surface">
            Import stops
          </h2>
          <button
            type="button"
            onClick={close}
            className="min-h-touch rounded-pill px-3 text-row font-semibold text-on-surface"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {!parsed ? (
            <>
              <p className="text-body text-on-surface-variant">
                A CSV, TSV, XLSX or JSON file with either <code>lat</code> and <code>lng</code>{' '}
                columns, or an <code>address</code> column. Recipient and note columns are
                imported too.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.json,text/csv,application/json"
                data-testid="import-file-input"
                className="mt-4 block w-full text-body text-on-surface"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setFileName(file.name)
                  setParsed(await importStopFile(file))
                }}
              />
            </>
          ) : (
            <>
              <p className="text-row font-medium text-on-surface">{fileName}</p>
              <p className="mt-1 text-body text-on-surface-variant">
                {parsed.rows.length} {parsed.rows.length === 1 ? 'stop' : 'stops'} found
                {parsed.needsGeocoding > 0 && ` · ${parsed.needsGeocoding} need an address lookup`}
              </p>

              {progress.running && (
                <div className="mt-4" data-testid="import-progress">
                  <p className="text-body text-on-surface">
                    Looking up addresses… {progress.done} of {progress.total}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-variant">
                    <div
                      className="h-full rounded-pill bg-primary transition-[width] duration-200"
                      style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {finished && (
                <p className="mt-4 text-body text-on-surface" data-testid="import-result">
                  {progress.cancelled
                    ? `Stopped. ${progress.done - progress.failures.length} added.`
                    : `Added ${progress.done - progress.failures.length} of ${progress.total}.`}
                </p>
              )}

              {/*
                Every failure, by line. Truncated at twenty with a count,
                because a wholly malformed file would otherwise render a
                thousand rows nobody reads — and the first twenty are enough
                to see the pattern.
              */}
              {(parsed.errors.length > 0 || progress.failures.length > 0) && (
                <div className="mt-4" data-testid="import-errors">
                  <h3 className="text-label font-semibold uppercase tracking-wide text-on-surface-variant">
                    Could not import
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {[...parsed.errors, ...progress.failures.map((f) => `No match: ${f}`)]
                      .slice(0, 20)
                      .map((message) => (
                        <li key={message} className="text-body text-on-surface-variant">
                          {message}
                        </li>
                      ))}
                  </ul>
                  {parsed.errors.length + progress.failures.length > 20 && (
                    <p className="mt-1 text-meta text-on-surface-variant">
                      …and {parsed.errors.length + progress.failures.length - 20} more
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {parsed && (
          <div
            className="border-t border-outline p-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {progress.running ? (
              // Cancel keeps whatever already resolved. Discarding forty good
              // stops because the driver stopped on the forty-first would make
              // cancelling more expensive than waiting.
              <FullWidthButton variant="outlined" onClick={cancel}>
                Stop — keep what has been added
              </FullWidthButton>
            ) : finished ? (
              <FullWidthButton onClick={close}>Done</FullWidthButton>
            ) : (
              <FullWidthButton
                disabled={parsed.rows.length === 0}
                onClick={() => void addFromImportedRows(parsed.rows)}
              >
                {parsed.rows.length === 1 ? 'Add 1 stop' : `Add ${parsed.rows.length} stops`}
              </FullWidthButton>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
