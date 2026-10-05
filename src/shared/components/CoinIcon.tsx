import { memo, type CSSProperties, type SVGProps } from 'react'
import { cn } from '../lib/cn'

export interface CoinIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Piksel balandligi (eski SVG o'lchami) — emoji shrift o'lchamiga aylanadi */
  size?: number | string
  className?: string
  style?: CSSProperties
}

/** SVG o'lcham → emoji shrift o'lchami nisbati (vizual balandlik mos bo'lsin) */
const FONT_RATIO = 0.92

function toFontSize(size: number | string): string {
  if (typeof size === 'number') return `${(size * FONT_RATIO).toFixed(2)}px`
  // '1em', '1.5rem' kabi qiymatlar uchun — shu birlikda qoldiramiz
  const m = /^(-?[\d.]+)([a-z%]*)$/i.exec(size.trim())
  if (!m) return size
  const n = Number(m[1])
  return Number.isFinite(n) ? `${(n * FONT_RATIO).toFixed(3)}${m[2] || 'px'}` : size
}

/**
 * TANGA ikonkasi — platforma bo'ylab YAGONA brend vizuali.
 *
 * Ilgari bu yerda qo'lda chizilgan SVG (tanga ustunlari) bor edi; Achievements'dagi
 * ko'rinish (oltin tanga) tanlandi va endi HAMMA JOYGA shu tarqatiladi. Barcha
 * chaqiruv joylari (`size` / `className` / `style`) o'zgarishsiz ishlaydi — faqat
 * ICHKI ko'rinish almashdi, shu sababli bitta joyda tuzatish butun ilovaga
 * (Do'kon, Profil, TopBar, Sidebar, natijalar modali, AI test...) tegadi.
 *
 * ⚠️ MUHIM: emoji `currentColor`ni QABUL QILMAYDI — tanga doim o'z oltin rangida
 * chiziladi. Chaqiruv joyidagi `text-pgold` / `text-amber-500` endi tangaga ta'sir
 * qilmaydi (matn/raqamlar esa avvalgidek rangni oladi). Bu ATAYLAB — tanga vizuali
 * doim bir xil bo'lishi brend uchun muhimroq. Agar bir joyda tanga fon bilan
 * qo'shilib ketsa, o'z joyida kontrast beruvchi FON qo'shing, rangni emas.
 *
 * SVG-only proplar (`strokeWidth`, `fill`, `viewBox`...) ATAYLAB yutiladi: ularni
 * `<span>`ga uzatish DOM ogohlantirishi berardi, `<svg>` esa endi yo'q.
 *
 * `className` TO'LIQ o'ramga beriladi (`shrink-0`, `ml-auto`, `text-*` — hammasi).
 * Baza klasslar ataylab minimal (`inline-flex items-center leading-none`) —
 * `shrink-0` kabi konfliktli klass qo'shilsa, `cn` (twMerge) uni chaqiruv
 * joyining o'z klassi bilan almashib qo'yardi.
 *
 * `aria-hidden` — dekorativ: tanga yonida har doim raqam matni bo'ladi (ekran
 * o'quvchi uchun raqam yetarli, "tanga" so'zi ortiqcha takrorlanmaydi).
 */
export const CoinIcon = memo(function CoinIcon({
  size = 16,
  className = '',
  style,
}: CoinIconProps) {
  return (
    <span
      className={cn('inline-flex items-center leading-none', className)}
      style={{ fontSize: toFontSize(size), ...style }}
      aria-hidden="true"
    >
      <span className="leading-none">🪙</span>
    </span>
  )
})

export default CoinIcon
