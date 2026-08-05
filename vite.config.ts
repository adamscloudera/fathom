import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/fathom/',
  server: {
    proxy: {
      '/fathom/octopai-proxy': {
        target: process.env.VITE_OCTOPAI_BASE_URL || 'https://placeholder.octopai.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/fathom\/octopai-proxy/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const p = id.replaceAll('\\', '/')
          if (p.includes('node_modules/react-dom/') || p.includes('node_modules/react/')) return 'vendor'
          if (p.includes('node_modules/lucide-react/')) return 'icons'
        },
      },
    },
  },
})
