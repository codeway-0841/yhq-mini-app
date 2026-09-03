import * as React from 'react'
import { X } from 'lucide-react'
import DialogOverlay from '../DialogOverlay'
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
}

/** Sarlavha id'si — HAR dialog uchun unikal (nested modalda to'qnashmasin). */
const DialogTitleIdContext = React.createContext<string | undefined>(undefined)

function Dialog({ open = true, onClose, children, className, zIndex }: DialogProps) {
  const titleId = React.useId()
  if (!open) return null
  return (
    <DialogTitleIdContext.Provider value={titleId}>
    <DialogOverlay onClose={onClose} labelId={titleId} position="center" zIndex={zIndex}>
      <div
        className={cn(
          'relative z-10 w-full max-w-sm',
          'rounded-3xl bg-pcard shadow-2xl',
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200',
          'max-h-[85dvh] overflow-y-auto',
          className,
        )}
      >
        {children}
      </div>
    </DialogOverlay>
    </DialogTitleIdContext.Provider>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-3', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const titleId = React.useContext(DialogTitleIdContext)
  return (
    <h2
      id={titleId}
      className={cn('font-display text-[17px] font-semibold tracking-[-0.015em] text-pfg', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13.5px] text-pmuted', className)} {...props} />
}

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-4', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 p-5 pt-1 sm:flex-row sm:justify-end', className)} {...props} />
}

function DialogClose({ onClose, label = 'Yopish' }: { onClose: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className={cn(
        'absolute right-2 top-2 grid size-11 place-items-center rounded-xl text-pmuted',
        'transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
      )}
    >
      <X className="size-[18px]" />
    </button>
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
