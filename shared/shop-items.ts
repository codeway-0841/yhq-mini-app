/**
 * DO'KON KATALOGI (FIXPLAN #40) — YAGONA MANBA (frontend + server ikkalasi import qiladi).
 *
 * Tanga (coin) bilan sotib olinadigan barcha buyumlar shu yerda.
 * Server narxlarni FAQAT shu yer'dan oladi (client'dan hech qachon ishonmaydi —
 * scoring trust boundary kabi: balans/debit faqat server'da).
 *
 * QOIDALAR:
 * - `id` katalog bo'yicha UNIKAL — u user_items/coin_transactions jadvallariga
 *   yoziladi (durable buyumlarda `id` = egalik kaliti).
 * - `accent-theme` uchun `id` === tema id (`src/shared/config/themes.ts` ACCENT_THEMES).
 *   Tema premium + coin'li bo'lishi mumkin (premium=tariff yo'li, coin=do'kon yo'li)
 *   yoki coin-eksklyuziv (premium:false) — desync'ni
 *   tests/unit/config/shop-items.test.ts ushlaydi.
 * - `avatar-frame` uchun `id` === ramka id (`src/shared/config/avatar-frames.ts`).
 * - `premium-days` — consumable: user_items'ga YOZILMAYDI, `premium_until`ga
 *   qo'shiladi (C-1: muddatli grant tariff'ga TEGMAYDI). `days` majburiy.
 * - Narxlar: sekin iqtisod (1 coin/to'g'ri javob, ~80c/kun faol o'yinchi).
 *   Merch narxlari "necha oy to'xtovsiz o'yin" formulasiga ko'ra (1 oy ≈ 2'400c).
 */

export type ShopItemKind = 'accent-theme' | 'premium-days' | 'avatar-frame'

export interface ShopItem {
  id: string
  kind: ShopItemKind
  /** Coin narxi (>0) */
  price: number
  /** kind='premium-days' uchun grant kuni (muddati) */
  days?: number
}

/** Javob boshiga mint — recordAnswer CTE'da faqat gate'dan o'tgan TO'G'RI javob uchun. */
export const COINS_PER_CORRECT_ANSWER = 1

/** Merch narx-anchor'i: 1 oylik har-kunlik faol o'yin (30 × 80c) ≈ 2'400c. */
export const COINS_MONTH_OF_PLAY = 2400

export const SHOP_ITEMS = [
  // ── Coin-eksklyuziv temalar (premium:false — FAQAT tanga evaziga) ──
  { id: 'crimson', kind: 'accent-theme', price: 500 },
  { id: 'royal',   kind: 'accent-theme', price: 500 },
  { id: 'arctic',  kind: 'accent-theme', price: 500 },
  // ── Mavjud premium temalar — coin'ga ham (premium obunasi ALTERNATIVASI) ──
  { id: 'aurora',   kind: 'accent-theme', price: 800 },
  { id: 'violet',   kind: 'accent-theme', price: 800 },
  { id: 'ocean',    kind: 'accent-theme', price: 800 },
  { id: 'forest',   kind: 'accent-theme', price: 800 },
  { id: 'sunset',   kind: 'accent-theme', price: 800 },
  { id: 'sakura',   kind: 'accent-theme', price: 800 },
  { id: 'obsidian', kind: 'accent-theme', price: 800 },
  { id: 'gold',     kind: 'accent-theme', price: 800 },
  { id: 'payme',    kind: 'accent-theme', price: 800 },
  // ── Consumable: 1 kunlik premium (C-1 — tariff'ga tegmaydi) ──
  { id: 'premium-days-1', kind: 'premium-days', price: 300, days: 1 },
  // ── Avatar ramkalari (durable — bitta marta sotib olinadi, umrbod) ──
  { id: 'frame-neon',    kind: 'avatar-frame', price: 300 },
  { id: 'frame-arctic',  kind: 'avatar-frame', price: 500 },
  { id: 'frame-royal',   kind: 'avatar-frame', price: 500 },
  { id: 'frame-gold',    kind: 'avatar-frame', price: 500 },
  { id: 'frame-fire',    kind: 'avatar-frame', price: 700 },
] as const satisfies readonly ShopItem[]

export type ShopItemId = (typeof SHOP_ITEMS)[number]['id']

export function getShopItem(id: string): ShopItem | null {
  return (SHOP_ITEMS as readonly ShopItem[]).find((i) => i.id === id) ?? null
}

/** Durable buyummi (user_items'ga yoziladimi) — premium-days consumable: yo'q. */
export function isDurableShopItem(item: ShopItem): boolean {
  return item.kind === 'accent-theme' || item.kind === 'avatar-frame'
}
