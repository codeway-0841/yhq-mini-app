/**
 * Subjects consistency — frontend ↔ backend ↔ shared config sinxronligi.
 *
 * Bu test `biologiya` bug'ining qaytarilishini oldini oladi: avval frontend'da
 * 7 ta fan, backend'da 6 ta bo'lgan — resolveSubject('biologiya') jimgina
 * yhq'ga fallback qilardi. Endi ixcham manba `shared/subjects.ts`.
 */
import { describe, it, expect } from 'vitest'
import { SUBJECT_BASES, DEFAULT_SUBJECT_ID, questionKey, parseQuestionKey, type SubjectId } from '../../../shared/subjects'
import {
  SUBJECT_REGISTRY,
  SUBJECT_IDS,
  resolveSubject,
  DEFAULT_SUBJECT_ID as SERVER_DEFAULT,
} from '../../../server/config/subjects'
import {
  SUBJECTS,
  getSubject,
  DEFAULT_SUBJECT_ID as CLIENT_DEFAULT,
} from '../../../src/shared/config/subjects'

describe('shared/subjects — data integrity', () => {
  it("barcha id'lar unikal", () => {
    const ids = SUBJECT_BASES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("DEFAULT_SUBJECT_ID ro'yxatda mavjud", () => {
    expect(SUBJECT_BASES.some((s) => s.id === DEFAULT_SUBJECT_ID)).toBe(true)
  })

  it("barcha fanlarda bosh bo'lmagan name/nameRu/dataSourceId", () => {
    for (const s of SUBJECT_BASES) {
      expect(s.name.trim()).not.toBe('')
      expect(s.nameRu.trim()).not.toBe('')
      expect(s.dataSourceId.trim()).not.toBe('')
    }
  })

  it("barcha fanlar mustaqil dataSourceId ga ega", () => {
    const dataSourceIds = SUBJECT_BASES.map((s) => s.dataSourceId)
    expect(new Set(dataSourceIds).size).toBe(dataSourceIds.length)
  })

  it("REGRESSIYA: kontenti yo'q fanlar available:false (FIXPLAN 4-punkt) — yangi " +
    "foydalanuvchi bo'sh ekranga tushmasin, faqat haqiqiy baza bilan fanlar tanlanadi", () => {
    const byId = Object.fromEntries(SUBJECT_BASES.map((s) => [s.id, s.available]))
    expect(byId['yhq']).toBe(true)       // 300 savol
    expect(byId['rustili']).toBe(true)   // 1000 savol
    expect(byId['fizika']).toBe(false)
    expect(byId['matematika']).toBe(false)
    expect(byId['kimyo']).toBe(false)
    expect(byId['ingliz']).toBe(false)
    expect(byId['tarix']).toBe(false)
    expect(byId['biologiya']).toBe(false)
  })
})

describe('backend registry — shared bilan sinxron', () => {
  it("registry'dagi fanlar soni shared bilan bir xil", () => {
    expect(SUBJECT_REGISTRY).toHaveLength(SUBJECT_BASES.length)
  })

  it("SUBJECT_IDS shared id'lariga teng", () => {
    expect(SUBJECT_IDS).toEqual(SUBJECT_BASES.map((s) => s.id))
  })

  it('isActive shared.available dan derive qilingan', () => {
    for (const base of SUBJECT_BASES) {
      const entry = SUBJECT_REGISTRY.find((s) => s.id === base.id)!
      expect(entry.isActive).toBe(base.available)
      expect(entry.demoData).toBe(base.demoData)
      expect(entry.dataSourceId).toBe(base.dataSourceId)
    }
  })

  it('DEFAULT_SUBJECT_ID backend va frontendda bir xil', () => {
    expect(SERVER_DEFAULT).toBe(CLIENT_DEFAULT)
  })

  it('har bir faol fan resolveSubject orqali o\'ziga resolve bo\'ladi (fallback emas!)', () => {
    for (const id of SUBJECT_IDS) {
      expect(resolveSubject(id).id).toBe(id)
    }
  })

  it("noma'lum subject default'ga fallback qiladi", () => {
    expect(resolveSubject('mavjud-emas').id).toBe(DEFAULT_SUBJECT_ID)
    expect(resolveSubject(undefined).id).toBe(DEFAULT_SUBJECT_ID)
  })
})

describe('frontend SUBJECTS — shared bilan sinxron', () => {
  it('frontend fanlar soni shared bilan bir xil', () => {
    expect(SUBJECTS).toHaveLength(SUBJECT_BASES.length)
  })

  it('har bir fanda UI xususiyatlari (ikonka, rang) vooyuda', () => {
    for (const s of SUBJECTS) {
      expect(typeof s.icon).toBeDefined()
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(s.colorDark).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("barcha shared id'lar frontendda mavjud", () => {
    expect(SUBJECTS.map((s) => s.id)).toEqual(
      SUBJECT_BASES.map((s) => s.id as SubjectId),
    )
  })

  it("getSubject noma'lum id'da default'ga tushadi", () => {
    expect(getSubject('mavjud-emas').id).toBe(DEFAULT_SUBJECT_ID)
  })
})

describe('questionKey / parseQuestionKey — multi-fan identity', () => {
  it('composite kalit formati "<subjectId>:<questionId>"', () => {
    expect(questionKey('yhq', 123)).toBe('yhq:123')
    expect(questionKey('fizika', 123)).toBe('fizika:123')
    // Bir xil questionId turli fanlarda chalkashmaydi
    expect(questionKey('yhq', 1)).not.toBe(questionKey('fizika', 1))
  })

  it('parseQuestionKey round-trip ishlaydi', () => {
    expect(parseQuestionKey('yhq:123')).toEqual({ subjectId: 'yhq', questionId: 123 })
    expect(parseQuestionKey('ingliz:7')).toEqual({ subjectId: 'ingliz', questionId: 7 })
  })

  it("noto'g'ri formatda null qaytaradi", () => {
    expect(parseQuestionKey('')).toBeNull()
    expect(parseQuestionKey(':123')).toBeNull()
    expect(parseQuestionKey('yhq:')).toBeNull()
    expect(parseQuestionKey('yhq:abc')).toBeNull()
    expect(parseQuestionKey('yhq:0')).toBeNull()
    expect(parseQuestionKey('yhq:-5')).toBeNull()
  })
})
