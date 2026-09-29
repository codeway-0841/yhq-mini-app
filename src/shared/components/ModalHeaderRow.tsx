import * as React from 'react'
import ModalCloseButton from './ModalCloseButton'
import { cn } from '../lib/cn'

export interface ModalHeaderRowProps {
  onClose: () => void
  label?: string
  className?: string
  /** X tugmasi stillarini bekor qilish (masalan Wonder brend ranglari) */
  closeClassName?: string
  /** Sarlavha bloki (h2 + ixtiyoriy subtitle) — o'rtada */
  children: React.ReactNode
  /** O'ng tomon (default: simmetriya uchun bo'sh spacer) */
  right?: React.ReactNode
}

/**
 * ModalHeaderRow — BARCHA modal/sheet header'larining YAGONA standarti
 * (Achievement uslubi: grabber ENG TEPADA alohida, pastda bir qatorda):
 *
 *   [dumaloq X | chapda]  [sarlavha | o'rtada]  [spacer/action | o'ngda]
 *
 * X — `ModalCloseButton` (in-flow: `relative left-auto top-auto`, 48px),
 * sarlavha — `flex-1 text-center`, o'ngda — X bilan bir xil o'lchamdagi
 * spacer (sarlavha ROSDAN markazda turishi uchun).
 */
export function ModalHeaderRow({
  onClose,
  label = 'Yopish',
  className,
  closeClassName,
  children,
  right,
}: ModalHeaderRowProps) {
  return (
    <div className={cn('relative z-10 flex min-h-14 items-center gap-2 px-5 pb-3', className)}>
      <ModalCloseButton
        onClick={onClose}
        label={label}
        className={cn('relative left-auto top-auto shrink-0', closeClassName)}
      />
      <div className="min-w-0 flex-1 text-center">{children}</div>
      {right ?? <span aria-hidden="true" className="size-12 shrink-0" />}
    </div>
  )
}

export default ModalHeaderRow
