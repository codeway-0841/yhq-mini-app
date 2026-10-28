/**
 * Ixtiyoriy shriftlarni TALAB BO'YICHA yuklash (boot perf).
 *
 * Standart Onest lokal yuklanadi. Muqobil oilalar faqat foydalanuvchi
 * Sozlamalarda tanlaganda bir marta Google Fonts orqali ulanadi.
 */

const FONT_HREF: Record<string, string> = {
  jakarta: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  rounded: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
  grotesk: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&display=swap',
  serif:   'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  mono:    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
}

const loaded = new Set<string>()

/** Tanlangan shrift uslubi uchun kerakli Google Fonts CSS'ini bir marta ulaydi. */
export function ensureFontLoaded(style: string | undefined): void {
  const key = style || 'default'
  const href = FONT_HREF[key]
  if (!href || loaded.has(key)) return
  loaded.add(key)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
