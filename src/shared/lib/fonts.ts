/**
 * Ixtiyoriy shriftlarni TALAB BO'YICHA yuklash (boot perf).
 *
 * index.html faqat DEFAULT juftlikni (Inter Tight + Bricolage Grotesque)
 * yuklaydi. Qolgan 4 oila Google Fonts CSS'ining ~70% og'irligini tashkil
 * qilardi va HAR BIR userga, hattoki ular shu shriftni tanlamagan bo'lsa
 * ham, boot'da yuklanardi. Endi `body[data-font]` o'zgarganda bir marta
 * <link> qo'shiladi.
 */

const FONT_HREF: Record<string, string> = {
  jakarta: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  rounded: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
  serif:   'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  mono:    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  // 'default' va 'grotesk' index.html'dagi asosiy link bilan qoplangan
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
