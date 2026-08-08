/**
 * Exam presets consistency — shared/exam-presets ↔ shared/subjects desync himoyasi.
 *
 * Fanning `examPresets` ro'yxatidagi har id EXAM_PRESETS'da bo'lishi SHART,
 * aks holda TestlarPage preset kartasini jimgina o'tkazib yuborardi.
 */
import { describe, it, expect } from 'vitest'
import { EXAM_PRESETS, getExamPreset, resolveExamMode } from '../../../shared/exam-presets'
import { SUBJECT_BASES, DEFAULT_SUBJECT_ID } from '../../../shared/subjects'

describe('shared/exam-presets — data integrity', () => {
  it("preset id'lari unikal", () => {
    const ids = EXAM_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("rasmiy formatlar to'g'ri parametrlarga ega (DTM talablar)", () => {
    expect(getExamPreset('milliy-sertifikat')).toMatchObject({ questionCount: 45, durationMinutes: 180 })
    expect(getExamPreset('attestatsiya')).toMatchObject({ questionCount: 50, durationMinutes: 120 })
  })

  it('savollar soni va muddat mantiqan musbat', () => {
    for (const p of EXAM_PRESETS) {
      expect(p.questionCount).toBeGreaterThan(0)
      expect(p.durationMinutes).toBeGreaterThan(0)
    }
  })
})

describe('subjects.examPresets — presets bilan sinxron', () => {
  it("har bir subject preset id'i EXAM_PRESETS'da mavjud", () => {
    const validIds = new Set(EXAM_PRESETS.map((p) => p.id))
    for (const s of SUBJECT_BASES) {
      for (const pid of s.examPresets) {
        expect(validIds.has(pid), `${s.id} → "${pid}" preset'i topilmadi`).toBe(true)
      }
    }
  })

  it('DEFAULT fan (YHQ) preset ishlatmaydi — o\'z mock formati bor', () => {
    expect(SUBJECT_BASES.find((s) => s.id === DEFAULT_SUBJECT_ID)?.examPresets).toEqual([])
  })
})

describe('resolveExamMode', () => {
  it("'exam:<presetId>' formatini resolve qiladi", () => {
    expect(resolveExamMode('exam:milliy-sertifikat')?.questionCount).toBe(45)
    expect(resolveExamMode('exam:attestatsiya')?.durationMinutes).toBe(120)
  })

  it("noma'lum preset id → null", () => {
    expect(resolveExamMode('exam:mavjud-emas')).toBeNull()
  })

  it("boshqa modellar va null → null (legacy 'exam' alohida)", () => {
    expect(resolveExamMode('exam')).toBeNull()
    expect(resolveExamMode('mock')).toBeNull()
    expect(resolveExamMode('random50')).toBeNull()
    expect(resolveExamMode(null)).toBeNull()
    expect(resolveExamMode(undefined)).toBeNull()
  })
})
