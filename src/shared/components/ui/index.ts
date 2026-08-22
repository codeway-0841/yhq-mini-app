/**
 * KIWI UI primitivlari — "Jade & Stone" dizayn tizimi.
 *
 * shadcn/ui TEXNIK poydevor sifatida ishlatiladi (Radix a11y + cva variantlar),
 * lekin stil to'liq KIWI: token, geometriya, proporsiya va harakat
 * `src/index.css` dagi --p-* tokenlaridan keladi.
 *
 * Qoidalar:
 *  - Aksent (pprimary) FAQAT asosiy CTA, progress fill va active holat uchun.
 *  - Ikonka rangi neytral (pmuted); status rangi semantik tokenlardan.
 *  - Boshqaruv balandligi 44px, radius 10px; konteyner radiusi 18px; sheet 24px.
 *  - Bosish javobi: scale(.98) 120ms. Qattiq soya / translateY YO'Q.
 */
export { Button, buttonVariants, type ButtonProps } from './button'
export { Input } from './input'
export { Textarea } from './textarea'
export { Label, Field, FieldHint } from './label'
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'
export { Badge, badgeVariants, type BadgeProps } from './badge'
export { Alert, AlertTitle, AlertDescription, alertVariants, type AlertProps } from './alert'
export { Skeleton, SkeletonRow, SkeletonCard } from './skeleton'
export { Progress, SegmentedRing } from './progress'
export { Switch } from './switch'
export { Separator } from './separator'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
export { Avatar, AvatarImage, AvatarFallback } from './avatar'
export { ScrollArea, ScrollBar } from './scroll-area'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'
export { EmptyState } from './empty-state'
export {
  Sheet, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose,
} from './sheet'
export {
  Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  DialogClose, ConfirmDialog,
} from './dialog'
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuRadioGroup,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
} from './dropdown-menu'
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel,
  SelectItem, SelectSeparator,
} from './select'
