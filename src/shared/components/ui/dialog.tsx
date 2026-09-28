import * as React from 'react'
import DialogOverlay from '../DialogOverlay'
import ModalMathGrid from '../ModalMathGrid'
import ModalCloseButton from '../ModalCloseButton'
import { Button } from './button'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Dialog — markazda turuvchi modal (qisqa tasdiq/xabar uchun).
 * Uzun kontent yoki tanlov ro'yxati bo'lsa — `Sheet` ishlating.
 *
 * `Sheet` kabi, mavjud `DialogOverlay` primitivi ustida quriladi
 * (focus-trap / Escape / scroll-lock / nested stack shu yerdan keladi).
 */
interface DialogProps {
  open?: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  zIndex?: number
  glowColor?: string
}

/** Sarlavha id'si — HAR dialog uchun unikal (nested modalda to'qnashmasin). */
const DialogTitleIdContext = React.createContext<string | undefined>(undefined)

function Dialog({ open = true, onClose, children, className, zIndex, glowColor: _glowColor }: DialogProps) {
  const titleId = React.useId()
  if (!open) return null
  return (
    <DialogTitleIdContext.Provider value={titleId}>
    <DialogOverlay onClose={onClose} labelId={titleId} position="bottom" swipeToDismiss zIndex={zIndex}>
      <div
        className={cn(
          'relative z-10 w-full max-w-lg mx-auto',
          'rounded-t-sheet bg-psurface shadow-2xl overflow-hidden',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200',
          'pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[88dvh] overflow-y-auto',
          className,
        )}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-t-sheet z-0">
          <ModalMathGrid glow={false} height={260} />
        </div>
        <div
          data-drag-handle
          aria-hidden="true"
          className="relative z-10 mx-auto mt-2.5 mb-1.5 h-1 w-10 rounded-full bg-plineStrong cursor-grab active:cursor-grabbing touch-none select-none"
        />
        {children}
      </div>
    </DialogOverlay>
    </DialogTitleIdContext.Provider>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col items-center justify-center gap-1 px-12 pt-1 pb-3 text-center relative z-10', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const titleId = React.useContext(DialogTitleIdContext)
  return (
    <h2
      id={titleId}
      className={cn('font-display text-[17px] font-bold tracking-tight text-pfg', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] text-pmuted leading-relaxed', className)} {...props} />
}

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-4 relative z-10', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2.5 px-5 pt-2 relative z-10', className)} {...props} />
}

function DialogClose({ onClose, label = 'Yopish', className }: { onClose: () => void; label?: string; className?: string }) {
  return (
    <ModalCloseButton onClick={onClose} label={label} className={className} />
  )
}

interface ConfirmDialogProps {
  open?: boolean
  title: string
  description?: string
  /** Tasdiq tugmasi matni — AMALNI ayting ("O'chirish"), "Ha" EMAS */
  confirmLabel: string
  cancelLabel: string
  /** Qaytarib bo'lmaydigan amal — tasdiq tugmasi destructive ko'rinishda */
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
  zIndex?: number
}

/**
 * Qaytarib bo'lmaydigan amallar uchun tasdiq oynasi (o'chirish, bekor qilish,
 * progressni tozalash). Tugma matni AMALNI aytadi — "Ha/Yo'q" emas: foydalanuvchi
 * sarlavhani o'qimasa ham nima bo'lishini biladi.
 */
function ConfirmDialog({
  open = true,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
  zIndex,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} zIndex={zIndex}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  ConfirmDialog,
}
