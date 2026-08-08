/**
 * KIWI Premium TEMALAR (atmosfera) — YAGONA MANBA.
 *
 * Premium tema shunchaki aksent rang almashtirish EMAS — u butun atmosferani
 * o'zgartiradi: fon, karta, border, aksent, progress, glow, chart'lar.
 * (free foydalanuvchi buni ko'rib "boshqa ilova"dek his qilishi kerak).
 *
 * Majburiyatlar:
 * - DEFAULT_ACCENT har doim `premium: false` (bepul default).
 * - Har bir id uchun `src/index.css` da `body[data-accent='<id>']` bloki bo'lishi
 *   shart — u yerda --p-* VA --theme-* tokenlar birga override qilinadi
 *   (consistency test tekshiradi).
 * - `color` — CSS dagi --p-primary bilan bir xil bo'lishi kerak (swatch/preview).
 * - `premium: true` temalarni faqat obunachilar tanlaydi
 *   (App.tsx dagi resolveAccent free user'ni default'ga qaytaradi).
 *
 * Muhim: `violet` va `gold` id'lari saqlangan (avvalgi tanlovlar saqlanishi uchun),
 * faqat label/atmosfera yangilangan (Amethyst / Gold Elite).
 */

export interface AccentTheme {
  id:      string
  label:   { uz: string; ru: string }
  /** Aksent rang — CSS --p-primary bilan bir xil */
  color:   string
  /** Atmosfera foni (preview swatch) */
  bg:      string
  /** Karta rangi (preview swatch) */
  card:    string
  /** Neon glow atmosferasi bormi */
  glow:    boolean
  premium: boolean
}

export const DEFAULT_ACCENT = 'kiwi' as const

export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'kiwi',     label: { uz: 'Kiwi (standart)', ru: 'Киви (стандарт)' }, color: '#5be300', bg: '#090e18', card: '#162132', glow: true,  premium: false },
  { id: 'aurora',   label: { uz: 'Aurora',          ru: 'Аврора'          }, color: '#00ffa3', bg: '#061019', card: '#0d2231', glow: true,  premium: true  },
  { id: 'violet',   label: { uz: 'Amethyst',        ru: 'Аметист'         }, color: '#a855f7', bg: '#120b1c', card: '#221536', glow: true,  premium: true  },
  { id: 'ocean',    label: { uz: 'Ocean',           ru: 'Океан'           }, color: '#38bdf8', bg: '#071120', card: '#0e2138', glow: false, premium: true  },
  { id: 'forest',   label: { uz: 'Forest',          ru: 'Лес'             }, color: '#34d399', bg: '#08130d', card: '#10281c', glow: false, premium: true  },
  { id: 'sunset',   label: { uz: 'Sunset',          ru: 'Закат'           }, color: '#fb923c', bg: '#160f08', card: '#291b0d', glow: true,  premium: true  },
  { id: 'sakura',   label: { uz: 'Sakura',          ru: 'Сакура'          }, color: '#ec4899', bg: '#fff1f5', card: '#ffffff', glow: false, premium: true  },
  { id: 'obsidian', label: { uz: 'Obsidian',        ru: 'Обсидиан'        }, color: '#e4e4e7', bg: '#050506', card: '#131316', glow: false, premium: true  },
  { id: 'gold',     label: { uz: 'Gold Elite',      ru: 'Gold Elite'      }, color: '#facc15', bg: '#0b0903', card: '#1c1604', glow: true,  premium: true  },
  { id: 'payme',    label: { uz: 'Payme',           ru: 'Payme'           }, color: '#00c0c9', bg: '#090e18', card: '#162132', glow: false, premium: true  },
]

export function getAccentTheme(id: string): AccentTheme {
  return ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0]
}

/** Free foydalanuvchi premium tema tanlab qolsa — default'ga qaytaradi. */
export function resolveAccent(id: string, isPremium: boolean): string {
  const theme = getAccentTheme(id)
  if (theme.premium && !isPremium) return DEFAULT_ACCENT
  return theme.id
}
