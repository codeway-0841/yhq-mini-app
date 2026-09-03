import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Progress — 3px ingichka rail + yonida tabular raqam.
 * Duolingo'ning yo'g'on kapsulasi emas: progress kontentni bosmasligi kerak.
 *
 * `label` berilsa (masalan "18 / 25" yoki "34%") o'ng tomonda ko'rsatiladi va
 * a11y uchun `aria-valuetext` ga ham yoziladi.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { label?: string }
>(({ className, value, label, ...props }, ref) => {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="flex items-center gap-3">
      <ProgressPrimitive.Root
        ref={ref}
        value={value}
        aria-valuetext={label}
        className={cn('relative h-[3px] w-full overflow-hidden rounded-[2px] bg-plineStrong', className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className="h-full rounded-[2px] bg-pprimary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </ProgressPrimitive.Root>
      {label && (
        <span className="min-w-[52px] shrink-0 text-right text-[13px] font-semibold text-pmuted">
          {label}
        </span>
      )}
    </div>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

interface SegmentedRingProps {
  /** Segmentlar soni — har biri bitta mavzu/dars */
  total: number
  /** Nechtasi tugallangan */
  done: number
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
  'aria-label'?: string
}

/**
 * KIWI SegmentedRing — uzluksiz halqa EMAS: har segment bitta mavzuni bildiradi,
 * shuning uchun "qancha qoldi" bir qarashda o'qiladi. Bu KIWI progress imzosi.
 */
function SegmentedRing({
  total,
  done,
  size = 104,
  strokeWidth = 7,
  className,
  children,
  'aria-label': ariaLabel,
}: SegmentedRingProps) {
  const count = Math.max(1, total)
  const filled = Math.max(0, Math.min(count, done))
  // viewBox 104×104 → markaz 52. Radius stroke qalinligi va 2px chekka bilan hisoblanadi.
  const r = 52 - strokeWidth / 2 - 2
  const circumference = 2 * Math.PI * r
  const slot = circumference / count
  const gap = count > 1 ? Math.min(6, slot * 0.18) : 0
  const dash = slot - gap

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 104 104"
        className="-rotate-90"
        role="img"
        aria-label={ariaLabel ?? `${total} dan ${done} tasi tugallandi`}
      >
        <g fill="none" strokeWidth={strokeWidth}>
          {Array.from({ length: count }, (_, i) => (
            <circle
              key={i}
              cx="52"
              cy="52"
              r={r}
              className={i < filled ? 'stroke-pprimary' : 'stroke-plineStrong'}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-i * slot}
            />
          ))}
        </g>
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">{children}</div>
      )}
    </div>
  )
}

export { Progress, SegmentedRing }
