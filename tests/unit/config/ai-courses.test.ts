/**
 * AI Kurslar (shared/ai-courses.ts) — config integrity + SSOT himoyasi.
 *
 * Nega: quiz tip/text formatlari, limitlar va coin miqdorlari UI + server
 * orasida desync bo'lmasligi shart. Public strip + grading — scoring trust
 * boundary (ai-daily-test.test.ts pattern'i).
 */
import { describe, it, expect } from 'vitest'
import {
  AI_COURSE_FREE_MONTHLY_LIMIT,
  AI_COURSE_PREMIUM_MONTHLY_LIMIT,
  AI_COURSE_MOCK_SECTIONS,
  AI_COURSE_MOCK_LESSONS_PER_SECTION,
  AI_COURSE_COINS_PER_LESSON,
  AI_COURSE_LEDGER_REASON,
  AI_COURSE_INPUT_KINDS,
  AI_COURSE_PRACTICE_TYPES,
  AiCourseCreateSchema,
  AiCoursePayloadSchema,
  AiCourseAnswersSchema,
  toPublicCourseLesson,
  toPublicCoursePayload,
  gradeCoursePractices,
  isLessonFullyAnswered,
  shuffleSeeded,
  aiCourseLessonCount,
  findCourseLesson,
  type AiCourseLesson,
  type AiCourseAnswers,
} from '../../../shared/ai-courses'

function buildValidLesson(): AiCourseLesson {
  return {
    id: 's1-l1',
    ord: 0,
    title: 'Kirish',
    tldr: 'Bu darsning qisqa xulosasi — kamida yigirma belgidan iborat matn.',
    pages: [
      { kind: 'text', heading: 'Asos', body: 'Bu matn kamida yigirma belgidan iborat bo‘lishi shart, shuning uchun biroz uzun yozildi.' },
      {
        kind: 'visual', style: 'bar-chart', heading: 'Taqsimot',
        items: [{ label: 'A', value: 70 }, { label: 'B', value: 30 }],
      },
    ],
    practices: [
      { kind: 'flashcard', id: 'f1', prompt: 'Asosiy g‘oya nima?', answer: 'Kichik qadamlar.' },
      {
        kind: 'mcq', id: 'm1', prompt: 'Qaysi biri to‘g‘ri?',
        options: [{ id: 'o1', text: 'Bir' }, { id: 'o2', text: 'Ikki' }, { id: 'o3', text: 'Uch' }],
        correctOptionId: 'o2',
      },
      {
        kind: 'cloze', id: 'c1', prompt: 'Bo‘shliqni to‘ldiring',
        template: 'Odat {{c1}} dan boshlanadi va {{c2}} bilan mustahkamlanadi.',
        blanks: [{ id: 'c1', answer: 'kichik qadam' }, { id: 'c2', answer: 'takror' }],
        pool: ['takror', 'kichik qadam', 'dangasalik', 'shoshilish'],
      },
      {
        kind: 'order', id: 'r1', prompt: 'Tartiblang',
        steps: [{ id: 's1', text: 'Birinchi' }, { id: 's2', text: 'Ikkinchi' }, { id: 's3', text: 'Uchinchi' }],
      },
    ],
    knowledgeCards: [{ id: 'k1', title: 'Oltin qoida', body: 'Har kuni ozgina — lekin har kuni degan mazmunda o‘n belgidan uzun matn.' }],
  }
}

function buildValidPayload() {
  const sections = []
  for (let s = 0; s < 3; s++) {
    const lessons = []
    for (let l = 0; l < 3; l++) {
      const base = buildValidLesson()
      lessons.push({ ...base, id: `s${s + 1}-l${l + 1}`, ord: l })
    }
    sections.push({ id: `sec-${s + 1}`, ord: s, title: `Bo‘lim ${s + 1}`, lessons })
  }
  return { version: 1 as const, sections }
}

describe('config/ai-courses — konstantalar', () => {
  it('limitlar: free < premium; coin musbat; ledger reason yangi', () => {
    expect(AI_COURSE_FREE_MONTHLY_LIMIT).toBeGreaterThan(0)
    expect(AI_COURSE_PREMIUM_MONTHLY_LIMIT).toBeGreaterThan(AI_COURSE_FREE_MONTHLY_LIMIT)
    expect(AI_COURSE_COINS_PER_LESSON).toBeGreaterThan(0)
    expect(AI_COURSE_LEDGER_REASON).toBe('ai_course')
  })

  it('mock outline: 3 section × 3 dars (Wondering kichik formati)', () => {
    expect(AI_COURSE_MOCK_SECTIONS).toBe(3)
    expect(AI_COURSE_MOCK_LESSONS_PER_SECTION).toBe(3)
  })

  it('input kind + practice tiplari (Wondering QUIZ_TABS 1:1)', () => {
    expect([...AI_COURSE_INPUT_KINDS].sort()).toEqual(['chat', 'link', 'pdf', 'topic'])
    expect([...AI_COURSE_PRACTICE_TYPES].sort()).toEqual(['cloze', 'flashcard', 'mcq', 'order'])
  })
})

