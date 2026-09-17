/**
 * AI Kurslar meta-generator — prompt/extract/semantics/fallback.
 *
 * Tarmoqqa CHIQMAYDI: fetch stub orqali (unit tez + deterministik).
 * Jonli kalit tekshiruvi qo'lda bajariladi (prod deploy'dan oldin).
 */
import { describe, it, expect } from 'vitest'
import {
  buildSectionsPrompt,
  buildSectionLessonsPrompt,
  extractJson,
  assertOutlineSemantics,
  generateCourseOutlineMeta,
  generateCourseOutline,
} from '../../../server/modules/ai-courses/meta-generator'
import { buildCourseOutline as buildMockOutline } from '../../../server/modules/ai-courses/mock-provider'
import {
  AiCoursePayloadSchema,
  aiCourseLessonCount,
  type AiCourseCreateInput,
  type AiCoursePayload,
} from '../../../shared/ai-courses'

const BASE: AiCourseCreateInput = {
  topic: 'Ingliz tili',
  inputKind: 'topic',
  inputRef: '',
  lessonLength: 'standard',
  language: 'uz',
}

function stubFetch(content: string, ok = true, status = 200) {
  return (async () => ({
    ok,
    status,
    text: async () => content,
    json: async () => ({ choices: [{ message: { content } }] }),
  })) as unknown as typeof fetch
}

function cannedOutlineJson(): string {
  const mock = buildMockOutline(BASE)
  return JSON.stringify({
    topic: 'Ingliz tili',
    sections: mock.sections.map((s) => ({
      title: s.title,
      lessons: s.lessons.map((l) => ({ title: l.title, tldr: l.tldr })),
    })),
  })
}

function cannedLessonsJson(): string {
  const mock = buildMockOutline(BASE)
  return JSON.stringify(
    mock.sections[0].lessons.map(({ id: _id, ord: _ord, ...rest }) => rest),
  )
}

/** 4-call oqimga mos stub: reja so'roviga outline, dars so'roviga lessons */
function stubFlow() {
  return (async (_url: unknown, init?: { body?: string }) => {
    const body = String((init as { body?: string })?.body ?? '')
    const content = body.includes('Kurs rejasi') ? cannedOutlineJson() : cannedLessonsJson()
    return {
      ok: true,
      status: 200,
      text: async () => content,
      json: async () => ({ choices: [{ message: { content } }] }),
    }
  }) as unknown as typeof fetch
}

describe('meta-generator — prompt', () => {
  it('uz/ru system + mavzu + 3×3 shakl promptda', () => {
    const uz = buildSectionsPrompt(BASE)
    expect(uz.system).toContain('JSON')
    expect(uz.user).toContain('Ingliz tili')
    const ru = buildSectionLessonsPrompt(
      { ...BASE, language: 'ru', lessonLength: 'deep' },
      'Sec', [{ title: 'T', tldr: 'Bu tldr kamida yigirma belgidan iborat matn.' }],
    )
    expect(ru.system).toContain('JSON')
    expect(ru.user).toContain('4 mashq')
  })
})

describe('meta-generator — extractJson', () => {
  it('yalang‘och JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('```json fence ichidan', () => {
    expect(extractJson('Mana:\n```json\n{"a":2}\n```')).toEqual({ a: 2 })
  })

  it('atrof matnli javobdan kesib oladi', () => {
    expect(extractJson('pre {"a":3} post')).toEqual({ a: 3 })
  })

  it('top-level array (section darslari)', () => {
    expect(extractJson('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('JSON yo‘q → throw', () => {
    expect(() => extractJson('salom dunyo')).toThrow()
  })
})

describe('meta-generator — assertOutlineSemantics', () => {
  it('valid mock outline o‘tadi', () => {
    expect(() => assertOutlineSemantics(buildMockOutline(BASE))).not.toThrow()
  })

  it('mcq correctOptionId begona → throw', () => {
    const p = buildMockOutline(BASE)
    const mcq = p.sections[0].lessons[0].practices.find((t) => t.kind === 'mcq')
    if (mcq?.kind !== 'mcq') throw new Error('fixture')
    mcq.correctOptionId = 'o99'
    expect(() => assertOutlineSemantics(p)).toThrow()
  })

  it('cloze javob pool‘da yo‘q → throw', () => {
    const p = buildMockOutline(BASE)
    const cloze = p.sections[0].lessons[0].practices.find((t) => t.kind === 'cloze')
    if (cloze?.kind !== 'cloze') throw new Error('fixture')
    cloze.pool = ['begona1', 'begona2']
    expect(() => assertOutlineSemantics(p)).toThrow()
  })
})

describe('meta-generator — generate (stub fetch)', () => {
  it('stub flow (1 outline + 3 parallel) → valid 3×3 payload', async () => {
    // Kalit test env'da bo'lmasa — kalit talabi o'zi throw.
    const { config } = await import('../../../server/config')
    if (!config.ai.metaApiKey) {
      await expect(generateCourseOutlineMeta(BASE, stubFlow())).rejects.toThrow()
      return
    }
    const { payload, topic } = await generateCourseOutlineMeta(BASE, stubFlow())
    expect(AiCoursePayloadSchema.safeParse(payload).success).toBe(true)
    expect(aiCourseLessonCount(payload)).toBe(9)
    expect(topic).toBe('Ingliz tili')
    // id/ord — server deterministik beradi
    expect(payload.sections[1].lessons[2].id).toBe('s2-l3')
    expect(payload.sections[1].lessons[2].ord).toBe(2)
  })

  it('stub 401 → generateCourseOutline mock fallback (hech qachon throw emas)', async () => {
    const { payload, generator } = await generateCourseOutline(
      BASE, stubFetch('{"title":"x"}', false, 401),
    )
    const parsed: AiCoursePayload = AiCoursePayloadSchema.parse(payload)
    expect(aiCourseLessonCount(parsed)).toBe(9)
    expect(generator).toBe('mock')
  })

  it('stub buzilgan JSON → mock fallback', async () => {
    const { payload, generator } = await generateCourseOutline(BASE, stubFetch('not-json{{{'))
    expect(AiCoursePayloadSchema.safeParse(payload).success).toBe(true)
    expect(generator).toBe('mock')
  })
})
