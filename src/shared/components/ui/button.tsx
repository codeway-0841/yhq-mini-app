import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Button — Authentic Brilliant.org 1:1 Tactile 3D Button System.
 *
 * Brilliant dizayni:
 * - Bosganda element KICHRAYMAYDI (scale yo'q).
 * - Fizik bosiladi: active:translate-y-[2px] va 3D pastki soya tekislanadi.
 * - 30-gradusli dual-beam SVG nur to'lqini (sheen) silliq suzib o'tadi.
 * - To'liq yumaloq (rounded-full) shakl va no-shaffof mustahkam fon.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-bold select-none relative overflow-hidden',
    'transition-[transform,background-color,border-color,color,filter,box-shadow] duration-100 ease-out',
    'active:translate-y-[2px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    'disabled:pointer-events-none disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:     'bg-pprimary text-ponprimary shadow-[0_4px_0_0_rgba(0,0,0,0.22)] active:shadow-none hover:brightness-[1.06]',
        primary:     'bg-pprimary text-ponprimary shadow-[0_4px_0_0_rgba(0,0,0,0.22)] active:shadow-none hover:brightness-[1.06]',
        green:       'bg-[#29cc57] text-white shadow-[0_4px_0_0_#15b441] active:shadow-none hover:brightness-[1.06] [text-shadow:0_0_3px_rgba(0,0,0,0.25)]',
        blue:        'bg-[#456dff] text-white shadow-[0_4px_0_0_#375ce3] active:shadow-none hover:brightness-[1.06] [text-shadow:0_0_3px_rgba(0,0,0,0.25)]',
        purple:      'bg-[#9d62ff] text-white shadow-[0_4px_0_0_#874de5] active:shadow-none hover:brightness-[1.06] [text-shadow:0_0_3px_rgba(0,0,0,0.25)]',
        orange:      'bg-[#ff8d23] text-white shadow-[0_4px_0_0_#e77a16] active:shadow-none hover:brightness-[1.06] [text-shadow:0_0_3px_rgba(0,0,0,0.25)]',
        inverted:    'bg-[#383838] text-white shadow-[0_4px_0_0_#000000] dark:bg-[#f2f2f2] dark:text-[#141414] dark:shadow-[0_4px_0_0_#b3b3b3] active:shadow-none hover:brightness-[1.08] dark:hover:brightness-[0.95]',
        secondary:   'bg-pcard text-pfg border border-plineStrong shadow-[0_3px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_3px_0_0_rgba(255,255,255,0.08)] hover:bg-psurface active:shadow-none',
        outline:     'bg-transparent text-pfg border-2 border-plineStrong shadow-[0_2px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_0_0_rgba(255,255,255,0.06)] hover:bg-psurface active:shadow-none',
        ghost:       'bg-transparent text-pmuted hover:bg-psurface hover:text-pfg active:translate-y-0 shadow-none',
        destructive: 'bg-[rgb(var(--p-danger-rgb)/0.15)] text-pdanger border border-[rgb(var(--p-danger-rgb)/0.35)] shadow-[0_3px_0_0_rgba(var(--p-danger-rgb)/0.25)] hover:bg-[rgb(var(--p-danger-rgb)/0.22)] active:shadow-none',
        gold:        'bg-pprimary text-ponprimary shadow-[0_4px_0_0_rgba(0,0,0,0.22)] hover:brightness-[1.06] active:shadow-none',
        ai:          'bg-[#9d62ff] text-white shadow-[0_4px_0_0_#874de5] hover:brightness-[1.06] active:shadow-none [text-shadow:0_0_3px_rgba(0,0,0,0.25)]',
        link:        'bg-transparent text-pprimary underline-offset-4 hover:underline active:translate-y-0 shadow-none',
      },
      size: {
        sm:        'h-[36px] rounded-full px-4 text-[13.5px] [&_svg]:size-4',
        default:   'h-12 rounded-full px-6 text-[15.3px] [&_svg]:size-[18px]',
        lg:        'h-14 rounded-full px-7 text-[16.5px] [&_svg]:size-5',
        icon:      'h-12 w-12 rounded-full [&_svg]:size-[18px]',
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
  sheen?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, sheen, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const id1 = React.useId()
    const id2 = React.useId()

    // Sheen default: faqat asosiy rangli variantlarda (agar explicit sheen=false qilinmagan bo'lsa)
    const showSheen = !asChild && (sheen ?? (
      variant === 'default' ||
      variant === 'primary' ||
      variant === 'green' ||
      variant === 'gold'
    ))

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
            {showSheen && !disabled && !loading && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] select-none z-0"
              >
                <span className="absolute top-0 left-0 w-[150px] h-full animate-brilliant-sheen">
                  <svg viewBox="0 0 150 56" width="150" height="56" fill="none" className="h-full w-[150px]" aria-hidden="true">
                    <defs>
                      <linearGradient id={id1} x1="100.5" y1="-58.6328" x2="100.5" y2="91.3672" gradientUnits="userSpaceOnUse">
                        <stop offset="0.27" stopColor="#F5EFFF" />
                        <stop offset="0.71" stopColor="white" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id={id2} x1="140.826" y1="-28.1328" x2="140.826" y2="121.867" gradientUnits="userSpaceOnUse">
                        <stop offset="0.081302" stopColor="#F5EFFF" />
                        <stop offset="0.570844" stopColor="white" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <rect opacity="0.4" x="75" y="-58.6328" width="51" height="150" transform="rotate(30 75 -58.6328)" fill={`url(#${id1})`} />
                    <rect opacity="0.4" x="127.826" y="-28.1328" width="26" height="150" transform="rotate(30 127.826 -28.1328)" fill={`url(#${id2})`} />
                  </svg>
                </span>
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
