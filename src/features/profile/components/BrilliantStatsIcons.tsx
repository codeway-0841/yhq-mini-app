import { cn } from '../../../shared/lib/cn'

/**
 * Brilliant Flame (Streak) Icon
 * Ikki qavatli olov shakli (tashqi apelsin-qizil gradient, ichki yorqin sariq)
 */
export function BrilliantFlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0 select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brilliantFlameOuter" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFA100" />
          <stop offset="60%" stopColor="#FF5722" />
          <stop offset="100%" stopColor="#E53935" />
        </linearGradient>
        <linearGradient id="brilliantFlameInner" x1="12" y1="9" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF176" />
          <stop offset="100%" stopColor="#FFA726" />
        </linearGradient>
      </defs>
      {/* Tashqi olov */}
      <path
        d="M12.2 2.2C10.1 5.3 7 7.9 7 12.8C7 16.5 9.7 19.8 13.5 19.8C16.8 19.8 19.5 17.1 19.5 13.8C19.5 9.5 15.6 5.8 12.2 2.2Z"
        fill="url(#brilliantFlameOuter)"
      />
      {/* Ichki olov tilchasi */}
      <path
        d="M13 10.2C12 11.9 10.5 13.5 10.5 15.3C10.5 16.9 11.8 18.2 13.5 18.2C15 18.2 16.2 17 16.2 15.5C16.2 13.5 14.5 11.8 13 10.2Z"
        fill="url(#brilliantFlameInner)"
      />
    </svg>
  )
}

/**
 * Brilliant XP (Sparkle/Diamond) Icon
 * 4 qirrali firuza-zumrad yulduzcha
 */
export function BrilliantXpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0 select-none', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brilliantXpGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="50%" stopColor="#00B0FF" />
          <stop offset="100%" stopColor="#0091EA" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"
        fill="url(#brilliantXpGrad)"
      />
      <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" fillOpacity="0.75" />
    </svg>
  )
}
