import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Sahifa headeri SSOT (2026-09-15 "hamma joyda bir xil header" fix).
 *
 * Muammo: 25+ sahifada bir xil qalin `bg-pcanvas border-b border-pline`
 * klon-header — veb-sayt hissi berardi, real (native) ilovalarda bunday
 * bo'lmaydi: u yerda fon shaffof-blur, ajratuvchi chiziq FAQAT scroll'da.
 *
 * Qoidalar:
 *  - Oddiy sahifa headeri O'RNIGA SHU komponent (maxsus holat: sessiya/
 *    duel/test kabi jonli headerlar — ular ham `.page-header` CSS klassini
 *    ishlatadi, layout o'zlariniki).
 *  - `size="lg"` — pastki dock tab-root'lari (`/testlar`, `/rejimlar`):
 *    back tugmasiz katta sarlavha (tab-root'da back bo'lmaydi — iOS HIG).
 *  - `size="md"` (default) — ichki sahifa: back + sarlavha (+ subtitle/actions).
 *  - Import FAQAT to'g'ridan-to'g'ri (`.../ui/page-header`) — ui barrel
 *    bundle'ga radix'larni tortadi (ui/index.ts izohi).
 */
interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  onBack?: () => void
  backLabel?: string
  actions?: ReactNode
  /** 'lg' — tab-root (back'siz katta sarlavha); 'md' — ichki sahifa */
  size?: 'md' | 'lg'
  /** Masalan "-mx-4" — ota `px-4` bo'lsa chekkagacha yoyilish uchun */
  className?: string
  /** Sarlavha qatoridan PASTDAGI qism (tablar, qidiruv, progress) */
  children?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  size = 'md',
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn('sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] page-header', className)}>
      <div className="flex min-h-14 items-center gap-1.5 px-4 py-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel ?? 'Orqaga'}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:bg-white/10 dark:text-white dark:border-white/10 dark:shadow-none active:scale-95 hover:scale-105 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary cursor-pointer"
          >
            <ChevronLeft size={22} strokeWidth={2.25} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={size === 'lg' ? 'text-[22px] font-bold leading-tight tracking-tight text-pfg' : 'truncate text-[17px] font-semibold leading-snug text-pfg'}>
            {title}
          </h1>
          {subtitle ? <p className="truncate text-xs text-pmuted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}
