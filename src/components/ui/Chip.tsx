import type { ReactNode } from 'react'

export type ChipTone = 'neutral' | 'primary' | 'success' | 'danger' | 'outlined'

/**
 * Tone → classes as a static record.
 *
 * Tailwind scans source text for complete class names, so a template literal
 * like `bg-${tone}-container` produces nothing at all. Every variant map in
 * this folder is spelled out for that reason.
 */
const TONES: Record<ChipTone, string> = {
  neutral: 'bg-surface-variant text-on-surface-variant',
  primary: 'bg-primary-container text-on-primary-container',
  success: 'bg-success-container text-on-success-container',
  danger: 'bg-danger-container text-on-danger-container',
  /** A bordered action chip, as used by the route list's two header actions. */
  outlined: 'border border-outline bg-surface text-on-surface',
}

export interface ChipProps {
  children: ReactNode
  tone?: ChipTone
  /** Renders a selected outline. Only meaningful with `onClick`. */
  selected?: boolean
  onClick?: () => void
  /** A chip that is present but not yet wired — an announced, unavailable action. */
  disabled?: boolean
  className?: string
}

/** A small pill of secondary information, or a compact filter control. */
export function Chip({
  children,
  tone = 'neutral',
  selected = false,
  onClick,
  disabled = false,
  className = '',
}: ChipProps) {
  const base = `inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-label font-medium ${TONES[tone]} ${
    selected ? 'ring-2 ring-primary' : ''
  } ${className}`

  if (!onClick && !disabled) return <span className={base}>{children}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={onClick ? selected : undefined}
      className={`${base} min-h-touch disabled:opacity-40`}
    >
      {children}
    </button>
  )
}
