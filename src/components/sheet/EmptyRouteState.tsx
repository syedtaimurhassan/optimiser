import { FullWidthButton } from '../ui/FullWidthButton'
import { PinPlusDashedIcon } from '../ui/icons'

/**
 * What a route with no stops shows instead of a list.
 *
 * The two buttons are the two ways a route actually starts, and their
 * emphasis says which is which: adding stops is filled because it is what
 * almost everyone does, and copying is outlined because it is the shortcut for
 * the driver who runs the same round every week — enormously valuable to the
 * people it applies to, and irrelevant to everyone else.
 *
 * There is no illustration beyond the glyph on purpose. An empty state is read
 * once and then never again, and the thing it has to do is get out of the way
 * of the first tap.
 */
export interface EmptyRouteStateProps {
  onAddStops: () => void
  onCopyFromPast: () => void
  onImportFile: () => void
  /** Hidden when there is no past route worth copying from. */
  canCopy: boolean
}

export function EmptyRouteState({
  onAddStops,
  onCopyFromPast,
  onImportFile,
  canCopy,
}: EmptyRouteStateProps) {
  return (
    <div data-testid="empty-route" className="flex flex-col items-center px-4 pb-8 pt-10">
      <PinPlusDashedIcon className="h-14 w-14 text-on-surface-variant" />
      <p className="mt-4 max-w-xs text-center text-body text-on-surface-variant">
        Add your first stops to start creating your route
      </p>

      <div className="mt-6 w-full space-y-2">
        <FullWidthButton onClick={onAddStops}>+ Add stops</FullWidthButton>
        {/*
          Offered only when there is something to copy. A button that opens a
          picker with nothing in it is worse than no button: it costs a tap to
          learn the feature does not apply to you yet.
        */}
        {canCopy && (
          <FullWidthButton variant="outlined" onClick={onCopyFromPast}>
            Copy stops from a past route
          </FullWidthButton>
        )}
      </div>

      {/*
        Import is a text link, not a third button. The design names two
        buttons and it is right to: a file import is a once-a-week action for
        the few drivers who get a manifest, and giving it equal weight would
        make the two common paths harder to pick out for everyone else.
      */}
      <button
        type="button"
        onClick={onImportFile}
        data-testid="empty-import"
        className="mt-4 min-h-touch rounded-pill px-3 text-label font-semibold text-primary active:bg-surface-variant"
      >
        Import from a file
      </button>
    </div>
  )
}
