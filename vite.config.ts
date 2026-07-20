import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // IMPORTANT: `base` must match your GitHub repository name for Pages to
  // resolve assets correctly, i.e. https://<user>.github.io/<repo>/
  // Repo is https://github.com/syedtaimurhassan/optimiser -> base '/optimiser/'.
  base: '/optimiser/',
  plugins: [react(), tailwindcss()],
})
