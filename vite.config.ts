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
  build: {
    // Og'ir bo'laklar lazy: HEIC konverter faqat avatar yuklashda,
    // belgilar katalogi esa faqat belgilar/flashcard sahifalarida kerak.
    // Vite default 500 kB threshold bu loyiha uchun shovqin beradi;
    // 1.5 MB esa kutilmagan app-shell semirishini baribir ko'rsatadi.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      input: {
        // E'tibor: DIRECTORY INDEX = LANDING (kivvi.uz `/` filesystem'dan
        // index.html oladi — Vercel rewrites'dan OLDIN). Ilova app.html'da:
        // app.kivvi.uz `/` 307 redirect → /app.html, deep-link'lar rewrite.
        landing: path.resolve(import.meta.dirname, 'index.html'),
        app: path.resolve(import.meta.dirname, 'app.html'),
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'content-signs', test: /src[\\/]content[\\/]signs\.ts$/ },
            { name: 'vendor-heic', test: /node_modules[\\/]heic2any[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  // `vite preview` (prod build'ni lokal sinash) ham backend'ga proxy qilsin —
  // aks holda service worker / offline xatti-harakatini faqat 404 javoblar
  // bilan tekshirish mumkin bo'lardi.
  preview: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
