import * as React from 'react'
import { X } from 'lucide-react'
import DialogOverlay from '../DialogOverlay'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Sheet — pastdan chiquvchi panel (Telegram WebView'da asosiy modal shakli:
 * bosh barmoq zonasida, katta target).
 *
 * Radix Dialog EMAS — loyihaning mavjud `DialogOverlay` primitivi ustida quriladi:
 * unda focus-trap, Escape, body scroll-lock, nested overlay stack va focus restore
 * allaqachon ishlaydi va testlar bilan qoplangan. Bu qatlam faqat shadcn'ga o'xshash
 * API va KIWI stilini beradi.
 *
 * Geometriya: faqat yuqori burchaklar 24px, pastda safe-area.
 */
interface SheetProps {
  open?: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Nested sheet uchun (default 50; ichki modallar 60, celebration 70) */
  zIndex?: number
}

/** Sarlavha id'si — HAR sheet uchun unikal (nested sheet'da aria-labelledby
 *  to'qnashmasligi kerak; DialogOverlay nested stack'ni qo'llab-quvvatlaydi). */
const SheetTitleIdContext = React.createContext<string | undefined>(undefined)

function Sheet({ open = true, onClose, children, className, zIndex }: SheetProps) {
  const titleId = React.useId()
  if (!open) return null
  return (
    <SheetTitleIdContext.Provider value={titleId}>
    <DialogOverlay onClose={onClose} labelId={titleId} position="bottom" zIndex={zIndex}>
      <div
        className={cn(
          'relative z-10 w-full max-w-lg mx-auto',
          'rounded-t-sheet bg-pcard shadow-2xl',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200',
          'max-h-[88dvh] overflow-y-auto',
          // Pastki safe-area MARKAZIY: DialogOverlay (position='bottom')
          // konteyneri --safe-bottom'ga ko'taradi (env+TG var max) — bu yerda
          // qayta qo'shilsa inset IKKI marta chiqardi (2026-09-01 audit).
          className,
        )}
      >
        {/* Tortish dastagi — sheet ekanini bildiradi (affordance) */}
        <div aria-hidden="true" className="mx-auto mt-3 h-1 w-9 rounded-full bg-plineStrong" />
        {children}
      </div>
    </DialogOverlay>
    </SheetTitleIdContext.Provider>
  )
}

function SheetHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1 px-5 pb-3 pt-4', className)} {...props}>
      {children}
    </div>
  )
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const titleId = React.useContext(SheetTitleIdContext)
  return (
    <h2
      id={titleId}
      className={cn('font-display text-[19px] font-semibold tracking-[-0.015em] text-pfg', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13.5px] text-pmuted', className)} {...props} />
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 px-5 pb-5 pt-1', className)} {...props} />
}

/** O'ng yuqori burchakdagi yopish tugmasi — 44px target. */
function SheetClose({ onClose, label = 'Yopish' }: { onClose: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className={cn(
        'absolute right-3 top-3 grid size-11 place-items-center rounded-xl text-pmuted',
        'transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
      )}
    >
      <X className="size-[18px]" />
    </button>
  )
}

export { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose }
