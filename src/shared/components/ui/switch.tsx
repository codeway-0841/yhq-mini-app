import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/shared/lib/cn'

/** KIWI Switch — 44×26, thumb 20px. Yoqilganda aksent (holat = aksent qoidasi). */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5',
      'transition-colors duration-[120ms] ease-out',
      'border-plineStrong bg-psurface',
      'data-[state=checked]:border-pprimary data-[state=checked]:bg-pprimary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-5 rounded-full bg-pcard border border-plineStrong',
        'transition-transform duration-[160ms] ease-out',
        'data-[state=checked]:translate-x-[18px] data-[state=checked]:border-transparent',
        'data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
