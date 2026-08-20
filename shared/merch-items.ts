/**
 * MERCH KATALOGI (FIXPLAN #40 Faza 3) — YAGONA MANBA (frontend + server).
 *
 * REAL fizik tovarlar coin'ga: kiyim / sumka / nakleyka.
 * Narx siyosati (product qarori): "necha oy to'xtovsiz o'yin" formulasiga
 * bog'langan — baza COINS_MONTH_OF_PLAY = 2'400c (30 kun × ~80c/kun):
 *   - Nakleyka ≈ 1 oy   (2'500c)
 *   - Sumka    ≈ 1.5 oy (3'500c)
 *   - Kiyim    ≈ 2 oy   (5'000c)
 *
 * QOIDALAR:
 * - `stock` — umumiy zaxira (server purchase CTE'da faol buyurtmalar soni
 *   bilan tekshiriladi: COUNT(orders, status<>'cancelled') < stock).
 * - User boshiga har item'dan FAQAT 1 ta (real xarajatli tovar — farm-sug'urta);
 *   bekor + refund ATOMIK (`merch_refund` ledger qaydi, 1 marta).
 * - `image` ixtiyoriy — yo'q bo'lsa UI emoji/gradient tile ko'rsatadi.
 */

export interface MerchItem {
  id: string
  /** Coin narxi (>0) */
  price: number
  /** Umumiy zaxira (>0) */
  stock: number
  /** Ko'rsatish (UI brend matnlari) */
  label: { uz: string; ru: string }
  desc:  { uz: string; ru: string }
  /** Emoji tile (rasm bo'lmasa) */
  emoji: string
  image?: string
}

export const MERCH_ITEMS = [
  {
    id: 'nakleyka', price: 2500, stock: 20, emoji: '🏷️',
    label: { uz: 'KIWI nakleykalari to‘plami', ru: 'Набор наклеек KIWI' },
    desc:  { uz: '10 ta premium nakleyka — noutbuk, telefon, avtoulovingiz uchun', ru: '10 премиум-наклеек — для ноутбука, телефона, авто' },
  },
  {
    id: 'sumka',    price: 3500, stock: 10, emoji: '👜',
    label: { uz: 'KIWI shopper sumka', ru: 'Шоппер KIWI' },
    desc:  { uz: 'Mustahkam x/з sumka — kundalik foydalanish va kutubxonaga', ru: 'Прочный х/б шоппер — на каждый день и для учёбы' },
  },
  {
    id: 'kiyim',    price: 5000, stock: 10, emoji: '👕',
    label: { uz: 'KIWI futbolka', ru: 'Футболка KIWI' },
    desc:  { uz: '100% paxta, brend bosmasi — o‘lcham buyurtma tafsilotida', ru: '100% хлопок, фирменный принт — размер в деталях заказа' },
  },
] as const satisfies readonly MerchItem[]

export type MerchItemId = (typeof MERCH_ITEMS)[number]['id']

export function getMerchItem(id: string): MerchItem | null {
  return (MERCH_ITEMS as readonly MerchItem[]).find((i) => i.id === id) ?? null
}
