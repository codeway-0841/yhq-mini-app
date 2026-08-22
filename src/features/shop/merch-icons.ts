import { Tag, ShoppingBag, Shirt, Package, type LucideIcon } from 'lucide-react'

/**
 * Merch id → lucide ikonka (v3: emoji o'rniga).
 *
 * NEGA BU YERDA: `shared/merch-items.ts` — server ham o'qiydigan kontrakt
 * (narx, zaxira, buyurtma validatsiyasi), unga React/lucide bog'liqligi
 * kiritilmaydi. Bu sof UI mapping — `subjects.tsx` UI_MAP naqshi.
 *
 * `image` maydoni to'ldirilgan mahsulot uchun rasm ustunroq; ikonka faqat
 * rasm bo'lmaganda ishlatiladi. Yangi mahsulotda `Package` fallback.
 */
const MERCH_ICONS: Record<string, LucideIcon> = {
  nakleyka: Tag,
  sumka:    ShoppingBag,
  kiyim:    Shirt,
}

export function getMerchIcon(id: string): LucideIcon {
  return MERCH_ICONS[id] ?? Package
}
