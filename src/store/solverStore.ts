import { create } from 'zustand'

/**
 * Solver progress and lifecycle. Transient by design — a half-finished
 * optimisation must never survive a reload, or the app would come back claiming
 * to be calculating something that is no longer running.
 */

/**
 * Which engine is running, for display.
 *
 * A string rather than the old `'ortools' | 'typescript'` union: engines are
 * registered at runtime now, so the set of possible values is not knowable
 * here, and a union that lies is worse than a string that does not.
 */
export interface SolverEngineInfo {
  id: string
  /** "Fast", or "Basic (device supports Fast)". */
  label: string
}

interface SolverState {
  isCalculating: boolean
  /** Human-readable stage, e.g. "Fetching cost matrix… 1/2". */
  status: string | null
  /** 0..1 when known, null when the stage has no meaningful progress. */
  progress: number | null
  error: string | null
  engine: SolverEngineInfo
  ready: boolean
  warning: string | null
  /** Set while a run is in flight so the UI can offer Cancel. */
  cancelRequested: boolean

  begin: () => void
  setStatus: (status: string | null, progress?: number | null) => void
  succeed: () => void
  fail: (error: string) => void
  /**
   * The run stopped because it was asked to.
   *
   * Distinct from `fail` because cancelling is not an error: there is nothing
   * to show the driver, and — the part that matters — the route they were
   * already looking at must survive. Routing a cancel through `fail` showed a
   * red message for something they did on purpose.
   */
  cancelled: () => void
  /**
   * Ask the running solve to stop.
   *
   * Sets the flag AND aborts the controller the run registered. Before M9 this
   * only set a flag that nothing read, so Cancel greyed the button out and the
   * solve carried on to completion behind it.
   */
  requestCancel: () => void
  /** Hand the store the controller for the run in flight. */
  setAbortController: (controller: AbortController | null) => void
  setEngine: (engine: SolverEngineInfo) => void
  setReady: (ready: boolean) => void
  setWarning: (warning: string | null) => void
}

/**
 * The controller for the run in flight.
 *
 * Kept outside the store deliberately. An `AbortController` is a live handle,
 * not state: putting it in the store would make every component that reads a
 * solver field re-render when a run starts, and it is not something any of them
 * can render.
 */
let inFlight: AbortController | null = null

export const useSolverStore = create<SolverState>()((set) => ({
  isCalculating: false,
  status: null,
  progress: null,
  error: null,
  engine: { id: 'ts', label: 'Basic' },
  ready: false,
  warning: null,
  cancelRequested: false,

  begin: () => set({ isCalculating: true, error: null, status: null, progress: null, cancelRequested: false }),
  setStatus: (status, progress = null) => set({ status, progress }),
  succeed: () => {
    inFlight = null
    set({ isCalculating: false, status: null, progress: null, ready: true, cancelRequested: false })
  },
  fail: (error) => {
    inFlight = null
    set({ isCalculating: false, status: null, progress: null, error, cancelRequested: false })
  },
  cancelled: () => {
    inFlight = null
    set({ isCalculating: false, status: null, progress: null, cancelRequested: false })
  },
  requestCancel: () => {
    inFlight?.abort()
    set({ cancelRequested: true })
  },
  setAbortController: (controller) => {
    inFlight = controller
  },
  setEngine: (engine) => set({ engine }),
  setReady: (ready) => set({ ready }),
  setWarning: (warning) => set({ warning }),
}))
