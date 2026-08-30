import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { APP_URL, BOT_URL, PRIVACY_URL } from './config'
import { copy, t, type Lang } from './copy'

/** KIWI logotipi — app splash'dagi bilan bir xil brend yozuvi. */
function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl' : 'text-xl'
  return (
    <a href="/" className={`font-display font-bold tracking-tight text-[color:var(--l-text)] ${cls}`}>
      KI<span className="grad-text">WI</span>
    </a>
  )
}

export function Nav({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const c = copy.nav

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#demo', label: t(c.features, lang) },
    { href: '#process', label: t(c.process, lang) },
    { href: '#subjects', label: t(c.subjects, lang) },
    { href: '#pricing', label: t(c.pricing, lang) },
    { href: '#faq', label: t(c.faq, lang) },
  ]

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-[rgba(6,9,10,0.72)] border-b border-[var(--l-line)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Brand />

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-[var(--l-muted)] hover:text-[var(--l-text)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          {/* Til almashtirish */}
          <div className="flex items-center rounded-lg border border-[var(--l-line)] overflow-hidden text-xs font-semibold">
            {(['uz', 'ru'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-2.5 py-1.5 uppercase transition-colors ${
                  lang === l
                    ? 'bg-[rgba(46,230,168,0.14)] text-[var(--l-green-bright)]'
                    : 'text-[var(--l-muted)] hover:text-[var(--l-text)]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <a href={`${APP_URL}`} className="btn-l btn-l-ghost !py-2 !px-4 !text-sm">
            {t(c.login, lang)}
          </a>
          <a href={`${APP_URL}`} className="btn-l btn-l-primary !py-2 !px-4 !text-sm">
            {t(c.cta, lang)}
            <ArrowRight size={15} />
          </a>
        </div>

        {/* Mobil menyu tugmasi */}
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden icon-box !w-10 !h-10 text-[var(--l-text)]"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobil menyu paneli */}
      {open && (
        <div className="md:hidden border-t border-[var(--l-line)] bg-[rgba(6,9,10,0.96)] backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-[15px] font-medium text-[var(--l-muted)] hover:text-[var(--l-text)]"
              >
                {l.label}
              </a>
            ))}
            <div className="flex items-center gap-2.5 pt-3">
              <div className="flex items-center rounded-lg border border-[var(--l-line)] overflow-hidden text-xs font-semibold">
                {(['uz', 'ru'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`px-2.5 py-1.5 uppercase ${
                      lang === l ? 'bg-[rgba(46,230,168,0.14)] text-[var(--l-green-bright)]' : 'text-[var(--l-muted)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <a href={APP_URL} className="btn-l btn-l-primary flex-1 !py-2.5 !text-sm">
                {t(copy.nav.cta, lang)}
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export function Footer({ lang }: { lang: Lang }) {
  const f = copy.footer
  return (
    <footer className="border-t border-[var(--l-line)] mt-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2">
          <Brand size="lg" />
          <p className="mt-3 text-sm text-[var(--l-muted)] max-w-xs leading-relaxed">{t(f.tagline, lang)}</p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--l-faint)] mb-4">
            {t(f.app, lang)}
          </div>
          <ul className="space-y-2.5 text-sm">
            <li><a className="text-[var(--l-muted)] hover:text-[var(--l-text)] transition-colors" href={APP_URL}>{t(f.start, lang)}</a></li>
            <li><a className="text-[var(--l-muted)] hover:text-[var(--l-text)] transition-colors" href={APP_URL}>{t(f.login, lang)}</a></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--l-faint)] mb-4">
            {t(f.resources, lang)}
          </div>
          <ul className="space-y-2.5 text-sm">
            <li><a className="text-[var(--l-muted)] hover:text-[var(--l-text)] transition-colors" href={BOT_URL} target="_blank" rel="noopener noreferrer">{t(f.tgBot, lang)}</a></li>
            <li><a className="text-[var(--l-muted)] hover:text-[var(--l-text)] transition-colors" href={PRIVACY_URL}>{t(f.privacy, lang)}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--l-line)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between text-xs text-[var(--l-faint)]">
          <span>© 2026 KIWI. {t(f.rights, lang)}</span>
          <span>kivvi.uz</span>
        </div>
      </div>
    </footer>
  )
}
