import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Button — "Jade & Stone" v3.
 *
 * Duolingo 3D tugmasidan farqi: qattiq pastki soya va `translateY` YO'Q.
 * Bosish javobi — `scale(.98)` 120ms + haptics (call-site'da).
 * Balandlik 44px (touch target), radius 10px (boshqaruv bosqichi).
 *
 * Aksent (`default`) FAQAT sahifadagi asosiy amal uchun. Ikkilamchi amallar —
 * `secondary` yoki `ghost`; aksentni ko'p ishlatish uni ma'nosiz qiladi.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold select-none',
    'transition-[transform,background-color,border-color,color,filter] duration-[120ms] ease-out',
    'active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    'disabled:pointer-events-none disabled:opacity-40',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:     'bg-pprimary text-ponprimary hover:brightness-[1.06]',
        secondary:   'bg-psurface text-pfg border border-plineStrong hover:bg-pcard',
        outline:     'bg-transparent text-pfg border border-plineStrong hover:bg-psurface',
        ghost:       'bg-transparent text-pmuted hover:bg-psurface hover:text-pfg',
        // Diqqat: --p-* CSS o'zgaruvchilar HEX saqlaydi, shuning uchun Tailwind
        // opacity modifier (`bg-pdanger/10`) ISHLAMAYDI — rgb triplet ishlatiladi.
        destructive: 'bg-transparent text-pdanger border border-[rgb(var(--p-danger-rgb)/0.35)] hover:bg-[rgb(var(--p-danger-rgb)/0.10)]',
        /** Premium obuna CTA — mavzu aksentiga (pprimary) moslashadi */
        gold:        'bg-pprimary text-ponprimary hover:brightness-[1.06]',
        /** AI amallari — purple wash (aksentdan alohida signal) */
        ai:          'bg-[rgb(var(--p-purple-rgb)/0.12)] text-ppurple border border-[rgb(var(--p-purple-rgb)/0.30)] hover:bg-[rgb(var(--p-purple-rgb)/0.20)]',
        link:        'bg-transparent text-pprimary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        sm:      'h-[34px] rounded-control px-3 text-[13.5px] [&_svg]:size-4',
        default: 'h-11 rounded-control px-[18px] text-[15px] [&_svg]:size-[18px]',
        lg:      'h-[52px] rounded-control px-6 text-base [&_svg]:size-5',
        icon:    'h-11 w-11 rounded-control [&_svg]:size-[18px]',
        'icon-sm': 'h-[34px] w-[34px] rounded-control [&_svg]:size-4',
      },
      /** Blok tugma — sahifa pastidagi asosiy CTA uchun */
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'default', size: 'default', block: false },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Yuklanish holati — spinner ko'rsatadi va tugmani bloklaydi */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Spinner />
            {children}
          </>
        ) : (
          children
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
