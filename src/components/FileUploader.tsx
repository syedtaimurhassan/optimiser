import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { parseWaypointFile } from '../lib/parseFile'
import { useRouteStore } from '../store/routeStore'

/** Accept only CSV/JSON (by extension or MIME). */
const isValidFile = (file: File) => {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    file.type.includes('csv') ||
    file.type.includes('json')
  )
}

/** Drag-and-drop / click-to-browse uploader that parses CSV or JSON waypoints. */
export function FileUploader() {
  // Only the (stable) action is read, so this never re-renders on state change.
  const addWaypoints = useRouteStore((s) => s.addWaypoints)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [rejected, setRejected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    setRejected(null)
    if (!isValidFile(file)) {
      // Keep any prior "Imported N stops" status so the user can see their
      // existing import is untouched — we only surface the rejection.
      setRejected(
        `Invalid file format: "${file.name}". Please upload a .csv or .json file with lat/lng columns.`,
      )
      return
    }

    setBusy(true)
    setStatus(null)
    setErrors([])

    const result = await parseWaypointFile(file)

    setBusy(false)
    if (result.waypoints.length > 0) {
      addWaypoints(result.waypoints)
      const n = result.waypoints.length
      setStatus(`Imported ${n} stop${n === 1 ? '' : 's'} from ${file.name}.`)
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
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border-2 border-dashed px-3 py-6 text-center text-sm transition-colors ${
          rejected
            ? 'border-red-500 bg-red-50 text-red-600'
            : dragOver
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-slate-300 text-slate-500 hover:border-slate-400'
        }`}
      >
        {busy
          ? 'Parsing…'
          : dragOver
            ? 'Drop file to upload'
            : 'Click to browse or drop a .csv / .json file'}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,application/json,text/csv"
        onChange={onInputChange}
        className="hidden"
      />

      {rejected && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-600"
        >
          <span aria-hidden="true">⚠️</span>
          <span className="flex-1">{rejected}</span>
          <button
            type="button"
            onClick={() => setRejected(null)}
            aria-label="Dismiss"
            className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-red-400 hover:bg-red-100 hover:text-red-600"
          >
            ✕
          </button>
        </p>
      )}

      {status && <p className="text-xs text-slate-600">{status}</p>}

      {errors.length > 0 && (
        <details className="text-xs text-amber-600">
          <summary className="flex min-h-[44px] cursor-pointer items-center">
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
