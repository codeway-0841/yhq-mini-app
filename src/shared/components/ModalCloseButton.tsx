import { X } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ModalCloseButtonProps {
  onClick: () => void
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * ModalCloseButton — Apple / Craft / iOS style suzuvchi dumaloq X tugmasi
 * (oq fonli doira, nafis soya va o'rtaga joylashgan to'q X ikonka).
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
        'absolute z-30 flex items-center justify-center rounded-full',
        'bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.06]',
        'dark:bg-[#1E2530] dark:text-white dark:border-white/10 dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
        'transition-all duration-150 ease-out hover:scale-105 active:scale-95 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
        size === 'md' ? 'left-3.5 top-3 size-9' : 'left-3 top-2.5 size-8',
        className,
      )}
    >
      <X className={size === 'md' ? 'size-4' : 'size-3.5'} strokeWidth={2.4} />
    </button>
  )
}

export default ModalCloseButton
