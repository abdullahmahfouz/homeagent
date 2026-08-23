import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

// Mirrors the production routing FastAPI does over dist/: the chat app is
// the site's front door at both / and /app, and the standalone Contact page
// is served at /contact.
function devRootRoutes() {
  return {
    name: 'homeagent-dev-root-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/app' || req.url === '/app/') {
          req.url = '/index.html'
        } else if (req.url === '/contact' || req.url === '/contact/') {
          req.url = '/landing.html'
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
        // Contact page, served at /contact by the FastAPI static fallback.
        landing: here('landing.html'),
      },
    },
  },
})
