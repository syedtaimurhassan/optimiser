import type { ReactNode, KeyboardEvent } from 'react'

export interface ListRowProps {
  /** Leading slot: an IdChip, a status badge, a calendar icon, a radio. */
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** The third line — the subtle summary. Only route rows use it today. */
  meta?: ReactNode
  /** Trailing slot: a chevron, an overflow button, a checkbox. */
  trailing?: ReactNode
  /** `row` is the two-line 72dp row; `row-lg` the three-line 96dp one. */
  size?: 'row' | 'row-lg'
  onClick?: () => void
  /**
   * `radio` makes the row one option in an exclusive set — the date choices on
   * Create route. The parent must then be a `role="radiogroup"`, and `checked`
   * says whether this is the chosen one. Announced as "radio, selected"
   * instead of the meaningless "button".
   */
  role?: 'button' | 'radio'
  checked?: boolean
  /** Renders the light-blue active treatment. */
  selected?: boolean
  /** Outlined box treatment, as used by the date options on Create route. */
  outlined?: boolean
  className?: string
}

/**
 * The list row.
 *
 * ── Why a div with role="button" and not a <button> ───────────────────────
 *
 * The whole row is the tap target, AND the row carries its own trailing
 * control (the 3-dot overflow). A <button> inside a <button> is invalid HTML
 * and browsers resolve it by dropping the inner one, so the overflow would
 * stop being independently reachable. A div with the button role plus the two
 * keyboard handlers is the accessible way to have both: the row activates on
 * Enter and Space, and the trailing control stays a real, separately
 * focusable button.
 *
 * The trailing slot stops click and key events from reaching the row, so a
 * caller cannot forget to and accidentally open the route while trying to open
 * its overflow menu.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  size = 'row',
  onClick,
  role = 'button',
  checked,
  selected = false,
  outlined = false,
  className = '',
}: ListRowProps) {
  const interactive = Boolean(onClick)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return
    // Space scrolls the page by default; a row that jumps the list when
    // activated is worse than one that can't be activated at all.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role={interactive ? role : undefined}
      aria-checked={interactive && role === 'radio' ? Boolean(checked) : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={[
        'flex w-full items-center gap-3 px-4 text-left',
        size === 'row' ? 'min-h-row' : 'min-h-row-lg',
        outlined ? 'rounded-row border border-outline' : '',
        selected ? 'bg-primary-container' : outlined ? 'bg-surface' : 'bg-transparent',
        interactive ? 'cursor-pointer select-none active:bg-surface-variant' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {leading != null && <div className="flex shrink-0 items-center">{leading}</div>}

      <div className="min-w-0 flex-1 py-2">
        <div className="truncate text-row font-semibold text-on-surface">{title}</div>
        {subtitle != null && (
          <div className="truncate text-body text-on-surface-variant">{subtitle}</div>
        )}
        {meta != null && <div className="mt-0.5 truncate text-meta text-on-surface-variant">{meta}</div>}
      </div>

      {trailing != null && (
        <div
          className="flex shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {trailing}
        </div>
      )}
    </div>
  )
}
