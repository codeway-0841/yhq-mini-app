import React, { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'

/* Rang intizomi (v3): ikonkalar NEYTRAL — aksent FAQAT CTA/progress/active
   holatda. "Ikonka + tintli chip" naqshi TIZIMDAN CHIQARILDI: u har bir
   AI-generatsiya dashboard'ning asosiy belgisi edi. Flat ikonka + hairline
   divider'li grouped list — karta panjarasidan farqli, kattalar mahsuloti
   ritmini beradi (iOS/Linear uslubi, lekin o'z tokenlarimizda). */

/** Interaktiv holat klasslari — barcha bosiladigan elementlarga bir xil. */
const interactive = cn(
  'transition-[transform,background-color,border-color] duration-150 ease-out',
  'active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
)

/** Qizil sonli badge (xatolar soni kabi) — semantik, faqat ma'noli joyda. */
function CountPill({ count }: { count: number }) {
  return (
    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-pdanger px-1.5 text-[10px] font-semibold tabular-nums text-white">
      {count}
    </span>
  )
}

// ── ModeList — guruhlangan ro'yxat konteyneri (bitta sirt, hairline qatorlar) ─
export const ModeList = memo(function ModeList({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-pcard shadow-xs [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-pline">
      {children}
    </div>
  )
})

// ── ModeRow — grouped list qatori: flat ikonka + label + o'ng tomonda meta ──
export const ModeRow = memo(function ModeRow({ icon: Icon, label, badge, comingSoon, onClick }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  comingSoon?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}${comingSoon ? ' (tez orada)' : ''}`}
      className={cn(
        'flex w-full items-center gap-3.5 px-4 py-3.5 text-left',
        interactive,
        'hover:bg-psurface',
        comingSoon && 'opacity-55',
      )}
    >
      <Icon size={21} strokeWidth={1.75} className="shrink-0 text-pmuted" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-pfg">{label}</span>
      {badge != null && badge > 0
        ? <CountPill count={badge} />
        : !comingSoon && <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-psubtle" />}
    </button>
  )
})

// ── ModeGridCard — "Yana" sheet'dagi 3-ustunli panjara kartasi (ServiceCard'ning
//    kengayuvchan varianti: fixed o'lcham o'rniga grid kataqqa to'la sig'adi) ──
export const ModeGridCard = memo(function ModeGridCard({ icon: Icon, label, onClick }: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative flex w-full aspect-square flex-col items-center justify-center gap-2.5 p-2.5',
        'rounded-2xl bg-pcard shadow-xs',
        interactive,
        'hover:bg-psurface',
      )}
    >
      <Icon size={26} strokeWidth={1.75} className="text-pmuted" />
      <span className="line-clamp-2 flex min-h-[26px] items-center justify-center px-0.5 text-center text-[11px] font-medium leading-[1.25] text-pfg">
        {label}
      </span>
    </button>
  )
})

// ── Service Carousel Card — kvadrat (auto-scroll karusel uchun) ────────────
// Chip'siz: katta flat ikonka + kichik label. Kvadrat ritm saqlanadi.
export const ServiceCard = memo(function ServiceCard({ icon: Icon, label, onClick }: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative flex size-[96px] shrink-0 snap-start flex-col items-center justify-center gap-2.5 p-2.5 sm:size-[104px]',
        'rounded-2xl bg-pcard shadow-xs',
        interactive,
        'hover:bg-psurface',
      )}
    >
      <Icon size={26} strokeWidth={1.75} className="text-pmuted" />
      <span className="line-clamp-2 flex min-h-[26px] items-center justify-center px-0.5 text-center text-[11px] font-medium leading-[1.25] text-pfg">
        {label}
      </span>
    </button>
  )
})
