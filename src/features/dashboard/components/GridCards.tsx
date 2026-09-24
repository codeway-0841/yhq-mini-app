import React, { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'

/* Rang intizomi (v3): ikonkalar NEYTRAL — aksent FAQAT CTA/progress/active
   holatda. Flat ikonka + hairline divider'li grouped list / ixcham grid. */

/** Interaktiv holat klasslari — barcha bosiladigan elementlarga bir xil (karta-scale YO'Q). */
const interactive = cn(
  'transition-[background-color,border-color,transform] duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
)

/** Qizil sonli badge (xatolar soni kabi) — semantik, faqat ma'noli joyda. */
function CountPill({ count }: { count: number }) {
  return (
    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-pdanger px-1.5 text-[12px] font-semibold tabular-nums text-white">
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
  comingSoon?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}${comingSoon ? ` (${comingSoon})` : ''}`}
      className={cn(
        'flex w-full items-center gap-3.5 px-4 py-3.5 text-left',
        interactive,
        '[@media(hover:hover)]:hover:bg-psurface',
      )}
    >
      <Icon size={21} strokeWidth={1.75} className="shrink-0 text-pmuted" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-pfg">{label}</span>
      {comingSoon && (
        <span className="shrink-0 rounded-full bg-psurface px-2.5 py-1 text-[12px] font-medium text-pmuted">{comingSoon}</span>
      )}
      {badge != null && badge > 0
        ? <CountPill count={badge} />
        : !comingSoon && <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-psubtle" />}
    </button>
  )
})

// ── ModeGridCard — Ixcham va qulay 3-ustunli panjara kartasi (desktop'da kengaytirilgan) ──
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
        'group relative flex w-full flex-col items-center justify-center gap-1.5 py-3 px-2 min-h-[78px]',
        'sm:gap-2.5 sm:py-4 sm:px-3 sm:min-h-[96px]',
        'lg:gap-3 lg:py-5 lg:px-4 lg:min-h-[120px]',
        'rounded-xl sm:rounded-2xl bg-pcard shadow-xs active:scale-95 transition-all duration-150',
        'lg:hover:shadow-md lg:hover:-translate-y-0.5',
        interactive,
        '[@media(hover:hover)]:hover:bg-psurface',
      )}
    >
      <div className="grid place-items-center size-8 sm:size-10 lg:size-12 rounded-lg sm:rounded-xl lg:rounded-2xl bg-psurface text-pfg shrink-0 transition-transform duration-200 group-hover:scale-110">
        <Icon size={20} strokeWidth={1.8} className="sm:hidden text-pmuted group-hover:text-pfg transition-colors" />
        <Icon size={22} strokeWidth={1.8} className="hidden sm:block lg:hidden text-pmuted group-hover:text-pfg transition-colors" />
        <Icon size={26} strokeWidth={1.8} className="hidden lg:block text-pmuted group-hover:text-pfg transition-colors" />
      </div>
      <span className="line-clamp-2 flex items-center justify-center px-0.5 text-center text-[12px] sm:text-[13px] lg:text-[14px] font-medium lg:font-semibold leading-snug text-pfg">
        {label}
      </span>
    </button>
  )
})

// ── Service Carousel Card — kvadrat (qo‘lda suriladigan karusel uchun) ────────────
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
        'relative flex size-[100px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 p-2 sm:size-[112px]',
        'rounded-xl sm:rounded-2xl bg-pcard shadow-xs active:scale-95',
        interactive,
        '[@media(hover:hover)]:hover:bg-psurface',
      )}
    >
      <Icon size={22} strokeWidth={1.8} className="shrink-0 text-pmuted" />
      <span className="line-clamp-2 flex items-center justify-center px-0.5 text-center text-[12px] font-medium leading-snug text-pfg">
        {label}
      </span>
    </button>
  )
})
