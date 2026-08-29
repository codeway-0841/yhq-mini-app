import React, { memo } from 'react'

export interface CoinIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
}

/**
 * Tangalar (Coin Stack) ikonkasi — brend tanga ustunlari SVG ikonkasi.
 * Lucide `Coins` o'rniga YHQ platformasi bo'ylab yagona tanga vizuali.
 */
export const CoinIcon = memo(function CoinIcon({
  size = 16,
  className = '',
  style,
  ...props
}: CoinIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      <g fill="none">
        {/* Tanga tanasining engil foni */}
        <path
          fill="currentColor"
          fillOpacity="0.18"
          d="M20 9.5h-5l-2.5 1.429V5.5L9 3.5H4l-3.5 2v15l3.5 2h5l3-1.714l3 1.714h5l3.5-2v-9z"
        />
        {/* Soyali qirrasi */}
        <path
          fill="currentColor"
          fillOpacity="0.32"
          d="M6.5 22.5H9l2.999-1.714l-.499-.286v-9l1-.572V5.5L9 7.5H6.5zm11 0H20l3.5-2v-9l-3.5 2h-2.5z"
        />
        {/* Tanga ustunlari qirralari va konturi */}
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12.5 8.5v-3L9 7.5H4l-3.5-2v15"
        />
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m12.5 8.5l-3.5 2H4l-3.5-2m8.975 4.729L9 13.5H4l-3.5-2m8.975 4.729L9 16.5H4l-3.5-2m8.975 4.729L9 19.5H4l-3.5-2m8.975 4.729L9 22.5H4l-3.5-2m0-15l3.5-2h5l3.5 2m11 15v-9l-3.5 2h-5l-3.5-2v9"
        />
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m23.5 14.5l-3.5 2h-5l-3.5-2m12 3l-3.5 2h-5l-3.5-2m12 3l-3.5 2h-5l-3.5-2m0-9l3.5-2h5l3.5 2m-5-10v1m0 4v1m3-3h-1m-4 0h-1"
        />
      </g>
    </svg>
  )
})

export default CoinIcon
