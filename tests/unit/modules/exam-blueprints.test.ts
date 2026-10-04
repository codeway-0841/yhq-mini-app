import { describe, it, expect } from 'vitest'
import {
  RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT,
  RUSSIAN_ATTESTATSIYA_BLUEPRINT,
  getExamBlueprint,
  listAvailableBlueprints,
} from '../../../server/modules/admin/blueprints'
import { buildExamBlockPrompt } from '../../../server/modules/admin/exam-prompt-engine'

describe('Official Russian Exam Blueprints (UzBMB / 5ball.uz)', () => {
  describe('Milliy Sertifikat Blueprint', () => {
    it('has exactly 45 questions according to UzBMB Decree №646', () => {
      expect(RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.totalQuestions).toBe(45)
      expect(RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.durationMinutes).toBe(180)

      const totalAcrossBlocks = RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.blocks.reduce(
        (sum, b) => sum + b.questions.length,
        0
      )
      expect(totalAcrossBlocks).toBe(45)
    })

    it('has strictly sequential question numbers from 1 to 45', () => {
      const allNumbers = RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.blocks.flatMap((b) =>
        b.questions.map((q) => q.number)
      )
      expect(allNumbers).toEqual(Array.from({ length: 45 }, (_, i) => i + 1))
    })

    it('contains all 3 official blocks: Theory/Literature, Reading, and Matching/Analysis', () => {
      expect(RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.blocks).toHaveLength(3)

      const [block1, block2, block3] = RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.blocks

      // Block 1: №1–17
      expect(block1.startNumber).toBe(1)
      expect(block1.endNumber).toBe(17)
      expect(block1.questions).toHaveLength(17)

      // Block 2: №18–32 (Reading literacy - 15 questions)
      expect(block2.startNumber).toBe(18)
      expect(block2.endNumber).toBe(32)
      expect(block2.questions).toHaveLength(15)
      expect(block2.sharedContextPrompt).toBeDefined()

      // Block 3: №33–45 (Matching & advanced analysis)
      expect(block3.startNumber).toBe(33)
      expect(block3.endNumber).toBe(45)
      expect(block3.questions).toHaveLength(13)
    })

    it('contains matching questions (4-to-4) at №33, №34, №35', () => {
      const block3 = RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.blocks[2]
      const matchingQ = block3.questions.filter((q) => q.type === 'matching')
      expect(matchingQ.map((q) => q.number)).toEqual([33, 34, 35])
    })
  })

  describe('Attestatsiya Blueprint', () => {
    it('has exactly 50 questions (40 subject + 10 pedagogy/4K)', () => {
      expect(RUSSIAN_ATTESTATSIYA_BLUEPRINT.totalQuestions).toBe(50)
      expect(RUSSIAN_ATTESTATSIYA_BLUEPRINT.durationMinutes).toBe(120)

      const totalAcrossBlocks = RUSSIAN_ATTESTATSIYA_BLUEPRINT.blocks.reduce(
        (sum, b) => sum + b.questions.length,
        0
      )
      expect(totalAcrossBlocks).toBe(50)
    })

    it('has strictly sequential question numbers from 1 to 50', () => {
      const allNumbers = RUSSIAN_ATTESTATSIYA_BLUEPRINT.blocks.flatMap((b) =>
        b.questions.map((q) => q.number)
      )
      expect(allNumbers).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
    })

    it('contains 10 pedagogy, methodology and 4K questions in block 3 (№41–50)', () => {
      const block3 = RUSSIAN_ATTESTATSIYA_BLUEPRINT.blocks[2]
      expect(block3.startNumber).toBe(41)
      expect(block3.endNumber).toBe(50)
      expect(block3.questions).toHaveLength(10)

      const topics = block3.questions.map((q) => q.topic)
      expect(topics.some((t) => t.includes('Критическое мышление'))).toBe(true)
      expect(topics.some((t) => t.includes('Креативность'))).toBe(true)
      expect(topics.some((t) => t.includes('Коллаборация'))).toBe(true)
      expect(topics.some((t) => t.includes('Коммуникация'))).toBe(true)
      expect(topics.some((t) => t.includes('Критериальное оценивание'))).toBe(true)
    })
  })

  describe('Blueprint Registry', () => {
    it('retrieves blueprints correctly by subjectId and examType', () => {
      const milliy = getExamBlueprint('rustili', 'milliy-sertifikat')
      expect(milliy).toBeDefined()
      expect(milliy?.totalQuestions).toBe(45)

      const attest = getExamBlueprint('rustili', 'attestatsiya')
      expect(attest).toBeDefined()
      expect(attest?.totalQuestions).toBe(50)

      const unknown = getExamBlueprint('nonexistent', 'milliy-sertifikat')
      expect(unknown).toBeUndefined()
    })

    it('lists available blueprints', () => {
      const list = listAvailableBlueprints()
      expect(list.length).toBeGreaterThanOrEqual(2)
      expect(list.some((b) => b.subjectId === 'rustili' && b.examType === 'milliy-sertifikat')).toBe(true)
    })
  })

  describe('Prompt Engine', () => {
    it('builds comprehensive block prompt with all instructions and JSON schema', () => {
      const block = RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT.blocks[0]
      const { systemInstruction, userPrompt } = buildExamBlockPrompt(
        RUSSIAN_MILLIY_SERTIFIKAT_BLUEPRINT,
        block,
        1
      )

      expect(systemInstruction).toContain('UzBMB')
      expect(systemInstruction).toContain('дистракторов')
      expect(systemInstruction).toContain('"A1", "A2", "A3", "A4"')
      expect(userPrompt).toContain('Вопрос №1:')
      expect(userPrompt).toContain('Вопрос №17:')
      expect(userPrompt).toContain('Фонетика, графика и орфоэпия')
    })
  })
})
