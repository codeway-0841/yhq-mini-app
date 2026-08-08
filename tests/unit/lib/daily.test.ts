/**
 * Unit tests for Daily Challenge streak logic (server) + seeded utils (client).
 * Run with: npx vitest tests/unit/lib/daily.test.ts
 */

import { describe, it, expect } from 'vitest'
import { prevDate, calcNextStreak, effectiveStreak, calcBestStreak } from '../../../server/modules/daily/daily.repository'
import { seededShuffle, hashSeed } from '../../../src/shared/lib/seeded'

describe('prevDate', () => {
  it('oddiy kun', () => {
    expect(prevDate('2026-08-04')).toBe('2026-08-03')
  })
  it('oy chegarasi', () => {
    expect(prevDate('2026-08-01')).toBe('2026-07-31')
  })
  it('yil chegarasi', () => {
    expect(prevDate('2026-01-01')).toBe('2025-12-31')
  })
  it('kabisa yili', () => {
    expect(prevDate('2024-03-01')).toBe('2024-02-29')
  })
})

describe('calcNextStreak', () => {
  it('ilk marta — 1 dan boshlanadi', () => {
    expect(calcNextStreak(null, '2026-08-04', 0)).toBe(1)
  })
  it('kecha bajarilgan — seriya +1', () => {
    expect(calcNextStreak('2026-08-03', '2026-08-04', 5)).toBe(6)
  })
  it('shu kun allaqachon bajarilgan — o\'zgarishsiz (idempotent)', () => {
    expect(calcNextStreak('2026-08-04', '2026-08-04', 5)).toBe(5)
  })
  it('bir kun o\'tkazilgan — 1 dan qayta boshlanadi', () => {
    expect(calcNextStreak('2026-08-02', '2026-08-04', 12)).toBe(1)
  })
  it('uzoq uzilishdan keyin — 1', () => {
    expect(calcNextStreak('2026-01-01', '2026-08-04', 30)).toBe(1)
  })
  it('kechagi kun — oy chegarasida ham to\'g\'ri', () => {
    expect(calcNextStreak('2026-07-31', '2026-08-01', 3)).toBe(4)
  })
})

describe('effectiveStreak', () => {
  it('bugun bajarilgan — seriya ko\'rinadi', () => {
    expect(effectiveStreak('2026-08-04', '2026-08-04', 5)).toBe(5)
  })
  it('kecha bajarilgan — hali davomiy (buzulmagan)', () => {
    expect(effectiveStreak('2026-08-03', '2026-08-04', 5)).toBe(5)
  })
  it('bir kun o\'tkazilgan — 0 ga tushadi', () => {
    expect(effectiveStreak('2026-08-02', '2026-08-04', 12)).toBe(0)
  })
  it('umuman bajarilmagan — 0', () => {
    expect(effectiveStreak(null, '2026-08-04', 0)).toBe(0)
  })
})

describe('🧊 Streak Freeze (premium 1 kunlik himoya)', () => {
  it('effectiveStreak: aynan 1 kunlik uzilishda premium seriyasI SAQLANADI', () => {
    expect(effectiveStreak('2026-08-02', '2026-08-04', 12, true)).toBe(12)
  })
  it('effectiveStreak: 2+ kunlik uzilishda premium HAM reset bo\'ladi', () => {
    expect(effectiveStreak('2026-08-01', '2026-08-04', 12, true)).toBe(0)
    expect(effectiveStreak('2026-01-01', '2026-08-04', 30, true)).toBe(0)
  })
  it('effectiveStreak: freeze FAQAT premium uchun (free = reset)', () => {
    expect(effectiveStreak('2026-08-02', '2026-08-04', 12, false)).toBe(0)
  })
  it("calcNextStreak: freeze'da 1 kunlik uzilishdan keyin seriya DAVOM ETADI (+1)", () => {
    expect(calcNextStreak('2026-08-02', '2026-08-04', 12, true)).toBe(13)
  })
  it("calcNextStreak: freeze'siz o'sha holat — 1 dan qayta", () => {
    expect(calcNextStreak('2026-08-02', '2026-08-04', 12, false)).toBe(1)
  })
  it('calcNextStreak: 2+ kunlik uzilishda premium HAM 1 dan qayta', () => {
    expect(calcNextStreak('2026-08-01', '2026-08-04', 12, true)).toBe(1)
  })
})

describe('calcBestStreak', () => {
  it('bo\'sh ro\'yxat — 0', () => {
    expect(calcBestStreak([])).toBe(0)
  })
  it('uzilishli seriyalardagi eng uzun tanlanadi', () => {
    expect(calcBestStreak([
      '2026-07-01', '2026-07-02',            // 2
      '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', // 4 ← rekord
      '2026-07-10',
    ])).toBe(4)
  })
  it('oy chegarasi bo\'ylab ham ketma-ketlik saqlanadi', () => {
    expect(calcBestStreak(['2026-07-30', '2026-07-31', '2026-08-01'])).toBe(3)
  })
})

describe('seededShuffle', () => {
  const src = Array.from({ length: 50 }, (_, i) => i + 1)

  it('bir xil seed — bir xil natija (deterministik)', () => {
    expect(seededShuffle(src, 42)).toEqual(seededShuffle(src, 42))
  })
  it('turli seed — turli tartib', () => {
    expect(seededShuffle(src, 1)).not.toEqual(seededShuffle(src, 2))
  })
  it('elementlar saqlanadi (saralangan holati bir xil)', () => {
    expect([...seededShuffle(src, 7)].sort((a, b) => a - b)).toEqual(src)
  })
  it('string seed (sana) ham barqaror', () => {
    const a = seededShuffle(src, hashSeed('2026-08-04|yhq'))
    const b = seededShuffle(src, hashSeed('2026-08-04|yhq'))
    const c = seededShuffle(src, hashSeed('2026-08-05|yhq'))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })
})

describe('hashSeed', () => {
  it('bir xil string — bir xil xash', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
  })
  it('turli string — turli xash', () => {
    expect(hashSeed('2026-08-04|yhq')).not.toBe(hashSeed('2026-08-05|yhq'))
  })
})
