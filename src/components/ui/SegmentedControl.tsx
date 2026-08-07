export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group, e.g. "Optimise by". */
  label: string
  className?: string
}

/**
 * A two-or-three-way exclusive choice — Time vs Distance, and the search tier.
 *
 * Built on radios rather than buttons: arrow keys move between options for
 * free, the group announces itself as one control with one value, and the
 * browser's own roving-tabindex behaviour means a keyboard user tabs past it
 * in one step instead of three.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex rounded-pill bg-surface-variant p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <label
            key={option.value}
            className={`flex min-h-touch flex-1 cursor-pointer items-center justify-center rounded-pill px-3 text-label font-semibold transition-colors ${
              selected ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={selected}
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
