import { memo } from 'react'
import { cn } from '../../../shared/lib/cn'

/**
 * Brilliant.org ning original chaqmoq (Streak) ikonasi
 * Brilliant'ning o'z SVG path vektori:
 * M1.27498 12.516L10.1761 1.31828C10.7098 0.646883 11.7966 1.11739 11.6606 1.96094L10.3758 9.92921H15.8888C16.9368 9.92921 17.5236 11.1248 16.8757 11.94L7.97457 23.1377C7.44087 23.8091 6.35401 23.3386 6.49003 22.495L7.7748 14.5268H2.26186C1.21381 14.5268 0.62701 13.3312 1.27498 12.516Z
 */
export const BrilliantStreakIcon = memo(function BrilliantStreakIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0 select-none text-[#A8D31D]', className)}
      aria-hidden="true"
    >
      <path
        d="M1.27498 12.516L10.1761 1.31828C10.7098 0.646883 11.7966 1.11739 11.6606 1.96094L10.3758 9.92921H15.8888C16.9368 9.92921 17.5236 11.1248 16.8757 11.94L7.97457 23.1377C7.44087 23.8091 6.35401 23.3386 6.49003 22.495L7.7748 14.5268H2.26186C1.21381 14.5268 0.62701 13.3312 1.27498 12.516Z"
        fill="currentColor"
      />
    </svg>
  )
})

/**
 * Brilliant.org ning original 4 qirrali zumrad yulduzcha (XP Sparkle) ikonasi
 * Rasmga mos: kattaligi Streak chaqmog'i bilan teng (size-5), to'qroq zumrad (#00A86B / #059669)
 */
export const BrilliantXpIcon = memo(function BrilliantXpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0 select-none text-[#00A86B]', className)}
      aria-hidden="true"
    >
      {/* Asosiy 4 qirrali yulduz */}
      <path
        d="M10 2C10.2 6.4 13.6 9.8 18 10C13.6 10.2 10.2 13.6 10 18C9.8 13.6 6.4 10.2 2 10C6.4 9.8 9.8 6.4 10 2Z"
        fill="currentColor"
      />
      {/* Yuqori o'ng burchakdagi kichik uchqun */}
      <path
        d="M16 1.5C16.1 2.8 17.2 3.9 18.5 4C17.2 4.1 16.1 5.2 16 6.5C15.9 5.2 14.8 4.1 13.5 4C14.8 3.9 15.9 2.8 16 1.5Z"
        fill="currentColor"
      />
    </svg>
  )
})
