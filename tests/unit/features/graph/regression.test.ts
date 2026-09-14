import { describe, it, expect } from 'vitest'
import { linearRegression, forecast } from '../../../../src/features/graph/lib/math'

describe('grafik: chiziqli regression', () => {
  it('mukammal chiziq: k, b, R² = 1', () => {
    const reg = linearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ])
    expect(reg).not.toBeNull()
    expect(reg!.slope).toBeCloseTo(2, 10)
    expect(reg!.intercept).toBeCloseTo(1, 10)
    expect(reg!.r2).toBeCloseTo(1, 10)
    expect(reg!.vertical).toBe(false)
  })

  it('fizika misoli: s(t) = v·t — qiyalik tezlikni beradi', () => {
    const reg = linearRegression([
      { x: 1, y: 2.9 },
      { x: 2, y: 6.1 },
      { x: 3, y: 8.8 },
      { x: 4, y: 12.2 },
    ])
    expect(reg!.slope).toBeGreaterThan(2.9)
    expect(reg!.slope).toBeLessThan(3.1)
    expect(reg!.r2).toBeGreaterThan(0.99)
  })

  it('2 tadan kam nuqta — null', () => {
    expect(linearRegression([])).toBeNull()
    expect(linearRegression([{ x: 1, y: 2 }])).toBeNull()
  })

  it('vertikal holat (barcha x bir xil)', () => {
    const reg = linearRegression([
      { x: 2, y: 1 },
      { x: 2, y: 5 },
    ])
    expect(reg!.vertical).toBe(true)
    expect(reg!.intercept).toBeCloseTo(2, 10)
    expect(Number.isNaN(reg!.r2)).toBe(true)
  })

  it('gorizontal chiziq R² = 1 (y o‘zgarmaydi)', () => {
    const reg = linearRegression([
      { x: 0, y: 4 },
      { x: 1, y: 4 },
      { x: 9, y: 4 },
    ])
    expect(reg!.slope).toBeCloseTo(0, 10)
    expect(reg!.intercept).toBeCloseTo(4, 10)
    expect(reg!.r2).toBeCloseTo(1, 10)
  })

  it('forecast chiziq bo‘yicha bashorat qiladi', () => {
    const reg = linearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ])
    expect(forecast(reg!, 10)).toBeCloseTo(21, 10)
  })
})
