import type { ReactNode } from 'react'

/**
 * How prominent one action in the row is.
 *
 * `filled` is the primary slot and there is at most ONE of them in a row —
 * that is the whole rule the stop card is built on. `outlined` is a real
 * action that is not the expected one. `plain` is the flat grey the row
 * shipped with in M3, still the right treatment when the three actions are
 * peers (the search tiles, the gallery).
 */
export type ActionVariant = 'filled' | 'outlined' | 'plain'

export interface QuickAction {
  label: string
  /**
   * The glyph. Any colour it needs is its OWN — `ParcelCheckIcon` carries its
   * green tick and `ParcelCrossIcon` its red cross, so the box stays neutral
   * and the mark stays semantic wherever either is used.
   */
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  variant?: ActionVariant
  /** Destructive actions render their LABEL in red. At most one per row. */
  destructive?: boolean
  testId?: string
}

const VARIANTS: Record<ActionVariant, string> = {
  filled: 'bg-primary text-on-primary active:bg-primary-pressed',
  outlined: 'border border-outline bg-surface text-on-surface active:bg-surface-variant',
  plain: 'bg-surface-variant text-on-surface',
}

/**
 * Three equal-width actions across a row, icon above label.
 *
 * Fixed at three because that is what fits on a 360dp screen at a 44dp touch
 * target with labels that are still readable; a fourth would either shrink the
 * targets or truncate the words. Fewer than three is allowed and the row stays
 * evenly divided.
 *
 * ── Why `tall` is roughly double a minimum target ─────────────────────────
 *
 * 88dp, on the stop card, deliberately. This is the row a driver hits 44 times
 * a day, one-handed, in the rain, possibly gloved, while holding a parcel —
 * and a miss costs a wrong delivery status rather than a moment's annoyance.
 * The spare height is bought back by everything below it being demoted.
 */
export function ActionRow3Up({
  actions,
  size = 'compact',
  className = '',
}: {
  actions: QuickAction[]
  /** `compact` is the M3 row; `tall` is the stop card's 88dp primary slot. */
  size?: 'compact' | 'tall'
  className?: string
}) {
  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      {actions.slice(0, 3).map((action) => {
        const variant = action.variant ?? 'plain'
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onSelect}
            disabled={action.disabled}
            data-testid={action.testId}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-row px-2 text-label font-semibold disabled:opacity-40 ${
              size === 'tall' ? 'min-h-22 py-4' : 'py-3'
            } ${VARIANTS[variant]} ${action.destructive ? 'text-danger' : ''}`}
          >
            <span
              className={`flex items-center justify-center ${
                size === 'tall' ? 'h-7 w-7' : 'h-6 w-6'
              }`}
            >
              {action.icon}
            </span>
            <span className="truncate">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
