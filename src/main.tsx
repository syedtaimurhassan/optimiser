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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
