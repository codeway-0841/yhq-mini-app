/**
 * AVATAR RAMKALARI (do'kon kosmetikasi, FIXPLAN #40) — YAGONA MANBA (frontend).
 *
 * CSS-only ramkalar (rasm asset'siz): har ramka uchun `src/index.css` da
 * `.avatar-frame-<id>` klassi — wrapper'ga gradient background + padding,
 * ichki img rounded-full (consistency test klass mavjudligini tekshiradi).
 *
 * QOIDALAR:
 * - `id` shared/shop-items.ts dagi 'avatar-frame' kind item `id`si bilan BIR XIL
 *   (desync'ni tests/unit/config/shop-items.test.ts ushlaydi).
 * - Narx BU YERDA EMAS — faqat shared/shop-items.ts'da (server ham o'qiydi).
 * - 'frame-neon' maxsus: gradient var(--p-primary)'ga qurilgan — joriy aksent
 *   temasi bilan avtomatik uyg'unlashadi.
 */

export interface AvatarFrame {
  id:        string
  label:     { uz: string; ru: string }
  /** index.css dagi klass: `.avatar-frame-<id>` */
  cssClass:  string
  /** Preview/hint uchun asosiy rang (dokon kartasidagi chip) */
  color:     string
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  { id: 'frame-neon',   label: { uz: 'Neon halqa',      ru: 'Неоновое кольцо'   }, cssClass: 'avatar-frame-neon',   color: '#5be300' },
  { id: 'frame-arctic', label: { uz: 'Muzli halqa',     ru: 'Ледяное кольцо'    }, cssClass: 'avatar-frame-arctic', color: '#38bdf8' },
  { id: 'frame-royal',  label: { uz: 'Qirollik halqasi',ru: 'Королевское кольцо'}, cssClass: 'avatar-frame-royal',  color: '#818cf8' },
  { id: 'frame-gold',   label: { uz: 'Oltin halqa',     ru: 'Золотое кольцо'    }, cssClass: 'avatar-frame-gold',   color: '#facc15' },
  { id: 'frame-fire',   label: { uz: 'Olov halqasi',    ru: 'Огненное кольцо'   }, cssClass: 'avatar-frame-fire',   color: '#fb923c' },
]

export function getAvatarFrame(id: string | null | undefined): AvatarFrame | null {
  if (!id) return null
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null
}
