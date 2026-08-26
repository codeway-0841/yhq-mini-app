import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      // Dev Telegram mock'ni PROD build'dan o'chirish (audit Q7):
      // dev server (apply:'serve') index.html'ni o'zgarishsiz uzatadi;
      // build esa DEV-MOCK marker'lar orasidagi ~4KB console.log'li
      // o'lik kodni kesib tashlaydi.
      name: 'strip-dev-telegram-mock',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace(/<!-- DEV-MOCK-START[\s\S]*?<!-- DEV-MOCK-END -->\s*/, '')
      },
    },
  ],
  // Build versiyasi — Profil tagida ko'rinadi (cache tekshiruvi uchun)
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || process.env.npm_package_version || '2.0.0'),
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
