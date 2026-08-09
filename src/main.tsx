import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSyncWatchers } from './store/syncStore.ts'

// Benchmark seam, bench builds only. VITE_BENCH_SEAM is statically replaced at
// build time, so a production build leaves a dead branch that is tree-shaken
// away — verified by `npm run bench:verify-seam`.
if (import.meta.env.VITE_BENCH_SEAM) {
  void import('./benchSeam')
}

/**
 * React error boundaries do NOT catch errors thrown from event handlers, async
 * callbacks, or timers — only from render and lifecycle. Those would otherwise
 * vanish into the console. Capture them here so the diagnostics panel can show
 * them and a logging sink can consume them later.
 */
window.addEventListener('error', (e) => {
  console.error('[window.onerror]', e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason)
})

/**
 * Reachability and save outcomes, attached before first paint.
 *
 * Not inside a component: both signals are module-level and long-lived, and a
 * subscription owned by a screen would forget the app is offline the moment
 * that screen unmounted.
 */
startSyncWatchers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
