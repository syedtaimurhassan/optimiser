import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'danger' | 'demoted'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary active:bg-primary-pressed',
  // Only ever for destruction. See the semantic rule in index.css.
  danger: 'bg-danger text-white',
  demoted: 'bg-surface-variant text-on-surface',
}

export interface FullWidthButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}

/** The filled, full-width action that sits at the bottom of a sheet or modal.
 *  Bottom-anchored on purpose: it is the one control that must be reachable
 *  with a thumb on a large phone. */
export function FullWidthButton({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
}: FullWidthButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full min-h-touch items-center justify-center gap-2 rounded-pill px-5 py-3.5 text-row font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
