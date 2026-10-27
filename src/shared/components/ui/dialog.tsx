import * as React from 'react'
import DialogOverlay from '../DialogOverlay'
import ModalCloseButton from '../ModalCloseButton'
import ModalHeaderRow from '../ModalHeaderRow'
import { Button } from './button'
import { ConfirmMascot, type ConfirmMascotEmotion } from './confirm-mascot'
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
          'pb-[calc(1.75rem+var(--safe-bottom,0px))] max-h-[88dvh] overflow-y-auto',
          className,
        )}
      >
        <div
          data-drag-handle
          aria-hidden="true"
          className="relative z-10 mx-auto mt-2.5 mb-1.5 h-1 w-10 rounded-full bg-gray-300 dark:bg-white/20 cursor-grab active:cursor-grabbing touch-none select-none"
        />
        {children}
      </div>
    </DialogOverlay>
    </DialogTitleIdContext.Provider>
  )
}

function DialogHeader({
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
  return <div className={cn('flex flex-col items-center justify-center gap-1 px-12 pt-1 pb-3 text-center relative z-10', className)} {...props}>{children}</div>
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
  /** 3D LED-ko'zli maskot holati (`false` berilsa maskot yashiriladi) */
  mascot?: boolean | ConfirmMascotEmotion
  /** Tugmalar ustidagi qo'shimcha blok (masalan checkbox yoki izoh) */
  children?: React.ReactNode
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
  mascot = true,
  children,
  loading = false,
  onConfirm,
  onClose,
  zIndex,
}: ConfirmDialogProps) {
  const mascotEmotion: ConfirmMascotEmotion | null =
    mascot === false
      ? null
      : mascot === true
        ? destructive
          ? 'danger'
          : 'question'
        : mascot

  if (!mascotEmotion) {
    return (
      <Dialog open={open} onClose={onClose} zIndex={zIndex}>
        <DialogHeader onClose={onClose}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <DialogBody>{children}</DialogBody>}
        <DialogFooter className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      zIndex={zIndex}
      className="bg-[#050308] text-white shadow-2xl pb-[calc(1rem+var(--safe-bottom,0px))]"
    >
      {/* Markaziy yirik uppercase sarlavha va izoh (videodagi 1:1 tipografiya) */}
      <div className="relative z-20 px-6 pt-3 pb-1 text-center">
        <DialogTitle className="mx-auto max-w-[20ch] text-balance font-display text-[22px] font-black uppercase leading-[1.08] tracking-[-0.02em] text-white sm:text-[24px]">
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription className="mx-auto mt-2.5 max-w-[30ch] text-balance text-[13px] font-normal leading-snug text-white/55">
            {description}
          </DialogDescription>
        )}
      </div>

      {/* 3D Matte-Binafsha Robot Maskot + Pastki Floating Action Karta */}
      <div className="relative mt-1 flex flex-col items-center">
        <ConfirmMascot
          emotion={mascotEmotion}
          className="-mb-24 w-full max-w-[440px] pointer-events-none"
        />

        {/* Maskot ko'ksida suzib turuvchi qora boshqaruv bloki (floating dock) */}
        <div className="relative z-20 mx-3.5 mb-1.5 w-[calc(100%-1.75rem)] rounded-3xl bg-[#07050c] p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.85)]">
          {children ? (
            <div className="mb-3 px-1 text-left text-[12.5px] text-white/80">
              {children}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-12 items-center justify-center rounded-full bg-[#1e1d24] px-4 font-mono text-[13px] font-bold uppercase tracking-[0.06em] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all hover:bg-[#282730] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {cancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="group relative flex h-12 items-center justify-between rounded-full bg-white pl-5 pr-1.5 font-mono text-[13px] font-bold uppercase tracking-[0.05em] text-[#09070e] shadow-md transition-all hover:brightness-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              <span className="truncate pr-2">{confirmLabel}</span>
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[#09070e] text-white"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="3" r="1.25" fill="currentColor" />
                  <circle cx="7" cy="11" r="1.25" fill="currentColor" />
                  <circle cx="3" cy="7" r="1.25" fill="currentColor" />
                  <circle cx="11" cy="7" r="1.25" fill="currentColor" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
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
  ConfirmMascot,
}
