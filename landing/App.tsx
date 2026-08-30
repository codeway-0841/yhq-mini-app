import { useState } from 'react'
import { Nav, Footer } from './chrome'
import { Hero } from './hero'
import { Showcase } from './showcase'
import { Bento } from './bento'
import { Stats, Process, Subjects, Pricing, Faq, Cta } from './sections'
import type { Lang } from './copy'

/**
 * KIWI Landing — standalone entry (kivvi.uz).
 * Ilovaning o'zi app.kivvi.uz'da yashaydi; bu sahifa faqat marketing.
 * Termius uslubi: scroll'da asosiy jarayonlar JONLI demo ko'rsatadi.
 */
export default function App() {
  const [lang, setLang] = useState<Lang>('uz')

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--l-bg)]">
      {/* Global noise teksturasi */}
      <div className="noise-layer fixed inset-0 pointer-events-none z-[60]" aria-hidden />

      <Nav lang={lang} setLang={setLang} />
      <main>
        <Hero lang={lang} />
        <Stats lang={lang} />
        <Showcase lang={lang} />
        <Bento lang={lang} />
        <Process lang={lang} />
        <Subjects lang={lang} />
        <Pricing lang={lang} />
        <Faq lang={lang} />
        <Cta lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  )
}
