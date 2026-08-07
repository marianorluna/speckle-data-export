import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Share monorepo `.env` (SPECKLE_* + future VITE_*).
  envDir: repoRoot,
  resolve: {
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['@speckle/viewer', 'three'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8000',
        ws: true,
      },
    },
  },
})
