import * as React from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Skeleton — kontent shakliga MOS placeholder (bir xil kulrang blok emas).
 * `motion-safe:` — `prefers-reduced-motion` da sweep to'xtaydi, blok qoladi.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-[7px] bg-pline',
        // `after:content-['']` SHART — busiz pseudo-element umuman chizilmaydi.
        // Keyframes `brand-sweep` src/index.css da.
        "motion-safe:after:content-[''] motion-safe:after:absolute motion-safe:after:inset-0",
        'motion-safe:after:animate-[brand-sweep_1.5s_cubic-bezier(0.2,0,0,1)_infinite]',
        'motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-plineStrong motion-safe:after:to-transparent',
        className,
      )}
      {...props}
    />
  )
}

/** Ro'yxat elementi uchun tayyor skelet (avatar + ikki qator). */
function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton className="size-9 rounded-[12px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-[11px] w-[58%]" />
        <Skeleton className="h-[9px] w-[38%]" />
      </div>
    </div>
  )
}

/** Karta o'lchamidagi skelet. */
function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn('h-14 rounded-container', className)} />
}

export { Skeleton, SkeletonRow, SkeletonCard }
