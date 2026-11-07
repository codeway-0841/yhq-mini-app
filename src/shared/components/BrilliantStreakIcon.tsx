import { memo, type SVGProps } from 'react'
import { cn } from '../lib/cn'

export interface BrilliantStreakIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
}

/**
 * Brilliant.org ning original chaqmoq (Streak Lightning Bolt) ikonasi.
 * SSOT komponent — ilova bo'ylab barcha streak/seriya joylarida olov o'rniga ishlatiladi.
 */
export const BrilliantStreakIcon = memo(function BrilliantStreakIcon({
  size = 20,
  className,
  style,
  ...props
}: BrilliantStreakIconProps) {
  const pixelSize = typeof size === 'number' ? `${size}px` : size
  return (
    <svg
      viewBox="0 0 18 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: pixelSize, height: pixelSize, ...style }}
      className={cn('shrink-0 select-none text-[#A8D31D]', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M1.27498 12.516L10.1761 1.31828C10.7098 0.646883 11.7966 1.11739 11.6606 1.96094L10.3758 9.92921H15.8888C16.9368 9.92921 17.5236 11.1248 16.8757 11.94L7.97457 23.1377C7.44087 23.8091 6.35401 23.3386 6.49003 22.495L7.7748 14.5268H2.26186C1.21381 14.5268 0.62701 13.3312 1.27498 12.516Z"
        fill="currentColor"
      />
    </svg>
  )
})

export default BrilliantStreakIcon
