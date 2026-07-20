import type { LatLng, OptimizedRoute } from '../types'

// Bump the version suffix if the shape below ever changes incompatibly, so old
// saved sessions are ignored instead of crashing the app.
const STORAGE_KEY = 'route-optimiser:v1'

/** The slice of app state we persist to the device so a refresh/close doesn't lose work. */
export interface PersistedState {
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LatLng[]
  targetK: number | null
  optimizedRoute: OptimizedRoute | null
}

/** Load a saved session from this device, or an empty object if none / unavailable. */
export function loadState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // localStorage can be disabled (private mode) or hold corrupt JSON.
    return {}
  }
}

/** Save the current session to this device. Silently no-ops if storage is unavailable. */
export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore private-mode / quota-exceeded errors — persistence is best-effort.
  }
}

/** Remove the saved session from this device. */
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
