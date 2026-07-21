import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { parseWaypointFile } from '../lib/parseFile'
import { useRouteStore } from '../store/routeStore'

/** Drag-and-drop / click-to-browse uploader that parses CSV or JSON waypoints. */
export function FileUploader() {
  // Only the (stable) action is read, so this never re-renders on state change.
  const addWaypoints = useRouteStore((s) => s.addWaypoints)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setStatus(null)
    setErrors([])

    const result = await parseWaypointFile(file)

    setBusy(false)
    if (result.waypoints.length > 0) {
      addWaypoints(result.waypoints)
      const n = result.waypoints.length
      setStatus(`Added ${n} waypoint${n === 1 ? '' : 's'} from ${file.name}.`)
    } else {
      setStatus(`No valid waypoints found in ${file.name}.`)
    }
    setErrors(result.errors)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = '' // allow re-uploading the same file
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-md border-2 border-dashed px-3 py-6 text-center text-sm transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 text-blue-600'
            : 'border-slate-300 text-slate-500 hover:border-slate-400'
        }`}
      >
        {busy ? 'Parsing…' : 'Click to browse or drop a .csv / .json file'}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,application/json,text/csv"
        onChange={onInputChange}
        className="hidden"
      />

      {status && <p className="text-xs text-slate-600">{status}</p>}

      {errors.length > 0 && (
        <details className="text-xs text-amber-600">
          <summary className="cursor-pointer">
            {errors.length} issue{errors.length === 1 ? '' : 's'} skipped
          </summary>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {errors.slice(0, 10).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {errors.length > 10 && <li>…and {errors.length - 10} more</li>}
          </ul>
        </details>
      )}
    </div>
  )
}
