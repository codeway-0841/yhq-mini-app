import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Alert — sahifa ichidagi doimiy xabar (Toast'dan farqli: o'z-o'zidan yo'qolmaydi).
 * Chapdan rangli chiziq YO'Q — status rangi ikonka va hairline'da beriladi,
 * shuning uchun karta grammatikasi buzilmaydi.
 */
const alertVariants = cva('flex gap-3 rounded-control border p-[13px_15px] text-sm', {
  variants: {
    variant: {
      default: 'bg-psurface border-plineStrong text-pfg',
      info:    'bg-[rgb(var(--p-purple-rgb)/0.09)] border-[rgb(var(--p-purple-rgb)/0.30)] text-pfg',
      success: 'bg-[rgb(var(--p-success-rgb)/0.09)] border-[rgb(var(--p-success-rgb)/0.30)] text-pfg',
      warning: 'bg-[rgb(var(--p-warning-rgb)/0.09)] border-[rgb(var(--p-warning-rgb)/0.30)] text-pfg',
      danger:  'bg-[rgb(var(--p-danger-rgb)/0.09)] border-[rgb(var(--p-danger-rgb)/0.30)] text-pfg',
    },
  },
  defaultVariants: { variant: 'default' },
})

const ICONS = {
  default: Info,
  info:    Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger:  XCircle,
} as const

const ICON_TONE = {
  default: 'text-pmuted',
  info:    'text-ppurple',
  success: 'text-psuccess',
  warning: 'text-pwarning',
  danger:  'text-pdanger',
} as const

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** `false` — ikonkasiz (matn o'zi yetarli bo'lsa) */
  icon?: boolean
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', icon = true, children, ...props }, ref) => {
    const key = variant ?? 'default'
    const Icon = ICONS[key]
    return (
      <div
        ref={ref}
        role={key === 'danger' ? 'alert' : 'status'}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {icon && <Icon aria-hidden="true" className={cn('mt-px size-[18px] shrink-0', ICON_TONE[key])} />}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  },
)
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('mb-0.5 text-sm font-semibold text-pfg', className)} {...props} />
  ),
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-[13.5px] text-pmuted', className)} {...props} />
  ),
)
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription, alertVariants }
