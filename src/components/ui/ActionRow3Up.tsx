import type { ReactNode } from 'react'

export interface QuickAction {
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  /** Destructive actions render in red. At most one per row, by convention. */
  destructive?: boolean
}

/**
 * Three equal-width actions across a row, icon above label.
 *
 * Fixed at three because that is what fits on a 360dp screen at a 44dp touch
 * target with labels that are still readable; a fourth would either shrink the
 * targets or truncate the words. Fewer than three is allowed and the row stays
 * evenly divided.
 */
export function ActionRow3Up({ actions, className = '' }: { actions: QuickAction[]; className?: string }) {
  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      {actions.slice(0, 3).map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onSelect}
          disabled={action.disabled}
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-row bg-surface-variant px-2 py-3 text-label font-semibold disabled:opacity-40 ${
            action.destructive ? 'text-danger' : 'text-on-surface'
          }`}
        >
          <span className="flex h-6 w-6 items-center justify-center">{action.icon}</span>
          <span className="truncate">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
