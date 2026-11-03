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
 * Katta 4 burchakli yulduz va tepasida kichik yordamchi uchqun.
 */
export const BrilliantXpIcon = memo(function BrilliantXpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0 select-none text-[#10B981]', className)}
      aria-hidden="true"
    >
      {/* Asosiy 4 qirrali yulduz */}
      <path
        d="M10 3C10.2 7.4 13.6 10.8 18 11C13.6 11.2 10.2 14.6 10 19C9.8 14.6 6.4 11.2 2 11C6.4 10.8 9.8 7.4 10 3Z"
        fill="currentColor"
      />
      {/* Yuqori o'ng burchakdagi kichik uchqun */}
      <path
        d="M19 2C19.1 3.5 20.5 4.9 22 5C20.5 5.1 19.1 6.5 19 8C18.9 6.5 17.5 5.1 16 5C17.5 4.9 18.9 3.5 19 2Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  )
})
