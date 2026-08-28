/**
 * Accent themes consistency — src/config/themes.ts ↔ src/index.css sinxronligi.
 *
 * Premium aksent temalar free foydalanuvchiga "yopishib qolmasligi" kerak:
 * resolveAccent free user'ni har doim DEFAULT_ACCENT'ga qaytaradi.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ACCENT_THEMES,
  DEFAULT_ACCENT,
  getAccentTheme,
  resolveAccent,
} from '../../../src/shared/config/themes'

describe('config/themes — data integrity', () => {
  it("barcha id'lar unikal", () => {
    const ids = ACCENT_THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('DEFAULT_ACCENT roʻyxatda mavjud va premium EMAS', () => {
    const def = ACCENT_THEMES.find((t) => t.id === DEFAULT_ACCENT)
    expect(def).toBeDefined()
    expect(def!.premium).toBe(false)
  })

  it('barcha temalarda toʻgʻri hex ranglar (aksent + bg + card) va i18n label', () => {
    for (const t of ACCENT_THEMES) {
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.bg).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.card).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.label.uz.trim()).not.toBe('')
      expect(t.label.ru.trim()).not.toBe('')
      // Sifati: total temalar 8-25 ta (#40 coin-eksklyuziv: crimson/royal/arctic, claude AI)
      expect(ACCENT_THEMES.length).toBeLessThanOrEqual(25)
    }
  })

  it("har bir tema uchun DARK variant bloki bor (light-only 'sakura': shartsiz canonical blok hisoblanadi)", () => {
    const css = readFileSync(resolve(__dirname, '../../../src/index.css'), 'utf8')
    for (const t of ACCENT_THEMES) {
      if (t.id === DEFAULT_ACCENT) continue
      // DARK: aniq variant YOKI shartsiz canonical blok (faqat 'sakura' — light-only dizayn)
      const hasDark    = css.includes(`[data-theme='dark'][data-accent='${t.id}']`)
      const hasUncond  = new RegExp(`body\\[data-accent='${t.id}'\\]\\s*\\{`).test(css)
      expect({ id: t.id, ok: hasDark || hasUncond }).toEqual({ id: t.id, ok: true })
    }
  })

  it("har bir tema uchun LIGHT variant bloki bor (dark-only tema: umumiy '[data-theme='dark']'dan meros — lekin sakura/obsidian alohida)", () => {
    const css = readFileSync(resolve(__dirname, '../../../src/index.css'), 'utf8')
    for (const t of ACCENT_THEMES) {
      if (t.id === DEFAULT_ACCENT) continue
      // LIGHT: aniq variant YOKI shartsiz canonical blok (sakura)
      const hasLight  = css.includes(`[data-theme='light'][data-accent='${t.id}']`)
      const hasUncond = new RegExp(`body\\[data-accent='${t.id}'\\]\\s*\\{`).test(css)
      expect({ id: t.id, ok: hasLight || hasUncond }).toEqual({ id: t.id, ok: true })
    }
  })
})

describe('resolveAccent — premium gating', () => {
  it('free foydalanuvchi default temani oladi', () => {
    expect(resolveAccent(DEFAULT_ACCENT, false)).toBe(DEFAULT_ACCENT)
    expect(resolveAccent(DEFAULT_ACCENT, true)).toBe(DEFAULT_ACCENT)
  })

  it('premium obunachi premium temani tanlay oladi', () => {
    for (const t of ACCENT_THEMES.filter((x) => x.premium)) {
      expect(resolveAccent(t.id, true)).toBe(t.id)
    }
  })

  it('free foydalanuvchi premium tema tanlasa — defaultGA QAYTADI', () => {
    for (const t of ACCENT_THEMES.filter((x) => x.premium)) {
      expect(resolveAccent(t.id, false)).toBe(DEFAULT_ACCENT)
    }
  })

  it("noma'lum id — birinchi (default) temaga fallback", () => {
    expect(resolveAccent('nonexistent', true)).toBe(ACCENT_THEMES[0].id)
    expect(resolveAccent('', false)).toBe(ACCENT_THEMES[0].id)
  })

  it('getAccentTheme nomaʼlum idʼda birinchi temani qaytaradi', () => {
    expect(getAccentTheme('???').id).toBe(ACCENT_THEMES[0].id)
  })
})

describe('resolveAccent — COIN egaligi (#40)', () => {
  // Coin-eksklyuziv temalar: premium:false + shop'da bor (crimson/royal/arctic)
  const COIN_EXCLUSIVE = ACCENT_THEMES.filter((t) => !t.premium && t.id !== DEFAULT_ACCENT)

  it('coin-eksklyuziv temalar egalikSIZ hech kimga ochilmaydi (premium ham emas)', () => {
    expect(COIN_EXCLUSIVE.length).toBeGreaterThanOrEqual(3)
    for (const t of COIN_EXCLUSIVE) {
      expect(resolveAccent(t.id, false)).toBe(DEFAULT_ACCENT)
      expect(resolveAccent(t.id, true)).toBe(DEFAULT_ACCENT)   // obuna coin-temani BUCHMAYDI
    }
  })

  it('coin-eksklyuziv temani SOTIB OLgan user ochadi (free ham, premium ham)', () => {
    for (const t of COIN_EXCLUSIVE) {
      expect(resolveAccent(t.id, false, new Set([t.id]))).toBe(t.id)
      expect(resolveAccent(t.id, true,  new Set([t.id]))).toBe(t.id)
    }
  })

  it('premium temani coinʼga SOTIB OLgan FREE user ham ochadi (owned har qanday yoʼlni yopadi)', () => {
    const firstPremium = ACCENT_THEMES.find((t) => t.premium)!
    expect(resolveAccent(firstPremium.id, false, new Set([firstPremium.id]))).toBe(firstPremium.id)
  })

  it('egalik boshqalarga TEGMAYDI — egasiz user yopiq qoladi', () => {
    const t = COIN_EXCLUSIVE[0]
    expect(resolveAccent(t.id, false, new Set(['boshqa-item']))).toBe(DEFAULT_ACCENT)
    expect(resolveAccent(t.id, false, new Set())).toBe(DEFAULT_ACCENT)
  })
})
