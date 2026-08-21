import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

// Mirrors the production routing FastAPI does over dist/: landing page at
// the site root, chat app shell at /app. Without this, `vite dev` serves
// index.html at / (Vite's default for a bare request), which would make the
// app the first thing a local dev sees instead of the landing page.
function devRootRoutes() {
  return {
    name: 'homeagent-dev-root-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/') {
          req.url = '/landing.html'
        } else if (req.url === '/app' || req.url === '/app/') {
          req.url = '/index.html'
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    devRootRoutes(),
  ],
  build: {
    rollupOptions: {
      input: {
        // The chat app shell, served at /app by the FastAPI static fallback.
        main: here('index.html'),
        // Marketing page, served at / (the site root) by the FastAPI static fallback.
        landing: here('landing.html'),
      },
    },
  },
})
