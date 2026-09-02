import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/shared/lib/cn'

/**
 * DIQQAT — Telegram WebView asosan TOUCH: tooltip hover'siz ochilmaydi.
 * Muhim ma'lumotni FAQAT tooltip'ga qo'ymang (desktop/klaviatura uchun qo'shimcha).
 */
const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[60] overflow-hidden rounded-xl border border-pline bg-pcard px-2.5 py-1.5 shadow-md',
        'text-[12.5px] text-pfg shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)]',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
