import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // ORS_API_KEY has no VITE_ prefix, so it is never bundled into the browser code.
  // The dev server attaches it to requests proxied through /ors.
  const key = loadEnv(mode, process.cwd(), '').ORS_API_KEY
  if (!key) {
    console.warn('\n  ORS_API_KEY is not set. Add your OpenRouteService key to .env\n')
  }

  const proxy = {
    '/ors': {
      target: 'https://api.openrouteservice.org',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/ors/, ''),
      headers: key ? { Authorization: key } : {},
    },
  }

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
