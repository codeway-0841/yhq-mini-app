import * as React from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Input — 44px touch balandligi, 10px radius, hairline border.
 * Fokus: aksent border + 3px yumshoq halqa (kontur "sakramaydi" — layout shift yo'q).
 * Xato holati `aria-invalid` orqali beriladi (alohida prop emas) — screen reader
 * va vizual holat bitta manbadan keladi.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-control border border-plineStrong bg-pcanvas px-[13px] text-[15px] text-pfg',
        'transition-[border-color,box-shadow] duration-[120ms] ease-out',
        'placeholder:text-psubtle',
        'focus:outline-none focus:border-pprimary focus:shadow-[0_0_0_3px_var(--p-wash)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-pdanger aria-[invalid=true]:focus:border-pdanger',
        'aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(var(--p-danger-rgb)/0.16)]',
        // Sonli maydonlarda strelkalarni yashirish (taymer/ball kiritish toza ko'rinsin)
        '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
