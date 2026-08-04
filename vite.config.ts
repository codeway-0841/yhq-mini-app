import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // '/' SHART: SPA deep-link reload'da (vercel.json rewrite → /index.html)
  // './assets' relative yo'l buzuq URL'ga olib borardi (blank page).
  base: '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
