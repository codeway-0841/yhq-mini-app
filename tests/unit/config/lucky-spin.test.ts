/**
 * Lucky Spin (shared/lucky-spin.ts) — data integrity + tanlov funksiyasi.
 *
 * Nega: server RNG shu config bilan ishlaydi; UI g'ildiragi shu segmentlarni
 * chizadi — og'irlik yig'indisi 100 bo'lmasa tortishuv noto'g'ri, EV juda
 * yuqori bo'lsa iqtisod buziladi (kunlik ~17c byudjet chegarasi).
 */
import { describe, it, expect } from 'vitest'
import { SPIN_SEGMENTS, SPIN_TOTAL_WEIGHT, getSpinSegment, pickSpinSegment, spinExpectedValue } from '../../../shared/lucky-spin'

describe('config/lucky-spin — data integrity', () => {
  it("barcha segment id'lari unikal", () => {
    const ids = SPIN_SEGMENTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('og\'irliklar musbat, yig\'indi = 100; amount>0', () => {
    for (const s of SPIN_SEGMENTS) {
      expect(s.weight).toBeGreaterThan(0)
      expect(s.amount).toBeGreaterThan(0)
      expect(Number.isInteger(s.weight)).toBe(true)
      expect(Number.isInteger(s.amount)).toBe(true)
    }
    expect(SPIN_TOTAL_WEIGHT).toBe(100)
  })

  it('iquisod byudjeti: EV 20..50 coin/kun chegarasida (kunlik ~160c mintdan kam)', () => {
    const ev = spinExpectedValue()
    expect(ev).toBeGreaterThan(20)
    expect(ev).toBeLessThanOrEqual(50)
  })

  it('kamirib 2 segment (g\'ildirak uchun), premium segment faqat bitta', () => {
    expect(SPIN_SEGMENTS.length).toBeGreaterThanOrEqual(2)
    expect(SPIN_SEGMENTS.filter((s) => s.kind === 'premium-days').length).toBe(1)
  })
})

describe('config/lucky-spin — pickSpinSegment (sof funksiya)', () => {
  it('chegaraviy rand01: 0 → birinchi segment, ~1 → oxirgi segment', () => {
    expect(pickSpinSegment(0).id).toBe(SPIN_SEGMENTS[0].id)
    expect(pickSpinSegment(0.999999).id).toBe(SPIN_SEGMENTS[SPIN_SEGMENTS.length - 1].id)
  })

  it('kumulative oraliqlar bo\'yicha to\'g\'ri segment', () => {
    // 1-segment: [0, 0.25); 2-segment: [0.25, 0.47); oxirgi (p1): [0.98, 1)
    expect(pickSpinSegment(0.24).id).toBe(SPIN_SEGMENTS[0].id)
    expect(pickSpinSegment(0.25).id).toBe(SPIN_SEGMENTS[1].id)
    expect(pickSpinSegment(0.46).id).toBe(SPIN_SEGMENTS[1].id)
    expect(pickSpinSegment(0.47).id).toBe(SPIN_SEGMENTS[2].id)
    expect(pickSpinSegment(0.98).id).toBe('p1')
    expect(pickSpinSegment(0.97).id).toBe('c100')
  })

  it('har qanday rand01 uchun valid segment (monoton qamrov)', () => {
    for (let i = 0; i < 1000; i++) {
      const seg = pickSpinSegment(i / 1000)
      expect(getSpinSegment(seg.id)).not.toBeNull()
    }
  })

  it('getSpinSegment: nomaʼlum id → null', () => {
    // id'lar tarixiy yorliq, miqdor emas: 'c10' 2× iqtisoddan keyin 20 beradi
    expect(getSpinSegment('c10')?.amount).toBe(20)
    expect(getSpinSegment('???')).toBeNull()
  })
})
