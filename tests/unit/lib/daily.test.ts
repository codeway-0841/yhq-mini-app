/**
 * Unit tests for Daily Challenge streak logic (server) + seeded utils (client).
 * Run with: npx vitest tests/unit/lib/daily.test.ts
 */

import { describe, it, expect } from 'vitest'
import { prevDate, calcNextStreak } from '../../../server/modules/daily/daily.repository'
import { seededShuffle, hashSeed } from '../../../src/lib/seeded'

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
