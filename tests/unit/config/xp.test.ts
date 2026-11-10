/**
 * XP konfiguratsiyasi — level egri chizig'i va kunlik shiftlar.
 * Bu qiymatlar server (recordAnswer) va client (Dashboard/Statistika) uchun
 * YAGONA manba, shuning uchun invariantlar shu yerda qulflanadi.
 */
import { describe, it, expect } from 'vitest'
import {
  XP_FIRST_CORRECT, XP_MISTAKE_FIXED, XP_WRONG, XP_DAILY_CAP, COINS_DAILY_ANSWER_CAP,
  xpForLevel, levelFromXp, levelProgress,
} from '../../../shared/xp'

describe('XP qiymatlari', () => {
  it('test savoli to\'g\'ri = 1 XP, xatoni tuzatish = 1 XP, xato = 0 (ataylab xato eksploit yo\'q)', () => {
    expect(XP_FIRST_CORRECT).toBe(1)
    expect(XP_MISTAKE_FIXED).toBe(XP_FIRST_CORRECT)
    expect(XP_WRONG).toBe(0)
  })

  it('kunlik XP limiti o\'chirilgan (null), coin shifti esa faol', () => {
    expect(XP_DAILY_CAP).toBeNull()
    expect(COINS_DAILY_ANSWER_CAP).toBeGreaterThan(0)
  })
})

describe('level egri chizig\'i', () => {
  it('levelFromXp va xpForLevel bir-birining teskarisi', () => {
    for (let n = 1; n <= 200; n++) {
      expect(levelFromXp(xpForLevel(n))).toBe(n)
    }
  })

  it('chegaradan 1 XP kam bo\'lsa level ko\'tarilmaydi', () => {
    for (let n = 2; n <= 200; n++) {
      expect(levelFromXp(xpForLevel(n) - 1)).toBe(n - 1)
    }
  })

  it('0 va yaroqsiz qiymatlarda 1-level', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(-100)).toBe(1)
    expect(levelFromXp(NaN)).toBe(1)
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(0)).toBe(0)
    expect(xpForLevel(NaN)).toBe(0)
  })

  it('egri chiziq o\'sib boradi (keyingi level qimmatroq)', () => {
    // n=3 dan boshlanadi: 1-level 0 XP dan boshlangani uchun 1→2 qadami
    // atayin kengroq (yangi o'quvchiga birinchi level uzunroq beriladi)
    for (let n = 3; n <= 50; n++) {
      const step     = xpForLevel(n) - xpForLevel(n - 1)
      const nextStep = xpForLevel(n + 1) - xpForLevel(n)
      expect(nextStep).toBeGreaterThan(step)
    }
  })

  it('tezlik nazorati: 15 000 XP to\'plagan o\'quvchi ~15-levelda', () => {
    const monthSample = 15_000
    expect(levelFromXp(monthSample)).toBeGreaterThanOrEqual(13)
    expect(levelFromXp(monthSample)).toBeLessThanOrEqual(17)
  })

  it('levelProgress joriy level ichidagi ulushni beradi', () => {
    const atThreshold = levelProgress(xpForLevel(10))
    expect(atThreshold.level).toBe(10)
    expect(atThreshold.current).toBe(0)
    expect(atThreshold.ratio).toBe(0)

    const mid = levelProgress(Math.round((xpForLevel(10) + xpForLevel(11)) / 2))
    expect(mid.level).toBe(10)
    expect(mid.ratio).toBeGreaterThan(0.4)
    expect(mid.ratio).toBeLessThan(0.6)
  })
})
