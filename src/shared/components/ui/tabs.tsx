import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI Tabs — segment boshqaruvi (surface ichida ko'tarilgan tanlov).
 * Active holat AKSENT RANG bilan emas, SIRT bilan beriladi — aksent
 * sahifadagi asosiy amalga qoladi.
 */
const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex w-full items-center gap-0.5 rounded-container border border-pline bg-psurface p-[3px]',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-[34px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3',
      'text-[13.5px] font-semibold text-pmuted',
      'transition-[background-color,color] duration-[120ms] ease-out',
      'hover:text-pfg',
      'data-[state=active]:bg-pcard data-[state=active]:text-pfg',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-1 focus-visible:ring-offset-psurface',
      'disabled:pointer-events-none disabled:opacity-50',
      '[&_svg]:size-4 [&_svg]:shrink-0',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
