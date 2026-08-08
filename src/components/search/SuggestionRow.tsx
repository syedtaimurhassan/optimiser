import type { Suggestion } from '../../lib/geocoding/types.ts'
import { PinPlusIcon } from '../ui/icons'

/**
 * One "Add a new stop" result.
 *
 * Deliberately NOT a `StopRow`. The two sections of the search screen look
 * similar on purpose — same height, same rhythm — but they must never be
 * confusable, because tapping one navigates to a stop the driver already has
 * and tapping the other creates one. The leading pin-plus is what separates
 * them, and it sits in the same fixed-width gutter the sequence number occupies
 * on a stop row so the two lists' text still starts at the same x.
 */
export interface SuggestionRowProps {
  suggestion: Suggestion
  onSelect: (suggestion: Suggestion) => void
}

export function SuggestionRow({ suggestion, onSelect }: SuggestionRowProps) {
  const { address } = suggestion

  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      data-testid="suggestion-row"
      data-place-id={suggestion.placeId ?? ''}
      // "Add" rather than the bare address: a screen-reader user gets the verb
      // before the noun, which is the part that differs between the sections.
      aria-label={`Add ${address.title}${address.subtitle ? `, ${address.subtitle}` : ''}`}
      className="flex min-h-row w-full items-center gap-3 pr-4 text-left active:bg-surface-variant"
    >
      {/* Matches the stop row's gutter width so both lists align. */}
      <span className="flex w-12 shrink-0 items-center justify-center text-on-surface-variant">
        <PinPlusIcon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1 py-3">
        <span className="block truncate text-row font-medium text-on-surface">{address.title}</span>
        {address.subtitle && (
          <span className="block truncate text-body text-on-surface-variant">
            {address.subtitle}
          </span>
        )}
      </span>
    </button>
  )
}
