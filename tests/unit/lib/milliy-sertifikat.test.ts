import { describe, it, expect } from 'vitest'
import {
  getCertificateGrade,
  calculateRashScore,
  calculateDtmBenefit,
  MILLIY_SERTIFIKAT_MAX_SCORE,
  MAJOR_1_MAX_SCORE,
  MAJOR_2_MAX_SCORE,
} from '../../../shared/milliy-sertifikat'

describe('shared/milliy-sertifikat — getCertificateGrade', () => {
  it('A+ darajasi: 70.0 va undan yuqori', () => {
    expect(getCertificateGrade(75.0)).toBe('A+')
    expect(getCertificateGrade(70.0)).toBe('A+')
    expect(getCertificateGrade(72.5)).toBe('A+')
  })

  it('A darajasi: 65.0 – 69.9', () => {
    expect(getCertificateGrade(69.9)).toBe('A')
    expect(getCertificateGrade(65.0)).toBe('A')
    expect(getCertificateGrade(67.4)).toBe('A')
  })

  it('B+ darajasi: 60.0 – 64.9', () => {
    expect(getCertificateGrade(64.9)).toBe('B+')
    expect(getCertificateGrade(60.0)).toBe('B+')
  })

  it('B darajasi: 55.0 – 59.9', () => {
    expect(getCertificateGrade(59.9)).toBe('B')
    expect(getCertificateGrade(55.0)).toBe('B')
  })

  it('C+ darajasi: 50.0 – 54.9', () => {
    expect(getCertificateGrade(54.9)).toBe('C+')
    expect(getCertificateGrade(50.0)).toBe('C+')
  })

  it('C darajasi: 46.0 – 49.9', () => {
    expect(getCertificateGrade(49.9)).toBe('C')
    expect(getCertificateGrade(46.0)).toBe('C')
  })

  it('46 balldan past: sertifikat berilmaydi (null)', () => {
    expect(getCertificateGrade(45.9)).toBeNull()
    expect(getCertificateGrade(40.0)).toBeNull()
    expect(getCertificateGrade(0)).toBeNull()
    expect(getCertificateGrade(-5)).toBeNull()
  })
})

describe('shared/milliy-sertifikat — calculateRashScore', () => {
  it('barcha savollar to\'g\'ri bo\'lsa 75 ball chiqadi', () => {
    expect(calculateRashScore(45, 45)).toBe(MILLIY_SERTIFIKAT_MAX_SCORE)
    expect(calculateRashScore(43, 43)).toBe(MILLIY_SERTIFIKAT_MAX_SCORE)
  })

  it('0 to\'g\'ri bo\'lsa 0 ball chiqadi', () => {
    expect(calculateRashScore(0, 45)).toBe(0)
  })

  it('proporsional hisob to\'g\'ri yaxlitlanadi', () => {
    // 30 / 45 * 75 = 50.0
    expect(calculateRashScore(30, 45)).toBe(50.0)
    // 36 / 45 * 75 = 60.0
    expect(calculateRashScore(36, 45)).toBe(60.0)
    // 40 / 45 * 75 = 66.666... -> 66.7
    expect(calculateRashScore(40, 45)).toBe(66.7)
  })

  it('chegaraviy va noto\'g\'ri qiymatlarni xavfsiz boshqaradi', () => {
    expect(calculateRashScore(50, 45)).toBe(MILLIY_SERTIFIKAT_MAX_SCORE)
    expect(calculateRashScore(-5, 45)).toBe(0)
    expect(calculateRashScore(10, 0)).toBe(0)
  })
})

describe('shared/milliy-sertifikat — calculateDtmBenefit', () => {
  it('A+ daraja uchun DTM 100% maksimal ball (93 va 63)', () => {
    const benefit = calculateDtmBenefit(72.0)
    expect(benefit.grade).toBe('A+')
    expect(benefit.isPassed).toBe(true)
    expect(benefit.major1Score).toBe(MAJOR_1_MAX_SCORE)
    expect(benefit.major2Score).toBe(MAJOR_2_MAX_SCORE)
    expect(benefit.mandatoryFullScore).toBe(true)
    expect(benefit.percentOfMax).toBe(100)
  })

  it('A daraja uchun DTM 100% maksimal ball (93 va 63)', () => {
    const benefit = calculateDtmBenefit(67.0)
    expect(benefit.grade).toBe('A')
    expect(benefit.isPassed).toBe(true)
    expect(benefit.major1Score).toBe(MAJOR_1_MAX_SCORE)
    expect(benefit.major2Score).toBe(MAJOR_2_MAX_SCORE)
    expect(benefit.mandatoryFullScore).toBe(true)
  })

  it('B+ daraja (60 ball) uchun proporsional DTM ballari (74.4 va 50.4)', () => {
    const benefit = calculateDtmBenefit(60.0)
    expect(benefit.grade).toBe('B+')
    expect(benefit.isPassed).toBe(true)
    // 60 / 75 * 93 = 74.4
    expect(benefit.major1Score).toBe(74.4)
    // 60 / 75 * 63 = 50.4
    expect(benefit.major2Score).toBe(50.4)
    expect(benefit.percentOfMax).toBe(80)
    // Majburiy fanda esa maksimal ball kafolati!
    expect(benefit.mandatoryFullScore).toBe(true)
  })

  it('C daraja (46 ball) uchun proporsional DTM ballari (57.0 va 38.6)', () => {
    const benefit = calculateDtmBenefit(46.0)
    expect(benefit.grade).toBe('C')
    expect(benefit.isPassed).toBe(true)
    // 46 / 75 * 93 = 57.04 -> 57.0
    expect(benefit.major1Score).toBe(57.0)
    // 46 / 75 * 63 = 38.64 -> 38.6
    expect(benefit.major2Score).toBe(38.6)
    expect(benefit.percentOfMax).toBe(61.3)
    expect(benefit.mandatoryFullScore).toBe(true)
  })

  it('46 balldan past bo\'lsa sertifikat va imtiyoz berilmaydi', () => {
    const benefit = calculateDtmBenefit(42.0)
    expect(benefit.grade).toBeNull()
    expect(benefit.isPassed).toBe(false)
    expect(benefit.major1Score).toBe(0)
    expect(benefit.major2Score).toBe(0)
    expect(benefit.mandatoryFullScore).toBe(false)
  })
})
