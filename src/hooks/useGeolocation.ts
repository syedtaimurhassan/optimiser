import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '../types'

/**
 * The device's position, on request.
 *
 * ── Never on mount ────────────────────────────────────────────────────────
 *
 * Watching starts only when `request()` is called — i.e. when the user taps
 * the my-location button. Asking for location the moment a map appears throws
 * a permission prompt at someone who has not asked for anything, and on iOS a
 * dismissed prompt is expensive to recover from. The tap is the consent.
 *
 * The watch keeps running afterwards so the dot tracks the van; `stop()`
 * exists for a caller that wants to end it, and unmount always does.
 */

export interface GeolocationState {
  position: LatLng | null
  /** Degrees clockwise from north, or null when the device cannot say. */
  heading: number | null
  /** True between the request and the first fix. */
  pending: boolean
  error: string | null
}

const OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  // A stale fix is worse than a slow one when it is drawing "you are here".
  maximumAge: 5_000,
  timeout: 15_000,
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    heading: null,
    pending: false,
    error: null,
  })
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'This device has no location services.' }))
      return
    }
    // Already watching — the caller wants to recentre, not restart.
    if (watchId.current !== null) return

    setState((s) => ({ ...s, pending: true, error: null }))
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          // `heading` is null when stationary and absent on most desktops.
          // NaN shows up in the wild too, which would rotate the cone to
          // nowhere — treat all three the same.
          heading: Number.isFinite(pos.coords.heading) ? (pos.coords.heading as number) : null,
          pending: false,
          error: null,
        })
      },
      (err) => {
        stop()
        setState({
          position: null,
          heading: null,
          pending: false,
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was denied.'
              : 'Could not get your location.',
        })
      },
      OPTIONS,
    )
  }, [stop])

  useEffect(() => stop, [stop])

  return { ...state, request, stop, watching: watchId.current !== null }
}
