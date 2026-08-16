import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  build: {
    rollupOptions: {
      input: {
        // The app shell, unchanged.
        main: here('index.html'),
        // Marketing page, served at /landing.html by the FastAPI static fallback.
        landing: here('landing.html'),
      },
    },
  },
})
