import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
