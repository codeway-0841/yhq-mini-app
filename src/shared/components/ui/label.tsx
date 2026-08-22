import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/shared/lib/cn'

/** Forma yorlig'i — 13px, muted. Har input uchun MAJBURIY (a11y). */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-[13px] font-semibold text-pmuted',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
      className,
    )}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

/** Input ostidagi izoh yoki xato matni. `tone="error"` — pdanger + ikonka joyi. */
function FieldHint({
  tone = 'muted',
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone?: 'muted' | 'error' }) {
  return (
    <p
      className={cn(
        'text-[12.5px]',
        tone === 'error' ? 'text-pdanger' : 'text-psubtle',
        className,
      )}
      {...props}
    />
  )
}

/** Label + control + hint uchun vertikal guruh (gap bilan, margin EMAS). */
function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-[7px]', className)} {...props} />
}

export { Label, Field, FieldHint }
