import * as React from 'react'
import { cn } from '@/shared/lib/cn'

/** KIWI Textarea — Input bilan bir xil grammatika, min 88px balandlik. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[88px] w-full rounded-2xl border border-plineStrong bg-pcanvas px-[13px] py-2.5 text-base text-pfg shadow-xs',
        'transition-[border-color,box-shadow] duration-150 ease-out',
        'placeholder:text-psubtle',
        'focus:outline-none focus-visible:border-pprimary focus-visible:shadow-[0_0_0_3px_var(--p-wash)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-pdanger aria-[invalid=true]:focus-visible:border-pdanger',
        'aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_rgb(var(--p-danger-rgb)/0.16)]',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Textarea }
