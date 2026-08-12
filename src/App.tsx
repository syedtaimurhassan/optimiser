import { useEffect } from 'react'
import { AppRoutes } from './routes'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DataLossBanner } from './components/pwa/DataLossBanner'
import { UpdateToast } from './components/pwa/UpdateToast'
import { useRouteStore } from './store/routeStore'
import { useDeviceStore } from './store/deviceStore'
import { useHydrated } from './hooks/useHydrated'

/**
 * App shell: boundaries, boot, and the router.
 *
 * The layout itself now lives in screens/RouteWorkScreen — this component owns
 * only the cross-cutting concerns.
 */
function App() {
  const warmUp = useRouteStore((s) => s.warmUp)
  const probe = useDeviceStore((s) => s.probe)
  const hydrated = useHydrated()

  // Capability probe also requests persistent storage, so run it early — but
  // after first paint, since it awaits a permissions decision on some browsers.
  useEffect(() => {
    void probe()
  }, [probe])

  useEffect(() => {
    const id = setTimeout(() => warmUp(), 3000)
    return () => clearTimeout(id)
  }, [warmUp])

  // IndexedDB reads are async. Rendering before rehydration would flash an empty
  // app at someone who has a full route loaded, then snap it back — so hold the
  // first paint until the state is actually there.
  if (!hydrated) return <BootSplash />

  return (
    <ErrorBoundary name="root">
      {/*
        Both are app-wide rather than per-screen, and for the same reason: the
        news they carry is not about the screen the driver happens to be on. An
        update that landed while a stop was open is still an update, and data
        cleared by the browser is still gone whichever route was being viewed.

        Both sit INSIDE the boundary so a fault in either is caught rather than
        taking the app down — and outside AppRoutes so neither remounts on
        navigation, which would restart the data-loss probe on every tap.
      */}
      <DataLossBanner />
      <AppRoutes />
      <UpdateToast />
    </ErrorBoundary>
  )
}

function BootSplash() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-slate-100" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
        Loading your route…
      </div>
    </div>
  )
}

export default App
