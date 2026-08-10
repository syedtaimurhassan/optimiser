import type { AddressedStop } from '../../types'
import { titleFor } from '../../lib/routeList'
import { IdChip, ListRow, Sheet } from '../ui'

/**
 * What to do when a scan does not land on exactly one stop.
 *
 * Two cases, and they are deliberately not merged into a best guess:
 *
 * `ambiguous` — two stops carry the label that was scanned, which "Reset Stop
 *   IDs" makes possible and types.ts warns about. Picking the first would send
 *   a driver to the wrong door half the time this happened, and it would do it
 *   silently. So the driver picks, with the addresses in front of them, which
 *   is a question they can answer in one glance and we cannot answer at all.
 *
 * `unknown` — a real barcode that means nothing to this route yet. Almost
 *   always a carrier's tracking number. Showing the decoded text matters: it
 *   is the difference between "the scanner is broken" and "this parcel isn't
 *   on today's round".
 */
export function ScanMatchSheet({
  open,
  onClose,
  text,
  candidates,
  onPickStop,
  onSearch,
}: {
  open: boolean
  onClose: () => void
  /** The decoded payload, shown verbatim. */
  text: string
  /** Stops sharing the scanned label. Empty for the unknown case. */
  candidates: AddressedStop[]
  onPickStop: (stopId: string) => void
  /** Hand the text to the search field, for the unknown case. */
  onSearch: (text: string) => void
}) {
  const ambiguous = candidates.length > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={ambiguous ? 'Which stop is this?' : 'No matching stop'}
      zIndex={2250}
    >
      <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="px-1 pt-1 text-label font-semibold text-on-surface">
          {ambiguous ? 'Two stops carry this label' : 'Nothing on this route matches'}
        </p>
        <p className="px-1 pb-3 pt-0.5 text-meta text-on-surface-variant">
          {ambiguous
            ? 'Stop IDs were reset at some point, so this label is on more than one stop. Pick the right one.'
            : 'Scanned, but this code is not linked to any stop on this route.'}
        </p>

        {/* The code itself, in mono, unabbreviated. A driver comparing it with
            what is printed on the box needs every character. */}
        <p className="mb-3 break-all rounded-row bg-surface-variant p-3 font-mono text-meta text-on-surface">
          {text}
        </p>

        {ambiguous ? (
          <div className="space-y-2">
            {candidates.map((stop) => (
              <ListRow
                key={stop.id}
                outlined
                leading={<IdChip stopId={stop.stopId} />}
                title={titleFor(stop)}
                subtitle={stop.address?.subtitle}
                onClick={() => {
                  onPickStop(stop.id)
                  onClose()
                }}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            data-testid="scan-search"
            onClick={() => {
              onSearch(text)
              onClose()
            }}
            className="flex min-h-touch w-full items-center justify-center rounded-row bg-primary px-4 text-label font-semibold text-on-primary"
          >
            Search for this text
          </button>
        )}
      </div>
    </Sheet>
  )
}
