/**
 * Merch katalog konfigi (shared/merch-items.ts) — data integrity.
 * Narx siyosati: "necha oy to'xtovsiz o'yin" — COINS_MONTH_OF_PLAY bazasi.
 */
import { describe, it, expect } from 'vitest'
import { MERCH_ITEMS, getMerchItem } from '../../../shared/merch-items'
import { COINS_MONTH_OF_PLAY, SHOP_ITEMS } from '../../../shared/shop-items'

describe('config/merch-items — data integrity', () => {
  it("barcha id'lar unikal va shop-items bilan TO'QNASHMAYDI (alohida katalog)", () => {
    const ids = MERCH_ITEMS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    const shopIds = new Set(SHOP_ITEMS.map((s) => s.id))
    for (const id of ids) expect(shopIds.has(id)).toBe(false)
  })

  it('narxlar/stock musbat butun sonlar', () => {
    for (const m of MERCH_ITEMS) {
      expect(Number.isInteger(m.price) && m.price > 0).toBe(true)
      expect(Number.isInteger(m.stock) && m.stock > 0).toBe(true)
    }
  })

  it('narx siyosati: eng arzon merch ≥ 1 oylik o‘yin (COINS_MONTH_OF_PLAY)', () => {
    const cheapest = Math.min(...MERCH_ITEMS.map((m) => m.price))
    expect(cheapest).toBeGreaterThanOrEqual(COINS_MONTH_OF_PLAY)
  })

  it('i18n + emoji + desc to‘liq', () => {
    for (const m of MERCH_ITEMS) {
      expect(m.label.uz.trim()).not.toBe('')
      expect(m.label.ru.trim()).not.toBe('')
      expect(m.desc.uz.trim()).not.toBe('')
      expect(m.desc.ru.trim()).not.toBe('')
      expect(m.emoji.trim()).not.toBe('')
    }
  })

  it('getMerchItem: nomaʼlum → null', () => {
    expect(getMerchItem('???')).toBeNull()
    expect(getMerchItem(MERCH_ITEMS[0].id)?.id).toBe(MERCH_ITEMS[0].id)
  })
})
