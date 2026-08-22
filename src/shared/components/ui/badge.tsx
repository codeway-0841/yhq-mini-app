import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Badge — 24px balandlik, 7px radius (boshqaruvdan kichikroq bosqich).
 * Semantik variantlar AKSENTDAN ALOHIDA: `accent` faqat mahsulot holati
 * (Premium, joriy fan) uchun, `success/warning/danger` — javob/status uchun.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[7px] text-[12px] font-semibold border whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-psurface text-pmuted border-plineStrong',
        accent:  'bg-pwash text-pprimary border-[rgb(var(--p-primary-rgb)/0.26)]',
        success: 'bg-[rgb(var(--p-success-rgb)/0.12)] text-psuccess border-[rgb(var(--p-success-rgb)/0.26)]',
        warning: 'bg-[rgb(var(--p-warning-rgb)/0.12)] text-pwarning border-[rgb(var(--p-warning-rgb)/0.26)]',
        danger:  'bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger border-[rgb(var(--p-danger-rgb)/0.26)]',
        gold:    'bg-[rgb(var(--p-gold-rgb)/0.12)] text-pgold border-[rgb(var(--p-gold-rgb)/0.26)]',
        outline: 'bg-transparent text-pmuted border-plineStrong',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
