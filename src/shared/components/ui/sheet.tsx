import * as React from 'react'
import DialogOverlay, { type CloseReason } from '../DialogOverlay'
import ModalMathGrid from '../ModalMathGrid'
import ModalCloseButton from '../ModalCloseButton'
import ModalHeaderRow from '../ModalHeaderRow'
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
  /** Pastga surib yopish imkoniyati (default: true) */
  swipeToDismiss?: boolean
  /** Gesture faqat drag-handle yoki header zonasi orqali boshlanishi (default: false — full surface drag) */
  dragHandleOnly?: boolean
  /** Backdrop bosilganda yopilish siyosati (dirty form'lar uchun). */
  closeOnBackdrop?: boolean
  /** Escape/back/swipe/backdrop yopilishiga ruxsat beruvchi guard. */
  canDismiss?: (reason: CloseReason) => boolean
  /** Maxsus backdrop ko'rinishi. */
  backdropClassName?: string
  glowColor?: string
}

/** Sarlavha id'si — HAR sheet uchun unikal (nested sheet'da aria-labelledby
 *  to'qnashmasligi kerak; DialogOverlay nested stack'ni qo'llab-quvvatlaydi). */
const SheetTitleIdContext = React.createContext<string | undefined>(undefined)

function Sheet({
  open = true,
  onClose,
  children,
  className,
  zIndex,
  swipeToDismiss = true,
  dragHandleOnly = false,
  closeOnBackdrop = true,
  canDismiss,
  backdropClassName,
  glowColor: _glowColor,
}: SheetProps) {
  const titleId = React.useId()
  if (!open) return null
  return (
    <SheetTitleIdContext.Provider value={titleId}>
    <DialogOverlay
      onClose={onClose}
      labelId={titleId}
      position="bottom"
      zIndex={zIndex}
      swipeToDismiss={swipeToDismiss}
      dragHandleOnly={dragHandleOnly}
      closeOnBackdrop={closeOnBackdrop}
      canDismiss={canDismiss}
      backdropClassName={backdropClassName}
    >
      <div
        className={cn(
          'relative z-10 w-full max-w-lg mx-auto',
          'rounded-t-sheet bg-psurface shadow-2xl overflow-hidden',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200',
          'max-h-[88dvh] overflow-y-auto',
          // Pastki safe-area MARKAZIY: DialogOverlay (position='bottom')
          // konteyneri --safe-bottom'ga ko'taradi (env+TG var max) — bu yerda
          // qayta qo'shilsa inset IKKI marta chiqardi (2026-09-01 audit).
          className,
        )}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-t-sheet z-0">
          <ModalMathGrid glow={false} height={320} />
        </div>
        {/* Tortish dastagi — sheet ekanini bildiradi (affordance) */}
        <div
          data-drag-handle
          aria-hidden="true"
          className="relative z-10 mx-auto mt-2.5 mb-1.5 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20 cursor-grab active:cursor-grabbing touch-none select-none"
        />
        {children}
      </div>
    </DialogOverlay>
    </SheetTitleIdContext.Provider>
  )
}

function SheetHeader({
  className,
  children,
  onClose,
  closeLabel = 'Yopish',
  right,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Berilsa — standart qator: [X chapda | sarlavha o'rtada] (ModalHeaderRow) */
  onClose?: () => void
  closeLabel?: string
  right?: React.ReactNode
}) {
  if (onClose) {
    return (
      <ModalHeaderRow onClose={onClose} label={closeLabel} right={right} className={className}>
        {children}
      </ModalHeaderRow>
    )
  }
  return (
    <div data-drag-handle className={cn('relative z-10 flex flex-col items-center justify-center min-h-10 px-12 pb-3 pt-0.5 select-none text-center', className)} {...props}>
      {children}
    </div>
  )
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const titleId = React.useContext(SheetTitleIdContext)
  return (
    <h2
      id={titleId}
      className={cn('font-display text-[17px] font-bold tracking-tight text-pfg', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[12.5px] text-pmuted', className)} {...props} />
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 relative z-10', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 px-5 pb-5 pt-1 relative z-10', className)} {...props} />
}

/** Yuqori chap burchakdagi Apple-uslubidagi yopish tugmasi */
function SheetClose({ onClose, label = 'Yopish', className }: { onClose: () => void; label?: string; className?: string }) {
  return <ModalCloseButton onClick={onClose} label={label} className={className} />
}

export { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose }
