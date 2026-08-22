import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

// Mirrors the production routing FastAPI does over dist/: the chat app is
// the site's front door at both / and /app. There is no separate marketing
// landing page - landing.html still exists in the tree but is unrouted.
function devRootRoutes() {
  return {
    name: 'homeagent-dev-root-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/app' || req.url === '/app/') {
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
