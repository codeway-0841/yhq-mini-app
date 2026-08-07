import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Build versiyasi — Profil tagida ko'rinadi (cache tekshiruvi uchun)
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  // '/' SHART: SPA deep-link reload'da (vercel.json rewrite → /index.html)
  // './assets' relative yo'l buzuq URL'ga olib borardi (blank page).
  base: '/',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
