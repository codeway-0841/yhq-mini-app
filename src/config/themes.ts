/**
 * KIWI Premium aksent temalari — YAGONA MANBA.
 *
 * Majburiyatlar:
 * - DEFAULT_ACCENT har doim `premium: false` bo'lishi shart (bepul default).
 * - Har bir id uchun `src/index.css` da `body[data-accent='<id>']` bloki bo'lishi
 *   kerak (default kiwi :root'dagi --p-primary).
 * - `premium: true` temalarni faqat Premium obunachilar tanlay oladi
 *   (App.tsx da free foydalanuvchi har doim default TEMAGA qaytariladi).
 *
 * Consistency test: tests/unit/config/themes.test.ts
 */

export interface AccentTheme {
  id:      string
  label:   { uz: string; ru: string }
  /** Sozlamalardagi rangli nuqta (swatch) uchun */
  color:   string
  premium: boolean
}

export const DEFAULT_ACCENT = 'kiwi' as const

export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'kiwi',   label: { uz: 'Kiwi (standart)', ru: 'Киви (стандарт)' }, color: '#5be300', premium: false },
  { id: 'ocean',  label: { uz: 'Okean',           ru: 'Океан'           }, color: '#3b82f6', premium: true  },
  { id: 'violet', label: { uz: 'Binafsha',        ru: 'Фиолетовый'      }, color: '#8b5cf6', premium: true  },
  { id: 'gold',   label: { uz: 'Oltin',           ru: 'Золотой'         }, color: '#facc15', premium: true  },
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
