export interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Accessible name, e.g. "Parcel count". */
  label: string
  className?: string
}

/**
 * A −/+ counter for small integers: parcels at a stop, the stop cap K.
 *
 * Both buttons are full 44dp targets and the value between them is not
 * editable text — a driver adjusting a parcel count with one hand in a van
 * should never be able to summon a keyboard by mistyping into it.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  className = '',
}: StepperProps) {
  const clamp = (n: number) => Math.min(Math.max(n, min), max)

  return (
    <div
      className={`inline-flex items-center rounded-pill border border-outline bg-surface ${className}`}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className="flex h-touch w-touch items-center justify-center rounded-pill text-title text-on-surface disabled:text-outline"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-8 text-center text-row font-semibold tabular-nums text-on-surface">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className="flex h-touch w-touch items-center justify-center rounded-pill text-title text-on-surface disabled:text-outline"
      >
        +
      </button>
    </div>
  )
}
