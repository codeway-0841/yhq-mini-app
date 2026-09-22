/**
 * AI Kurslar mock-provider — outline determinizm + sxema validligi.
 *
 * Nega: mock outline DB'ga yozilishdan oldin AiCoursePayloadSchema'dan o'tishi
 * SHART (router'da qayta validatsiya bor, lekin generatorning o'zi buzilsa
 * har create 500 beradi). Semantik invariantlar: mcq correctOptionId options
 * ichida, cloze blank javoblari pool'da, order step id'lar unikal.
 */
import { describe, it, expect } from 'vitest'
import { buildCourseOutline } from '../../../server/modules/ai-courses/mock-provider'
import {
  AiCoursePayloadSchema,
  aiCourseLessonCount,
  type AiCourseCreateInput,
} from '../../../shared/ai-courses'

const BASE: AiCourseCreateInput = {
  topic: 'Ingliz tili',
  inputKind: 'topic',
  inputRef: '',
  lessonLength: 'standard',
  language: 'uz',
}

describe('ai-courses mock-provider', () => {
  it('uz + ru outline sxemadan o‘tadi, 3 section × 3 dars = 9', () => {
    for (const language of ['uz', 'ru'] as const) {
      const payload = buildCourseOutline({ ...BASE, language })
      expect(AiCoursePayloadSchema.safeParse(payload).success).toBe(true)
      expect(payload.sections.length).toBe(3)
      expect(aiCourseLessonCount(payload)).toBe(9)
      expect(payload.outcomes).toHaveLength(4)
    }
  })

  it('deterministik: bir xil mavzu = bir xil outline', () => {
    const a = buildCourseOutline(BASE)
    const b = buildCourseOutline({ ...BASE })
    expect(a).toEqual(b)
  })

  it('sarlavhalar QISQA, xom gap ko‘chirilmaydi (Wondering pattern)', () => {
    const p = buildCourseOutline({ ...BASE, topic: 'fizikadan termodinamika mavzusida kurs qilish kerak' })
    for (const s of p.sections) {
      expect(s.title.length).toBeLessThanOrEqual(40)
      expect(s.title).not.toContain('kurs qilish kerak')
      for (const l of s.lessons) {
        expect(l.title.length).toBeLessThanOrEqual(60)
        expect(l.title).not.toContain('kurs qilish kerak')
      }
    }
    // Mavzu baribir matnlarda bor (tldr/pages)
    expect(p.sections[0].lessons[0].tldr).toContain('Fizikadan termodinamika')
  })

  it('semantik invariantlar (mcq/cloze/order javoblari izchil)', () => {
    const payload = buildCourseOutline(BASE)
    for (const s of payload.sections) {
      for (const l of s.lessons) {
        expect(l.tldr.length).toBeGreaterThanOrEqual(20)
        expect(l.pages.length).toBeGreaterThanOrEqual(1)
        expect(l.knowledgeCards.length).toBeGreaterThanOrEqual(1)
        for (const p of l.practices) {
          if (p.kind === 'mcq') {
            expect(p.options.map((o) => o.id)).toContain(p.correctOptionId)
          }
          if (p.kind === 'cloze') {
            const answers = p.blanks.map((b) => b.answer)
            for (const a of answers) expect(p.pool).toContain(a)
            for (const b of p.blanks) expect(p.template).toContain(`{{${b.id}}}`)
          }
          if (p.kind === 'order') {
            const ids = p.steps.map((st) => st.id)
            expect(new Set(ids).size).toBe(ids.length)
          }
        }
      }
    }
  })

  it('har darsda kamida mcq + yana 1 interaktiv tip bor', () => {
    const payload = buildCourseOutline(BASE)
    for (const s of payload.sections) {
      for (const l of s.lessons) {
        const kinds = new Set(l.practices.map((p) => p.kind))
        expect(kinds.has('mcq')).toBe(true)
        expect(l.practices.length).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
