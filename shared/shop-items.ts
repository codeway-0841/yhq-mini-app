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

/**
 * Mavsumiy drop oynasi — 'MM-DD' yillik TAKRORLANUVCHI kalendariya oralig'i
 * (har yili shu sanalarda avtomatik ochiladi; yil yozish shart emas).
 * Tashkent kalendari bo'yicha (daily_records bilan bir xil canonical TZ).
 * Hozir from<=until (yil kesib o'tuvchi oyna yo'q).
 */
export interface SeasonalWindow {
  /** 'MM-DD' — shu kundan aktiv */
  from: string
  /** 'MM-DD' — shu kun GACHA aktiv (shu kun oxirgi kun) */
  until: string
}

export interface ShopItem {
  id: string
  kind: ShopItemKind
  /** Coin narxi (>0) */
  price: number
  /** kind='premium-days' uchun grant kuni (muddati) */
  days?: number
  /** Mavsumiy drop: sotib olish FAQAT oyna ichida; sotib olingan umrbod qoladi */
  seasonal?: SeasonalWindow
}

/** Javob boshiga mint — recordAnswer CTE'da faqat gate'dan o'tgan TO'G'RI javob uchun. */
export const COINS_PER_CORRECT_ANSWER = 2

/**
 * Xatoni tuzatgani uchun mint — to'g'ri javobning YARMI.
 *
 * Avval bu "har 10 ta tuzatishga 1 tanga" edi (0.1 nisbati), lekin hisoblagich
 * `daily_records.fixed` dan olinardi va u har KUNI hamda har FAN bo'yicha
 * nolga qaytardi. Kunlik vazifaning o'zi 5 ta tuzatishni so'raydi, ya'ni
 * vazifani bajaradigan foydalanuvchi 10 ga hech qachon yetmay, tuzatishdan
 * abadiy 0 tanga olardi. Endi har bir tuzatish darhol to'lanadi.
 */
export const COINS_PER_MISTAKE_FIXED = 1

/** Merch narx-anchor'i: 1 oylik har-kunlik faol o'yin (30 × 160c) ≈ 4'800c. */
export const COINS_MONTH_OF_PLAY = 4800

export const SHOP_ITEMS = [
  // ── Coin-eksklyuziv temalar (premium:false — FAQAT tanga evaziga) ──
  { id: 'crimson', kind: 'accent-theme', price: 1000 },
  { id: 'royal',   kind: 'accent-theme', price: 1000 },
  { id: 'arctic',  kind: 'accent-theme', price: 1000 },
  // ── Mavjud premium temalar — coin'ga ham (premium obunasi ALTERNATIVASI) ──
  { id: 'obsidian', kind: 'accent-theme', price: 1600 },
  { id: 'neo',      kind: 'accent-theme', price: 1600 },
  { id: 'nordic',   kind: 'accent-theme', price: 1600 },
  { id: 'carplay',  kind: 'accent-theme', price: 1600 },
  { id: 'aurora',   kind: 'accent-theme', price: 1600 },
  { id: 'violet',   kind: 'accent-theme', price: 1600 },
  { id: 'ocean',    kind: 'accent-theme', price: 1600 },
  { id: 'forest',   kind: 'accent-theme', price: 1600 },
  { id: 'sunset',   kind: 'accent-theme', price: 1600 },
  { id: 'sakura',   kind: 'accent-theme', price: 1600 },
  { id: 'gold',     kind: 'accent-theme', price: 1600 },
  { id: 'payme',    kind: 'accent-theme', price: 1600 },
  { id: 'claude',      kind: 'accent-theme', price: 1600 },
  { id: 'cupertino',   kind: 'accent-theme', price: 1600 },
  { id: 'titanium',    kind: 'accent-theme', price: 1600 },
  { id: 'deeppurple',  kind: 'accent-theme', price: 1600 },
  { id: 'liquidglass', kind: 'accent-theme', price: 1600 },
  // ── Consumable: 1 kunlik premium (C-1 — tariff'ga tegmaydi) ──
  { id: 'premium-days-1', kind: 'premium-days', price: 600, days: 1 },
  // ── Avatar ramkalari (durable — bitta marta sotib olinadi, umrbod) ──
  { id: 'frame-neon',    kind: 'avatar-frame', price: 600 },
  { id: 'frame-arctic',  kind: 'avatar-frame', price: 1000 },
  { id: 'frame-royal',   kind: 'avatar-frame', price: 1000 },
  { id: 'frame-gold',    kind: 'avatar-frame', price: 1000 },
  { id: 'frame-fire',    kind: 'avatar-frame', price: 1400 },
  // ── Mavsumiy drop'lar (limitli oyna; sotib olingan umrbod qoladi) ──
  { id: 'frame-navruz',      kind: 'avatar-frame', price: 800, seasonal: { from: '03-01', until: '03-27' } },
  { id: 'frame-mustaqillik', kind: 'avatar-frame', price: 800, seasonal: { from: '08-15', until: '09-03' } },
] as const satisfies readonly ShopItem[]

export type ShopItemId = (typeof SHOP_ITEMS)[number]['id']

export function getShopItem(id: string): ShopItem | null {
  return (SHOP_ITEMS as readonly ShopItem[]).find((i) => i.id === id) ?? null
}

/** Durable buyummi (user_items'ga yoziladimi) — premium-days consumable: yo'q. */
export function isDurableShopItem(item: ShopItem): boolean {
  return item.kind === 'accent-theme' || item.kind === 'avatar-frame'
}

// ── Mavsumiy oyna logikasi (TZ: Asia/Tashkent — daily_records canonical) ─────

/** Tashkent kalendari — 'YYYY-MM-DD' (server/utils/date.tashkentDate bilan bir xil) */
function tashkentCalendar(now: Date): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

/** 'MM-DD' → taqqoslash uchun raqamli kalit (masalan '03-15' → 315) */
function mmddKey(mmdd: string): number {
  const [m, d] = mmdd.split('-').map(Number)
  return m * 100 + d
}

/** Mavsumiy oyna hozir ochiqmi (chegaraviy kunlar IKKALASI ham aktiv) */
export function isSeasonalWindowActive(w: SeasonalWindow, now: Date = new Date()): boolean {
  const todayKey = mmddKey(tashkentCalendar(now).slice(5))
  return mmddKey(w.from) <= todayKey && todayKey <= mmddKey(w.until)
}

/** Buyum hozir sotib olinadimi — mavsumiy bo'lsa faqat oyna ichida. */
export function isShopItemAvailable(item: ShopItem, now: Date = new Date()): boolean {
  return !item.seasonal || isSeasonalWindowActive(item.seasonal, now)
}

/** Aktiv oyna tugashiga qancha kun qoldi (0 = bugun oxirgi kun); faol bo'lmasa null. */
export function seasonalDaysLeft(w: SeasonalWindow, now: Date = new Date()): number | null {
  if (!isSeasonalWindowActive(w, now)) return null
  const today = tashkentCalendar(now)
  const endStr = `${today.slice(0, 4)}-${w.until}`
  return Math.round((Date.parse(`${endStr}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}
