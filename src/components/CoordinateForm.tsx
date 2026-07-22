import { useState, type FormEvent } from 'react'
import { useRouteStore } from '../store/routeStore'
import { toLatLng, formatLatLng } from '../lib/coordinates'

interface Props {
  /** Which store field this form drives. */
  field: 'start' | 'end'
  label: string
  /** Tailwind background class for the submit button accent. */
  accentClass?: string
}

/**
 * Manual lat/lng entry for a single named location. Subscribes only to its own
 * field, so the Start form never re-renders when the End changes (and vice versa).
 */
export function CoordinateForm({ field, label, accentClass = 'bg-blue-600' }: Props) {
  const value = useRouteStore((s) =>
    field === 'start' ? s.startLocation : s.endLocation,
  )
  const setValue = useRouteStore((s) => (field === 'start' ? s.setStart : s.setEnd))
  const isPlacing = useRouteStore((s) => s.mapPlacementMode === field)
  const setMapPlacementMode = useRouteStore((s) => s.setMapPlacementMode)

  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const point = toLatLng(lat, lng)
    if (!point) {
      setError('Enter valid coordinates (lat −90..90, lng −180..180).')
      return
    }
    setError(null)
    setValue(point)
  }

  function handleClear() {
    setValue(null)
    setLat('')
    setLng('')
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex min-h-[44px] items-center rounded px-2 text-xs text-slate-400 hover:text-red-500"
          >
            clear
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          inputMode="decimal"
          className="min-h-[44px] w-1/2 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          inputMode="decimal"
          className="min-h-[44px] w-1/2 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className={`flex min-h-[44px] flex-1 items-center justify-center rounded-md ${accentClass} px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90`}
        >
          Set {label}
        </button>
        <button
          type="button"
          onClick={() => setMapPlacementMode(isPlacing ? null : field)}
          aria-pressed={isPlacing}
          title="Pick this point by clicking the map"
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-md border px-3 text-sm font-medium transition-colors ${
            isPlacing
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
        >
          📍 {isPlacing ? 'Click map…' : 'Map'}
        </button>
      </div>

      {value && (
        <p className="text-xs text-slate-500">Set to {formatLatLng(value)}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}