describe('config/ai-courses — create/payload sxema', () => {
  it('create: defaults + trim + chegaralar', () => {
    const parsed = AiCourseCreateSchema.parse({ topic: '  Ingliz tili  ' })
    expect(parsed.topic).toBe('Ingliz tili')
    expect(parsed.inputKind).toBe('topic')
    expect(parsed.lessonLength).toBe('standard')
    expect(parsed.language).toBe('uz')
    expect(() => AiCourseCreateSchema.parse({ topic: 'ab' })).toThrow()
  })

  it('valid payload o‘tadi (3×3)', () => {
    expect(AiCoursePayloadSchema.safeParse(buildValidPayload()).success).toBe(true)
  })

  it('1 section rad etiladi (min 2)', () => {
    const p = buildValidPayload()
    p.sections = p.sections.slice(0, 1)
    expect(AiCoursePayloadSchema.safeParse(p).success).toBe(false)
  })

  it('mcq: correctOptionId options ichida bo‘lishi shart emas (sxema) — grading tekshiradi', () => {
    // Sxema faqat struktura; semantik validatsiya mock-provider testida.
    expect(AiCoursePayloadSchema.safeParse(buildValidPayload()).success).toBe(true)
  })
})

describe('config/ai-courses — trust boundary', () => {
  it('toPublicCourseLesson: javob kalitlari STRIP', () => {
    const pub = toPublicCourseLesson(buildValidLesson())
    for (const p of pub.practices) {
      expect(p).not.toHaveProperty('correctOptionId')
      if (p.kind === 'cloze') {
        expect(p.blanks).toEqual([{ id: 'c1' }, { id: 'c2' }])
        expect(p.pool.length).toBe(4)
      }
    }
    // flashcard javobi — o‘rganish materiali sifatida OCHIQ qoladi
    const f = pub.practices.find((p) => p.kind === 'flashcard')
    expect(f).toHaveProperty('answer')
  })

  it('shuffle deterministik: bir xil seed = bir xil tartib, elementlar saqlanadi', () => {
    const a = shuffleSeeded([1, 2, 3, 4, 5], 'order:r1')
    const b = shuffleSeeded([1, 2, 3, 4, 5], 'order:r1')
    expect(a).toEqual(b)
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5])
  })

  it('toPublicCoursePayload: barcha darslar strip, soni saqlanadi', () => {
    const pub = toPublicCoursePayload(buildValidPayload())
    expect(aiCourseLessonCount(pub)).toBe(9)
    expect(findCourseLesson(pub, 's2-l1')?.sectionId).toBe('sec-2')
    expect(findCourseLesson(pub, 'yoq')).toBeNull()
  })
})

describe('config/ai-courses — grading', () => {
  const lesson = buildValidLesson()
  const full: AiCourseAnswers = {
    flashcard: { f1: 'known' },
    mcq: { m1: 'o2' },
    cloze: { c1: { c1: 'Kichik qadam!', c2: 'takror' } },
    order: { r1: ['s1', 's2', 's3'] },
  }

  it('to‘liq to‘g‘ri (cloze punktuatsiya/case tolerant)', () => {
    const g = gradeCoursePractices(lesson.practices, full)
    expect(g.correctCount).toBe(4)
    expect(g.totalCount).toBe(4)
  })

  it('xatolar ushlanadi (mcq noto‘g‘ri, order teskari, flashcard unknown)', () => {
    const g = gradeCoursePractices(lesson.practices, {
      flashcard: { f1: 'unknown' },
      mcq: { m1: 'o1' },
      cloze: { c1: { c1: 'xato', c2: 'takror' } },
      order: { r1: ['s3', 's2', 's1'] },
    })
    expect(g.correctCount).toBe(0)
    expect(g.perTask.m1.correct).toBe(false)
  })

  it('isLessonFullyAnswered: bo‘sh = false, to‘liq = true', () => {
    const empty = AiCourseAnswersSchema.parse({})
    expect(isLessonFullyAnswered(lesson.practices, empty)).toBe(false)
    expect(isLessonFullyAnswered(lesson.practices, full)).toBe(true)
  })
})
