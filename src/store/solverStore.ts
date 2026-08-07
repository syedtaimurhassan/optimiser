import { create } from 'zustand'

/**
 * Solver progress and lifecycle. Transient by design — a half-finished
 * optimisation must never survive a reload, or the app would come back claiming
 * to be calculating something that is no longer running.
 */

export type SolverEngine = 'ortools' | 'typescript'

interface SolverState {
  isCalculating: boolean
  /** Human-readable stage, e.g. "Fetching cost matrix… 1/2". */
  status: string | null
  /** 0..1 when known, null when the stage has no meaningful progress. */
  progress: number | null
  error: string | null
  engine: SolverEngine
  ready: boolean
  warning: string | null
  /** Set while a run is in flight so the UI can offer Cancel. */
  cancelRequested: boolean

  begin: () => void
  setStatus: (status: string | null, progress?: number | null) => void
  succeed: () => void
  fail: (error: string) => void
  requestCancel: () => void
  setEngine: (engine: SolverEngine) => void
  setReady: (ready: boolean) => void
  setWarning: (warning: string | null) => void
}

export const useSolverStore = create<SolverState>()((set) => ({
  isCalculating: false,
  status: null,
  progress: null,
  error: null,
  engine: 'ortools',
  ready: false,
  warning: null,
  cancelRequested: false,

  begin: () => set({ isCalculating: true, error: null, status: null, progress: null, cancelRequested: false }),
  setStatus: (status, progress = null) => set({ status, progress }),
  succeed: () => set({ isCalculating: false, status: null, progress: null, ready: true, cancelRequested: false }),
  fail: (error) => set({ isCalculating: false, status: null, progress: null, error, cancelRequested: false }),
  requestCancel: () => set({ cancelRequested: true }),
  setEngine: (engine) => set({ engine }),
  setReady: (ready) => set({ ready }),
  setWarning: (warning) => set({ warning }),
}))
