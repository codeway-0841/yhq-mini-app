import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Button — Brilliant 1:1 Tactile 3D Style.
 *
 * Brilliant dizayni: bosganda element KICHRAYMAYDI (scale yo'q).
 * Buning o'rniga tugma fizik bosiladi (translateY(2px)) va pastki 3D soya tekislanadi.
 * Yaltiroq sheen nuri va to'liq yumaloq (rounded-full) shakl.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-bold select-none relative overflow-hidden',
    'transition-[transform,background-color,border-color,color,filter,box-shadow] duration-100 ease-out',
    'active:translate-y-[2px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    'disabled:pointer-events-none disabled:opacity-40 disabled:translate-y-0',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:     'bg-pprimary text-ponprimary shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] hover:brightness-[1.06] active:shadow-[inset_0_-2px_0_rgba(0,0,0,0.22)]',
        secondary:   'bg-pcard text-pfg border border-plineStrong shadow-[inset_0_-3px_0_rgba(0,0,0,0.08)] dark:shadow-[inset_0_-3px_0_rgba(255,255,255,0.08)] hover:bg-psurface active:shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] dark:active:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]',
        outline:     'bg-transparent text-pfg border border-plineStrong hover:bg-psurface active:translate-y-[1px]',
        ghost:       'bg-transparent text-pmuted hover:bg-psurface hover:text-pfg active:translate-y-0',
        destructive: 'bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger border border-[rgb(var(--p-danger-rgb)/0.35)] shadow-[inset_0_-3px_0_rgba(var(--p-danger-rgb)/0.25)] hover:bg-[rgb(var(--p-danger-rgb)/0.20)] active:shadow-[inset_0_-1px_0_rgba(var(--p-danger-rgb)/0.25)]',
        gold:        'bg-pprimary text-ponprimary shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] hover:brightness-[1.06] active:shadow-[inset_0_-2px_0_rgba(0,0,0,0.22)]',
        ai:          'bg-[rgb(var(--p-purple-rgb)/0.12)] text-ppurple border border-[rgb(var(--p-purple-rgb)/0.30)] shadow-[inset_0_-3px_0_rgba(var(--p-purple-rgb)/0.2)] hover:bg-[rgb(var(--p-purple-rgb)/0.20)] active:shadow-[inset_0_-1px_0_rgba(var(--p-purple-rgb)/0.2)]',
        link:        'bg-transparent text-pprimary underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        sm:        'h-[36px] rounded-full px-4 text-[13.5px] [&_svg]:size-4 shadow-2xs',
        default:   'h-11 rounded-full px-5 text-[15px] [&_svg]:size-[18px] shadow-sm',
        lg:        'h-14 rounded-full px-6 text-[17px] [&_svg]:size-5 shadow-sm',
        icon:      'h-11 w-11 rounded-full [&_svg]:size-[18px]',
        'icon-sm': 'h-[36px] w-[36px] rounded-full [&_svg]:size-4',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'default', size: 'default', block: false },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const showSheen = !asChild && (!variant || variant === 'default' || variant === 'gold')

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {showSheen && (
              <span
                aria-hidden="true"
                className="brilliant-start-sheen pointer-events-none absolute inset-y-0 left-0 w-full select-none"
              >
                <span className="absolute inset-y-0 left-[56%] w-[13%] -skew-x-[28deg] bg-white/25" />
                <span className="absolute inset-y-0 left-[72%] w-[4%] -skew-x-[28deg] bg-white/25" />
              </span>
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Spinner />
                  {children}
                </>
              ) : (
                children
              )}
            </span>
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
    />
  )
}

export { Button, buttonVariants }
