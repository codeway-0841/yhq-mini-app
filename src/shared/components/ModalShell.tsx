import * as React from 'react'
import DialogOverlay, { type CloseReason } from './DialogOverlay'
import ModalHeaderRow from './ModalHeaderRow'
import { cn } from '@/shared/lib/cn'

export interface ModalShellProps {
  /** Markazdagi sarlavha (17px, `font-display`) */
  title: React.ReactNode
  /** Sarlavha ostidagi bir qatorli izoh */
  subtitle?: React.ReactNode
  onClose: () => void
  closeLabel?: string
  children: React.ReactNode
  /** Pastda yopishib turuvchi blok (CTA, saqlash) */
  footer?: React.ReactNode
  /** Sarlavha id'si (default: avtomatik `useId`) */
  labelId?: string
  zIndex?: number
  /** Sarlavha ostidagi qo'shimcha qator (segment/tab) */
  headerExtra?: React.ReactNode
  /** Header o'ng tomoni (masalan ulashish tugmasi) */
  headerRight?: React.ReactNode
  /** Body default paddingini bekor qilish */
  bodyClassName?: string
  className?: string
  /** Drag/swipe bilan yopish (default: true) */
  swipeToDismiss?: boolean
  /** Gesture faqat drag-handle/header orqali */
  dragHandleOnly?: boolean
  closeOnBackdrop?: boolean
  canDismiss?: (reason: CloseReason) => boolean
  backdropClassName?: string
  /** Tortish dastagi (default: true) */
  showHandle?: boolean
  /**
   * Body o'zi scroll bo'lsin (default: true). `false` — chat/vosita kabi
   * ichki scroll va sticky input'li kontent uchun (body `flex-1 min-h-0`).
   */
  bodyScroll?: boolean
}

/**
 * ModalShell — BARCHA modal/sheet'lar uchun yagona qobiq (2026-10, "App Store
 * chek" referensi). Bir joyda beriladi:
 *
 *   ┌ [to'r fon]        grabber (36×4)                 ┐
 *   │ [dumaloq oq X]      SARLAVHA (17px)   [o'ng slot] │
 *   │  subtitle (13px muted)                           │
 *   ├──── scroll bo'ladigan body (px-5) ───────────────┤
 *   │  SpecCard / SpecHero / SpecAmount ...            │
 *   ├──── ixtiyoriy sticky footer ─────────────────────┤
 *
 * Geometriya global: `.dialog-sheet-motion > :first-child` 30px tepa radius,
 * `--safe-bottom` esa sirtda bir marta qo'shiladi (body'da TAKRORLANMAYDI).
 * Sirt har doim `bg-psurface` — oq `SpecCard` lar shu fonda "chek" bo'lib
 * ajralib turadi (`bg-pcard` sirt bilan kontrast yo'qoladi).
 */
export function ModalShell({
  title,
  subtitle,
  onClose,
  closeLabel = 'Yopish',
  children,
  footer,
  labelId,
  zIndex,
  headerExtra,
  headerRight,
  bodyClassName,
  className,
  swipeToDismiss = true,
  dragHandleOnly = false,
  closeOnBackdrop = true,
  canDismiss,
  backdropClassName,
  showHandle = true,
  bodyScroll = true,
}: ModalShellProps) {
  const generatedId = React.useId()
  const titleId = labelId ?? generatedId

  return (
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
          'relative z-10 mx-auto flex w-full max-w-lg flex-col overflow-hidden',
          'rounded-t-sheet bg-psurface shadow-2xl',
          'max-h-[88dvh] pb-[var(--safe-bottom,0px)]',
          className,
        )}
      >
        {showHandle ? (
          <div
            data-drag-handle
            aria-hidden="true"
            className="relative z-10 mx-auto mt-2.5 mb-1.5 h-1 w-10 flex-none cursor-grab touch-none select-none rounded-full bg-gray-300 active:cursor-grabbing dark:bg-white/20"
          />
        ) : null}

        <ModalHeaderRow onClose={onClose} label={closeLabel} right={headerRight}>
          <h2 id={titleId} className="text-balance font-display text-[17px] font-bold leading-snug tracking-tight text-pfg">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-[13px] leading-snug text-pmuted">{subtitle}</p> : null}
        </ModalHeaderRow>

        {headerExtra ? <div className="relative z-10 flex-none">{headerExtra}</div> : null}

        <div
          className={cn(
            'relative z-10 min-h-0 flex-1 px-5 pb-5',
            bodyScroll ? 'overflow-y-auto overscroll-contain' : 'flex flex-col',
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="relative z-10 flex-none border-t border-pline bg-psurface px-5 pb-4 pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </DialogOverlay>
  )
}

export default ModalShell
