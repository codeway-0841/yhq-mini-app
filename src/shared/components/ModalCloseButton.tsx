import { X } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ModalCloseButtonProps {
  onClick: () => void
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * ModalCloseButton — Achievement-uslubidagi dumaloq X tugmasi (SSOT):
 * oq fonli doira (dark'da white/10), nafis soya, ingichka border,
 * o'rtadagi 20px X. Barcha modal/sheet'lar SHU tugmadan foydalanadi.
 */
export function ModalCloseButton({
  onClick,
  label = 'Yopish',
  className,
  size = 'md',
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute left-3.5 top-3 z-30 flex items-center justify-center rounded-full',
        'bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04]',
        'dark:bg-white/10 dark:text-white dark:border-white/10 dark:shadow-none',
        'transition-transform duration-150 ease-out hover:scale-105 active:scale-95 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
        size === 'md' ? 'size-12' : 'size-9',
        className,
      )}
    >
      <X className={size === 'md' ? 'size-5' : 'size-4'} strokeWidth={2.25} />
    </button>
  )
}

export default ModalCloseButton
