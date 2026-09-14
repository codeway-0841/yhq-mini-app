/**
 * Kamera fan karuseli — swipe'da markazdagi fan avtomatik tanlanadi.
 * `nearestCenterIndex` sof funksiya deterministik testi.
 */
import { describe, it, expect } from 'vitest'
import { nearestCenterIndex } from '../../../src/features/ai-tutor/subject-carousel'

describe('nearestCenterIndex', () => {
  it("bo'sh ro'yxatda -1", () => {
    expect(nearestCenterIndex([], 100)).toBe(-1)
  })

  it('bitta element har doim tanlanadi', () => {
    expect(nearestCenterIndex([50], 999)).toBe(0)
  })

  it('markazga eng yaqin indeks qaytadi', () => {
    // Tugma markazlari: 20, 80, 140 — viewport markazi 100
    expect(nearestCenterIndex([20, 80, 140], 100)).toBe(1)
    // Viewport markazi 130 — 140 yaqinroq
    expect(nearestCenterIndex([20, 80, 140], 130)).toBe(2)
    // Viewport markazi 10 — birinchi
    expect(nearestCenterIndex([20, 80, 140], 10)).toBe(0)
  })

  it('teng masofada chapdagisi (birinchi) yutadi', () => {
    expect(nearestCenterIndex([80, 120], 100)).toBe(0)
  })

  it("o'ngga surilganda keyingi fan (Umumiy -> Matematika -> Fizika)", () => {
    const centers = [30, 130, 230, 330]
    expect(nearestCenterIndex(centers, 40)).toBe(0)
    expect(nearestCenterIndex(centers, 140)).toBe(1)
    expect(nearestCenterIndex(centers, 240)).toBe(2)
    expect(nearestCenterIndex(centers, 340)).toBe(3)
  })
})
