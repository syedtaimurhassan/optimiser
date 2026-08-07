import { useEffect, useState } from 'react'
import { useDeviceStore } from '../store/deviceStore'
import { formatReport, selfTest } from '../lib/device/capabilities'
import { describeDb, SCHEMA_VERSION } from '../lib/persistence/db'
import { getMigrationOutcome } from '../lib/persistence/boot'
import { getRecentErrors } from '../lib/diagnostics/errorLog'

/**
 * Dev-only capability dump.
 *
 * Built to be *screenshotted on a real phone*, which drives the design: one
 * monospace column, no truncation, no horizontal scrolling, no interaction
 * needed to reveal anything. Reachable at #/settings in a dev build.
 */
export function DiagnosticsPanel() {
  const capabilities = useDeviceStore((s) => s.capabilities)
  const tier = useDeviceStore((s) => s.tier)
  const ready = useDeviceStore((s) => s.ready)
  const probe = useDeviceStore((s) => s.probe)

  const [dbCounts, setDbCounts] = useState<Record<string, number> | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void probe()
  }, [probe])

  useEffect(() => {
    describeDb()
      .then(setDbCounts)
      .catch((e) => setDbError(e instanceof Error ? e.message : String(e)))
  }, [])

  const migration = getMigrationOutcome()
  const errors = getRecentErrors()
  const test = selfTest()

  const fullReport = [
    `=== Route Optimiser diagnostics ===`,
    `generated  ${new Date().toISOString()}`,
    `tier       ${tier}${ready ? '' : ' (probing…)'}`,
    ``,
    formatReport(capabilities),
    ``,
    `--- storage ---`,
    `schemaVersion (code)  ${SCHEMA_VERSION}`,
    dbError ? `db error: ${dbError}` : ``,
    ...(dbCounts ? Object.entries(dbCounts).map(([k, v]) => `${k.padEnd(22)} ${v} row(s)`) : ['(counting…)']),
    ``,
    `--- migration ---`,
    migration ? JSON.stringify(migration, null, 2) : '(not run yet)',
    ``,
    `--- recent errors (${errors.length}) ---`,
    ...(errors.length
      ? errors.map((e) => `[${e.boundary}] ${e.at}\n  ${e.message}`)
      : ['(none)']),
  ]
    .filter((l) => l !== '')
    .join('\n')

  return (
    <div className="w-full space-y-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">
          Diagnostics · tier: <span className="font-mono">{tier}</span>
          {!ready && <span className="ml-1 font-normal text-slate-400">probing…</span>}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(fullReport)
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            } catch {
              setCopied(false)
            }
          }}
          className="inline-flex min-h-[36px] items-center rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {!test.ok && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          Capability self-test failed — the wasm detection byte arrays may be corrupt.
        </p>
      )}

      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700">
        {fullReport}
      </pre>
    </div>
  )
}
