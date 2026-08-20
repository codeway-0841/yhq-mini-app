/**
 * Do'kon katalogi (shared/shop-items.ts) ↔ tema/ramka config'lari sinxronligi.
 *
 * Nega: server debidni SHOP_ITEMS narxi bo'yicha qiladi, frontend esa temani/
 * ramkani ACCENT_THEMES/AVATAR_FRAMES'dan ko'rsatadi — desync (noma'lum id,
 * premium temani shop'siz qoldirish, ortiqcha narxli default tema) = buzilgan
 * iqtisod. Bu test desync'ni CI'da ushlaydi.
 */
import { describe, it, expect } from 'vitest'
import { SHOP_ITEMS, getShopItem, isDurableShopItem, COINS_PER_CORRECT_ANSWER, COINS_MONTH_OF_PLAY } from '../../../shared/shop-items'
import { ACCENT_THEMES, DEFAULT_ACCENT } from '../../../src/shared/config/themes'
import { AVATAR_FRAMES } from '../../../src/shared/config/avatar-frames'

describe('config/shop-items — data integrity', () => {
  it("barcha id'lar unikal", () => {
    const ids = SHOP_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('narxlar butun musbat sonlar, mint konstantasi musbat', () => {
    for (const i of SHOP_ITEMS) {
      expect(Number.isInteger(i.price)).toBe(true)
      expect(i.price).toBeGreaterThan(0)
    }
    expect(COINS_PER_CORRECT_ANSWER).toBeGreaterThan(0)
    expect(COINS_MONTH_OF_PLAY).toBeGreaterThan(0)
  })

  it('premium-days consumable: days>0 majburiy va durable EMAS', () => {
    for (const i of SHOP_ITEMS.filter((x) => x.kind === 'premium-days')) {
      expect(i.days).toBeGreaterThan(0)
      expect(isDurableShopItem(i)).toBe(false)
    }
    // durable = faqat tema va ramka
    for (const i of SHOP_ITEMS.filter((x) => x.kind !== 'premium-days')) {
      expect(isDurableShopItem(i)).toBe(true)
    }
  })

  it("har 'accent-theme' item mavjud temaga ishora qiladi va vice versa (premium+coin temalar shop'da)", () => {
    const themeIds = new Set(ACCENT_THEMES.map((t) => t.id))
    for (const i of SHOP_ITEMS.filter((x) => x.kind === 'accent-theme')) {
      expect({ id: i.id, ok: themeIds.has(i.id) }).toEqual({ id: i.id, ok: true })
    }
    // Barcha premium temalar coin'ga sotiladi (alternativ yo'l)
    for (const t of ACCENT_THEMES.filter((x) => x.premium)) {
      expect({ id: t.id, ok: getShopItem(t.id) !== null }).toEqual({ id: t.id, ok: true })
    }
    // Coin-eksklyuziv (premium:false, default EMAS) temalar FAQAT shop orqali ochiladi
    for (const t of ACCENT_THEMES.filter((x) => !x.premium && x.id !== DEFAULT_ACCENT)) {
      expect({ id: t.id, ok: getShopItem(t.id) !== null }).toEqual({ id: t.id, ok: true })
    }
    // DEFAULT tema hech qachon sotilmaydi — u bepul va boshlang'ich
    expect(getShopItem(DEFAULT_ACCENT)).toBeNull()
  })

  it("har 'avatar-frame' item mavjud ramkaga ishora qiladi va vice versa", () => {
    const frameIds = new Set(AVATAR_FRAMES.map((f) => f.id))
    for (const i of SHOP_ITEMS.filter((x) => x.kind === 'avatar-frame')) {
      expect({ id: i.id, ok: frameIds.has(i.id) }).toEqual({ id: i.id, ok: true })
    }
    for (const f of AVATAR_FRAMES) {
      expect({ id: f.id, ok: getShopItem(f.id) !== null }).toEqual({ id: f.id, ok: true })
    }
  })

  it('getShopItem: nomaʼlum id → null', () => {
    expect(getShopItem('???')).toBeNull()
    expect(getShopItem('')).toBeNull()
  })
})
