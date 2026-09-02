import * as React from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Card — konteyner bosqichi (18px radius), sirt + 1px hairline.
 * SOYA YO'Q: ko'tarilish sirt ierarxiyasi bilan beriladi
 * (canvas → card → surface). Soya faqat suzuvchi qatlamda (Sheet/Dialog/Toast).
 *
 * `interactive` — bosiladigan karta (butun karta havola/tugma bo'lsa):
 * hover'da hairline kuchayadi, bosilganda scale(.99).
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-2xl bg-pcard shadow-xs',
      interactive && [
        'cursor-pointer transition-[border-color,transform,background-color] duration-[120ms] ease-out',
        'hover:bg-psurface active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
      ],
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 p-4', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-display text-[15px] font-semibold leading-tight tracking-[-0.012em] text-pfg', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-[13px] text-pmuted', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
