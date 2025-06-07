import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,  // Force a different port
    strictPort: true,  // Don't try other ports if this one is taken
    proxy: {
      '/api/nansen': {
        target: 'https://api.nansen.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/nansen/, ''),
        headers: {
          'Origin': 'https://api.nansen.ai'
        }
      }
    }
  }
}) 