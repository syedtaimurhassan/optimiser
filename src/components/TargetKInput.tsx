interface Props {
  /** Current K value, or null when empty. */
  value: number | null
  /** Maximum selectable K = number of uploaded waypoints. */
  max: number
  onChange: (k: number | null) => void
}

/**
 * Lets the user pick K — how many of the uploaded waypoints to actually visit.
 * The selection is only stored here in Milestone 6; the Selective-TSP solver
 * that consumes it arrives in Milestone 7.
 */
export function TargetKInput({ value, max, onChange }: Props) {
  const tooMany = value !== null && max > 0 && value > max

  function handleChange(raw: string) {
    if (raw === '') {
      onChange(null)
      return
    }
    const n = parseInt(raw, 10)
    onChange(Number.isFinite(n) ? n : null)
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor="target-k"
        className="text-sm font-semibold text-slate-700"
      >
        Stops to visit (K)
      </label>
      <input
        id="target-k"
        type="number"
        min={1}
        max={max || undefined}
        value={value ?? ''}
        disabled={max === 0}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={max === 0 ? 'Upload waypoints first' : `1 – ${max}`}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      <p className={`text-xs ${tooMany ? 'text-red-500' : 'text-slate-400'}`}>
        {max === 0
          ? 'Add waypoints, then choose how many to visit.'
          : tooMany
            ? `Only ${max} waypoints available.`
            : `Choose the best K of ${max} uploaded stops (used when calculating).`}
      </p>
    </div>
  )
}
