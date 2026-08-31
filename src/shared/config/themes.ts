/**
 * KIVVI Premium TEMALAR (atmosfera) — YAGONA MANBA.
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
 * - `glow` — v3'da glow tizimdan chiqarildi; maydon interfeys
 *   barqarorligi uchun qoldi va HAR DOIM false (swatch preview'da halqa yo'q).
 * - `premium: true` temalarni faqat obunachilar tanlaydi YOKI tangaga sotib oladi
 *   (App.tsx dagi resolveAccent free user'ni default'ga qaytaradi — egasiz bo'lsa).
 * - COIN temalari: `premium: false` + shared/shop-items.ts'da 'accent-theme'
 *   yozuvi bor (crimson/royal/arctic) — FAQAT tangaga sotib olinganda ochiladi,
 *   premium obuna ham bermaydi (shop-items.test.ts desync'ni ushlaydi).
 *   Narx BU FAYLDA EMAS — shared/shop-items.ts'da.
 *
 * Muhim: `violet` va `gold` id'lari saqlangan (avvalgi tanlovlar saqlanishi uchun),
 * faqat label/atmosfera yangilangan (Amethyst / Gold Elite).
 */

import { getShopItem } from '../../../shared/shop-items'

export interface AccentTheme {
  id:      string
  label:   { uz: string; ru: string }
  /** Aksent rang — CSS --p-primary bilan bir xil */
  color:   string
  /** Atmosfera foni (preview swatch) */
  bg:      string
  /** Karta rangi (preview swatch) */
  card:    string
  /** @deprecated v3: glow tizimda yo'q — har doim false */
  glow:    boolean
  premium: boolean
}

export const DEFAULT_ACCENT = 'kiwi' as const

