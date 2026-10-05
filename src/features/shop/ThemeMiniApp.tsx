/**
 * Tema mini-ilova preview — "rangli to'rtburchak" O'RNIGA (v2 redesign).
 *
 * Muammo (eski holat): preview 52px balandlikdagi ikki chiziq edi — odam
 * nima sotib olayotganini KO'RMASDI (mavzu qanday ko'rinishini tasavvur
 * qilish kerak edi). Mavzu do'konlarining standarti — mahsulotni ko'rsatish.
 *
 * Yechim: `ACCENT_THEMES` dagi haqiqiy palitradan (`bg`, `card`, `color`)
 * chizilgan MINI ILOVA kadri — sarlavha, kontent kartasi, progress va CTA.
 * Sof CSS/inline-style: qo'shimcha rasm asset'i YO'Q, yangi token YO'Q.
 *
 * MUHIM: ranglar ataylab xom `theme.*` dan olinadi (joriy `--p-*` tokenidan
 * EMAS) — aks holda istalgan tema joriy temaning rangida ko'rinardi va
 * preview o'z ma'nosini yo'qotardi. Light temalar (arctic, sakura) shu sababli
 * oq fon bilan to'g'ri chiqadi.
 *
 * `aria-hidden` — bu dekorativ rasm, ekran o'quvchi uchun matn kartada bor.
 */
import type { AccentTheme } from '../../shared/config/themes'
import { cn } from '../../shared/lib/cn'

export default function ThemeMiniApp({ theme, className }: { theme: AccentTheme; className?: string }) {
  const { bg, card, color } = theme
  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-[16/11] w-full select-none overflow-hidden rounded-xl', className)}
      style={{ background: bg }}
    >
      {/* App bar — aksent belgisi + ikkita neytral tugma nuqtasi */}
      <div className="absolute inset-x-[9%] top-[9%] flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: color }} />
        <span className="h-1 w-[26%] rounded-full opacity-55" style={{ background: color }} />
        <span className="ml-auto flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full opacity-25" style={{ background: color }} />
          <span className="h-1.5 w-1.5 rounded-full opacity-25" style={{ background: color }} />
        </span>
      </div>

      {/* Kontent kartasi (theme.card) — ikki qator "matn" */}
      <div
        className="absolute inset-x-[9%] top-[28%] flex h-[34%] flex-col justify-center gap-1.5 rounded-lg px-2"
        style={{ background: card, boxShadow: '0 1px 3px rgb(0 0 0 / 0.16)' }}
      >
        <span className="h-1.5 w-[68%] rounded-full" style={{ background: color, opacity: 0.75 }} />
        <span className="h-1 w-[46%] rounded-full" style={{ background: color, opacity: 0.32 }} />
      </div>

      {/* Progress — aksent fill (active holat ma'nosi) */}
      <div className="absolute inset-x-[9%] bottom-[17%] h-1 overflow-hidden rounded-full" style={{ background: card }}>
        <span className="block h-full w-[62%] rounded-full" style={{ background: color }} />
      </div>

      {/* Asosiy CTA — aksent to'liq to'yinganlikda */}
      <div className="absolute inset-x-[9%] bottom-[5%] h-[10%] rounded-md" style={{ background: color }} />
    </div>
  )
}
