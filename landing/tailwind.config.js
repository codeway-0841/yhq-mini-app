/**
 * LANDING-only Tailwind config (audit LOW: landing CSS 84KB edi).
 *
 * Asosiy tailwind.config.js content'iga butun `src/**` (ilova) kirgani uchun
 * landing bundle'i app'dagi BARCHA utilitalarni olib kelardi. Bu config
 * faqat landing markup'ni skanerlaydi (`@config` direktivasi styles.css'da).
 *
 * QOIDA: landing'da yangi tailwind imkoniyati kerak bo'lsa FAQAT shu faylga
 * qo'shing (app konfigiga tegmang); vizual paritet: `animate-fadeIn` kabi
 * app-side animatsiya utility'lari landing'da ATROFMAPC QO'SHILMAYDI.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './landing/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // styles.css :root'dagi --font-sans/--font-display'ga bog'langan (asosiy config bilan bir xil)
        sans:    ['var(--font-sans)', 'Inter Tight', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Bricolage Grotesque', 'Inter Tight', '-apple-system', 'system-ui', 'sans-serif'],
      },
    },
  },
}
