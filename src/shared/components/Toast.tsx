import { useEffect } from 'react'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../lib/cn'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const

const ICON_TONE = {
  success: 'text-psuccess',
  error: 'text-pdanger',
  info: 'text-ppurple',
} as const

/**
 * KIWI Toast — suzuvchi qatlam, shuning uchun YAGONA joy soya ishlatiladi.
 *
 * v3'da chapdagi qalin rangli chiziq (border-l-4) olib tashlandi: status
 * ikonka rangida beriladi, karta grammatikasi esa qolgan interfeys bilan
 * bir xil qoladi (card + hairline).
 */
export default function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const Icon = ICONS[type]

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-3 rounded-container border border-pline bg-pcard p-3.5',
        'shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)]',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-200',
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className={cn('mt-px size-[18px] shrink-0', ICON_TONE[type])} />
      <p className="min-w-0 flex-1 text-[14px] font-medium text-pfg">{message}</p>
      <button
        onClick={() => onClose(id)}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-[7px] text-psubtle',
          'transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
        )}
        aria-label="Yopish"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
