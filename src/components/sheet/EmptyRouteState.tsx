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
  /** Hidden when there is no past route worth copying from. */
  canCopy: boolean
}

export function EmptyRouteState({ onAddStops, onCopyFromPast, canCopy }: EmptyRouteStateProps) {
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
    </div>
  )
}
