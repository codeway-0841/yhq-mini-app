import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Sahifa headeri SSOT (2026-09-15 "hamma joyda bir xil header" fix).
 *
 * Muammo: 25+ sahifada bir xil qalin `bg-pcanvas border-b border-pline`
 * klon-header — veb-sayt hissi berardi, real (native) ilovalarda bunday
 * bo'lmaydi: fon to'liq no-shaffof (bg-pcanvas), shaffoflik va chiziqlarsiz toza.
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
            className="flex size-10 shrink-0 items-center justify-center -ml-1 text-pfg hover:opacity-80 active:scale-90 transition-transform focus-visible:outline-none cursor-pointer"
          >
            <ChevronLeft size={24} strokeWidth={2.25} />
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