export const ACCENT_THEMES: AccentTheme[] = [
  // DIQQAT: id 'kiwi' TARIXIY — persist settings, shop egaligi (user_items) va
  // sounds THEME_FREQ shu id'ga bog'langan, SHUNING UCHUN O'ZGARMAYDI.
  // Lekin RANGI 2026-08-31 rebrending bilan KIVVI Blue (#1a81fc) — eski yashil
  // default'dan o'tildi; mavjud userlar (persist'da accent:'kiwi') avtomatik
  // ko'k aksent oladi, migratsiya shart emas.
  { id: 'kiwi',     label: { uz: 'KIVVI Blue (standart)', ru: 'KIVVI Blue (стандарт)' }, color: '#1a81fc', bg: '#0d1117', card: '#161b22', glow: false, premium: false },
  { id: 'obsidian', label: { uz: 'Linear Tech',             ru: 'Linear Tech'             }, color: '#3b82f6', bg: '#08090a', card: '#111215', glow: false, premium: true  },
  { id: 'neo',      label: { uz: 'Gamified Neo',            ru: 'Gamified Neo'            }, color: '#22c55e', bg: '#0f172a', card: '#1e293b', glow: false, premium: true  },
  { id: 'nordic',   label: { uz: 'Nordic Glass',            ru: 'Nordic Glass'            }, color: '#38bdf8', bg: '#0c1017', card: '#131924', glow: false, premium: true  },
  { id: 'carplay',  label: { uz: 'CarPlay Luxury',          ru: 'CarPlay Luxury'          }, color: '#f97316', bg: '#0b0d11', card: '#14171f', glow: false, premium: true  },
  { id: 'aurora',   label: { uz: 'Aurora',                  ru: 'Аврора'                  }, color: '#16c79a', bg: '#081614', card: '#0d1c19', glow: false, premium: true  },
  { id: 'violet',   label: { uz: 'Amethyst',                ru: 'Аметист'                 }, color: '#9d7bea', bg: '#130f1a', card: '#1a1523', glow: false, premium: true  },
  { id: 'ocean',    label: { uz: 'Ocean',                   ru: 'Океан'                   }, color: '#3d9ad9', bg: '#0a1219', card: '#101a23', glow: false, premium: true  },
  { id: 'forest',   label: { uz: 'Forest',                  ru: 'Лес'                     }, color: '#3fae7c', bg: '#0a1410', card: '#101b15', glow: false, premium: true  },
  { id: 'sunset',   label: { uz: 'Sunset',                  ru: 'Закат'                   }, color: '#e08b4a', bg: '#17110b', card: '#1e1610', glow: false, premium: true  },
  { id: 'sakura',   label: { uz: 'Sakura',                  ru: 'Сакура'                  }, color: '#c4487a', bg: '#fdf6f7', card: '#ffffff', glow: false, premium: true  },
  { id: 'gold',     label: { uz: 'Gold Elite',              ru: 'Gold Elite'              }, color: '#d9a441', bg: '#100d06', card: '#17130a', glow: false, premium: true  },
  { id: 'payme',    label: { uz: 'Payme',                   ru: 'Payme'                   }, color: '#00b0b9', bg: '#0d1117', card: '#161b22', glow: false, premium: true  },
  // ── APPLE & AI EDITION (premium: true) ──
  { id: 'claude',      label: { uz: 'Claude AI',               ru: 'Claude AI'               }, color: '#d97757', bg: '#141413', card: '#1e1e1d', glow: false, premium: true  },
  { id: 'cupertino',   label: { uz: 'Cupertino (iOS)',         ru: 'Cupertino (iOS)'         }, color: '#0a84ff', bg: '#000000', card: '#121214', glow: false, premium: true  },
  { id: 'titanium',    label: { uz: 'Natural Titanium',        ru: 'Натуральный титан'       }, color: '#e4a853', bg: '#0c0c0e', card: '#161619', glow: false, premium: true  },
  { id: 'deeppurple',  label: { uz: 'Deep Purple (Apple)',     ru: 'Deep Purple (Apple)'     }, color: '#bf5af2', bg: '#0b0813', card: '#151022', glow: false, premium: true  },
  { id: 'liquidglass', label: { uz: 'Vision Glass (Apple)',    ru: 'Vision Glass (Apple)'    }, color: '#64d2ff', bg: '#070b12', card: '#0f1726', glow: false, premium: true  },
  // ── COIN-EKSKLYUZIV (premium:false) — FAQAT do'konda tanga evaziga ochiladi.
  // Narxlar: shared/shop-items.ts (server ham o'qiydi). ──
  { id: 'crimson',  label: { uz: 'Crimson',                 ru: 'Малиновый'               }, color: '#e04a5f', bg: '#170c0e', card: '#1e1013', glow: false, premium: false },
  { id: 'royal',    label: { uz: 'Royal',                   ru: 'Королевский'             }, color: '#7b83e0', bg: '#0c0c15', card: '#12131f', glow: false, premium: false },
  { id: 'arctic',   label: { uz: 'Arctic',                  ru: 'Арктика'                 }, color: '#0b7fb8', bg: '#f7fafc', card: '#ffffff', glow: false, premium: false },
]

export function getAccentTheme(id: string): AccentTheme {
  return ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0]
}

/**
 * Tema qulfdami? (FIXPLAN #40 — coin egaligi bilan kengaytirildi):
 *  - Egalik (coin'ga sotib olingan) HAR QANDAY temani ochadi (premium ham).
 *  - Premium tema: isPremium YOKI egalik.
 *  - Coin-eksklyuziv (premium:false + shop'da bor): FAQAT egalik.
 *  - Oddiy free (shop'da yo'q, premium emas — faqat default 'kiwi' id'li tema): doim ochiq.
 * `ownedIds` — user_items'dagi item id'lar (shared/shop-items id'lari = tema id).
 */
export function isAccentUnlocked(
  id: string,
  isPremium: boolean,
  ownedIds?: ReadonlySet<string> | null,
): boolean {
  const theme = getAccentTheme(id)
  if (ownedIds?.has(theme.id)) return true
  if (theme.premium) return isPremium
  if (getShopItem(theme.id)?.kind === 'accent-theme') return false   // coin-eksklyuziv
  return true
}

/** Free/egasiz foydalanuvchi yopiq tema tanlab qolsa — default'ga qaytaradi. */
export function resolveAccent(
  id: string,
  isPremium: boolean,
  ownedIds?: ReadonlySet<string> | null,
): string {
  return isAccentUnlocked(id, isPremium, ownedIds) ? getAccentTheme(id).id : DEFAULT_ACCENT
}
