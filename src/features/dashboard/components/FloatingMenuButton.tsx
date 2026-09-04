import { LayoutGrid } from 'lucide-react'
import { haptics } from '../../../platform/haptics'

export interface FloatingMenuButtonProps {
  onClick: () => void
  open?: boolean
  hidden?: boolean
  label?: string
  className?: string
}

/**
 * KIVVI Dashboard Floating Menu Button.
 *
 * 56x56px premium utility control:
 * - Glassmorphic surface (light/dark adaptiv)
 * - 18px squircle burchak radiusi
 * - 24px LayoutGrid icon
 * - Taktil tebranish (haptics.selection)
 * - Scroll paytida yumshoq yashirinish/ko'rinish
 * - Accessibility (aria-label, aria-expanded, aria-haspopup)
 */
export default function FloatingMenuButton({
  onClick,
  open = false,
  hidden = false,
  label = 'Menyu',
  className = '',
}: FloatingMenuButtonProps) {
  const handlePointerDown = () => {
    haptics.selection()
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      className={`floating-menu-btn pointer-events-auto grid size-14 place-items-center rounded-[18px] bg-white/90 dark:bg-[#181E26]/90 text-slate-800 dark:text-white border border-black/[0.08] dark:border-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-[18px] transition-all duration-200 ease-out motion-safe:active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas ${
        hidden
          ? 'translate-y-5 opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100 pointer-events-auto'
      } ${className}`.trim()}
    >
      <LayoutGrid size={24} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
