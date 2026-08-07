import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  captureError,
  recordError,
  formatErrorReport,
  type CapturedError,
} from '../lib/diagnostics/errorLog'

interface Props {
  children: ReactNode
  /** Identifies which subtree failed, and appears in diagnostics. */
  name: string
  /** Human label used in the fallback copy, e.g. "map". */
  label?: string
  /** Render a bespoke fallback instead of the default panel. */
  fallback?: (error: CapturedError, reset: () => void) => ReactNode
  onError?: (error: CapturedError) => void
}

interface State {
  error: CapturedError | null
}

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable UI.
 *
 * Two boundaries wrap this app: one at the root, and one around the map. The map
 * gets its own because MapLibre fails in ways React can't anticipate — a bad
 * geometry or a container sized 0×0 throws from inside an imperative callback,
 * a device with no usable WebGL throws at construction, and without a local
 * boundary any of those take down the entire app including the sidebar the
 * user needs in order to fix the input that caused it.
 *
 * Note the standing limitation: React error boundaries do NOT catch errors in
 * event handlers, async callbacks, or effects that have already returned. Those
 * surface through window.onerror instead — wired up in main.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  /**
   * This MUST return a non-null error.
   *
   * React calls it during the render phase and immediately re-renders with the
   * result. Returning `{ error: null }` and deferring to componentDidCatch (a
   * commit-phase hook) means React re-renders the same children, they throw
   * again, and React treats a throw-while-handling-a-throw as unrecoverable —
   * unmounting the entire tree to a blank page. Exactly the failure this
   * component exists to prevent.
   *
   * The component stack isn't available here, so componentDidCatch enriches the
   * record afterwards.
   */
  static getDerivedStateFromError(error: unknown): State {
    return { error: captureError('unknown', error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const captured = captureError(this.props.name, error, info?.componentStack ?? undefined)
    recordError(captured)

    console.error(`[error-boundary:${this.props.name}]`, error, info)
    this.props.onError?.(captured)
    this.setState({ error: captured })
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return <ErrorPanel error={error} label={this.props.label} onReset={this.reset} />
  }
}

/** Copies a diagnostics blob to the clipboard, with a non-async fallback. */
async function copyDiagnostics(error: CapturedError): Promise<boolean> {
  const text = formatErrorReport(error)

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API needs a secure context and a user gesture; fall back to a
    // selectable textarea so the user can still get the text out.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function ErrorPanel({
  error,
  label,
  onReset,
}: {
  error: CapturedError
  label?: string
  onReset: () => void
}) {
  const what = label ? `The ${label} ran into a problem` : 'Something went wrong'

  return (
    <div
      role="alert"
      className="flex h-full min-h-[12rem] w-full items-center justify-center bg-slate-50 p-6"
    >
      <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800">{what}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Your stops and route are saved — nothing has been lost.
            </p>
          </div>
        </div>

        <p className="break-words rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600">
          {error.message}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => location.reload()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Reload
          </button>
          <CopyButton error={error} />
        </div>
      </div>
    </div>
  )
}

function CopyButton({ error }: { error: CapturedError }) {
  return (
    <button
      type="button"
      onClick={async (e) => {
        const btn = e.currentTarget
        const ok = await copyDiagnostics(error)
        btn.textContent = ok ? 'Copied' : 'Copy failed'
        setTimeout(() => {
          btn.textContent = 'Copy diagnostics'
        }, 1600)
      }}
      className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      Copy diagnostics
    </button>
  )
}
