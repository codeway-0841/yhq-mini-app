/**
 * AI Kurslar REAL generatori (Meta Model API, https://api.meta.ai/v1).
 *
 *  - Kirish: AiCourseCreateInput (mavzu/til/chuqurlik) → chiqish: AiCoursePayload
 *  - 4 PARALLEL chaqiriq (ai-tests generator pattern'i): avval outline
 *    (3 section × sarlavha+tldr, ~10s), keyin har section darslari 3 ta
 *    parallel chaqiriqda (~20s). Bitta ulkan chaqiriq token limiti (6000)
 *    va Vercel 60s'ga sig'magani uchun bo'lingan (o'lchangan: 1 call ~52s).
 *  - Har javob: extractJson → zod → semantik check. Hammasi yiqilsa throw →
 *    caller (generateCourseOutline) mock'ga tushadi.
 *  - Model FAQAT muse-spark-1.3 (fallback yo'q). reasoning_effort=minimal
 *    (reasoning tokenlar output byudjetdan yeydi — dev.meta.ai/docs/reasoning).
 *  - Kalit yo'q yoki Meta API yiqilsa → mock-provider (UX hech qachon 500
 *    yemaydi; qaysi generator ishlagani `generator` maydonida qaytadi).
 *
 * XAVFSIZLIK: kalit FAQAT config.ai.metaApiKey orqali (server/config zod) —
 * bu faylda process.env O'QILMAYDI, kalit log'ga CHIQMAYDI.
 */

import { z } from 'zod'
import { config } from '../../config'
import {
  AI_COURSE_MOCK_LESSONS_PER_SECTION,
  AI_COURSE_MOCK_SECTIONS,
  AiCourseLessonSchema,
  AiCoursePayloadSchema,
  cleanTopicForTitle,
  type AiCourseCreateInput,
  type AiCourseLesson,
  type AiCoursePayload,
  type AiCoursePractice,
} from '../../../shared/ai-courses'
import { buildCourseOutline as buildMockOutline } from './mock-provider'
import { aiCoursesRepository } from './ai-courses.repository'

export const META_BASE_URL = 'https://api.meta.ai/v1'

/** Faqat muse-spark-1.3 (fallback YO'Q — user talabi) */
const META_MODEL = 'muse-spark-1.3'

/** Outline chaqiriq'i kichik (~800 token) — reasoning bilan 3500 token, 45s */
const OUTLINE_TIMEOUT_MS = 45_000
const OUTLINE_MAX_TOKENS = 3500
/** Section darslari (~1800 token) — reasoning bilan 4500 token, 55s */
const LESSONS_TIMEOUT_MS = 55_000
const LESSONS_MAX_TOKENS = 4500

type FetchFn = typeof fetch

// ── Prompt (sof funksiya — testlar uchun export) ─────────────────────────────

const SHAPE_BY_LENGTH: Record<AiCourseCreateInput['lessonLength'], { pages: string; practices: string }> = {
  short: {
    pages: '2 sahifa: 1 matn + 1 vizual',
    practices: '2 mashq: 1 mcq + 1 flashcard',
  },
  standard: {
    pages: '3 sahifa: matn + vizual + matn',
    practices: '3 mashq: 1 mcq + 1 cloze + 1 flashcard (toq darslarda) yoki 1 order (juft darslarda)',
  },
  deep: {
    pages: '4 sahifa: matn + vizual + matn + vizual',
    practices: '4 mashq: 1 mcq + 1 cloze + 1 order + 1 flashcard',
  },
}

export function buildSectionsPrompt(input: AiCourseCreateInput): { system: string; user: string } {
  const isEn = input.language === 'en'
  const isRu = input.language === 'ru'
  const system = isEn
    ? `You are a world-class curriculum architect in the style of Wondering. Return ONLY valid JSON: no explanations, no markdown, no code-fences. All texts in English.`
    : isRu
      ? `Ты — архитектор образовательных курсов в стиле Wondering. Возвращай ТОЛЬКО запрошенный JSON: без пояснений, без markdown, без code-fence. Все тексты на русском языке.`
      : `Sen — Wondering uslubidagi dunyo darajasidagi ta'lim me'morisan (curriculum architect). Faqat SO'RALGAN JSON'ni qaytarasan: izohsiz, markdown'siz, kod-panjara'siz. Barcha matnlar O'zbek tilida.`

  const personalizationLines: string[] = []
  if (input.learnerRole) personalizationLines.push(`Learner role: ${input.learnerRole}`)
  if (input.backgroundLevel) personalizationLines.push(`Background level: ${input.backgroundLevel}`)
  if (input.learningGoal) personalizationLines.push(`Learning goal: ${input.learningGoal}`)
  const pBlock = personalizationLines.length > 0 ? personalizationLines.join('\n') + '\n' : ''

  const user = `[AI Plan Curriculum Brief]
${pBlock}Foydalanuvchi so'rovi / User prompt: "${input.topic}" (${input.inputKind})
Course plan: EXACTLY ${AI_COURSE_MOCK_SECTIONS} sections, each having EXACTLY ${AI_COURSE_MOCK_LESSONS_PER_SECTION} lessons.

PEDAGOGICAL REQUIREMENTS (Wondering standards):
- "The first lesson has to earn the second": Section 1 Lesson 1 must start immediately with an intuitive real-world hook or paradox the learner recognizes, before advancing into theoretical depth.
- Provide a compelling "hook" (provocative question), "meaning" (why this matters and what breaks without it), "objective" (clear mastery goal), and "likelyConfusion" (common misconception) for every lesson.
- Bo'sh gaplar / filler phrases ("in this lesson we will learn", "very important", "conclusion") are STRICTLY FORBIDDEN.

NAMING RULES:
- "topic": 2-4 words CLEAN course title (e.g. "Quantum Physics", "Termodinamika Asoslari", "Python Fundamentals").
- Section "title": 1-3 words short name ("Basics", "Core Systems") prefixed with "N. ".
- Lesson "title": 2-5 words ("Photon Energy", "Wave-Particle Duality").
- "tldr": single punchy sentence (≤150 chars).
- "hook": tension question (≤200 chars).
- "meaning": why it is essential (≤250 chars).
- "objective": precise takeaway (≤200 chars).
- "likelyConfusion": common trap or misconception (≤200 chars).
- "outcomes": 4 concrete outcomes at the end of course.
STRICT JSON: {"topic":"...","outcomes":["...","...","...","..."],"sections":[{"title":"1. ...","lessons":[{"title":"...","tldr":"...","hook":"...","meaning":"...","objective":"...","likelyConfusion":"..."},...]},...]}`
  return { system, user }
}

export interface LessonBlueprint {
  title: string
  tldr: string
  hook?: string
  meaning?: string
  objective?: string
  likelyConfusion?: string
}

export function buildSectionLessonsPrompt(
  input: AiCourseCreateInput,
  sectionTitle: string,
  blueprints: LessonBlueprint[],
): { system: string; user: string } {
  const isEn = input.language === 'en'
  const isRu = input.language === 'ru'
  const shape = SHAPE_BY_LENGTH[input.lessonLength]
  const system = isEn
    ? `You are a lesson author in the style of Wondering. Return ONLY requested JSON: no explanations, no markdown, no code-fences. All texts in English.`
    : isRu
      ? `Ты — автор уроков в стиле Wondering. Возвращай ТОЛЬКО запрошенный JSON: без пояснений, без markdown, без code-fence. Все тексты на русском языке.`
      : `Sen — Wondering uslubidagi dars muallifisan. Faqat SO'RALGAN JSON'ni qaytarasan: izohsiz, markdown'siz, kod-panjara'siz. Barcha matnlar O'zbek tilida.`
  const lessonList = blueprints.map((b, i) => {
    let s = `${i + 1}. "${b.title}" — ${b.tldr}`
    if (b.hook) s += ` | Hook: ${b.hook}`
    if (b.meaning) s += ` | Meaning: ${b.meaning}`
    if (b.objective) s += ` | Maqsad: ${b.objective}`
    if (b.likelyConfusion) s += ` | Keng tarqalgan xato: ${b.likelyConfusion}`
    return s
  }).join('\n')

  const user = `Mavzu/Тема: "${input.topic}". Bo'lim/Раздел: "${sectionTitle}".
${input.learnerRole ? `O'quvchi roli: ${input.learnerRole}. ` : ''}${input.learningGoal ? `Maqsad: ${input.learningGoal}.` : ''}
Shu bo'limning ROVNO ${blueprints.length} darsini to'liq yoz (id/ord KERAK EMAS — faqat ichki maydonlar):
${lessonList}

Dars title/tldr YUQORIDAGI ro'yxatdan AYNAN olinsin (o'zgartirmang, foydalanuvchi gapini qo'shmang).

WONDERING GAP TUZISH VA MATN QOIDALARI:
- Har bir matn sahifasida QALIN BOSHLANG'ICH ATAMALAR (**Atama** — ta'rif/misol/ziddiyat) qo'llansin.
- Har sahifada BITTA aniq misol yoki ziddiyat (trade-off) ko'rsatilsin.
- Dars matnida o'quvchining ehtimoliy xato tasavvuri (likelyConfusion) tahlil qilinib, to'g'ri mental model qurilsin.
- MCQ mashqi aynan shu xato tasavvurni tekshirishga (misconception check) xizmat qilsin: chalg'ituvchi variant aynan odamlar adashadigan stereotip bo'lsin!
- Kalit atamalarni matn ichida [[atama|qisqa tushuntirish]] formatida yozing (masalan, [[Eventual Consistency|Barcha replikalar vaqt o'tishi bilan bir xil holatga kelishi kafolati]]). Bu interaktiv popover uchun kerak!
- Bo'sh iboralar QAT'IYAN TAQIQLANADI ("bu darsda o'rganamiz", "juda muhim", "albatta yodlang", "xulosa qilib aytganda" kabi).
- Matn body: 140-300 belgi. Bilim kartasi body: ≤150 belgi. Variant/step: ≤60 belgi.

- "pages": ${shape.pages}. Matn: {"kind":"text","heading":"...","body":"..."}.
  Vizual: {"kind":"visual","style":"bar-chart"|"pie-chart"|"cycle","heading":"...","items":[{"label":"...","value":0-100}]} (2-4 items).
- "practices": ${shape.practices}.
  mcq: {"kind":"mcq","id":"...-mcq","prompt":"...","options":[{"id":"o1","text":"..."},{"id":"o2","text":"..."},{"id":"o3","text":"..."}],"correctOptionId":"o2"} — correctOptionId variantlar ICHIDA.
  cloze: {"kind":"cloze","id":"...-cloze","prompt":"...","template":"... {{c1}} ... {{c2}} ...","blanks":[{"id":"c1","answer":"..."}],"pool":["javob","...","chalg'ituvchi"]} — pool'da blank javoblari + 1 chalg'ituvchi; pool so'zlari TAKRORLANMASIN, ikki blankka bir xil javob TAQIQLANADI.
  order: {"kind":"order","id":"...-order","prompt":"...","steps":[{"id":"st1","text":"..."},...]} — steps TO'G'RI tartibda (3-4 qadam).
  flashcard: {"kind":"flashcard","id":"...-flash","prompt":"savol","answer":"qisqa javob"}.
- "knowledgeCards": 2 ta {"id":"...-k1","title":"...","body":"..."}.
- Har dars title/tldr YUQORIDAGI ro'yxatdan olinsin (o'zgartirmang).

STRICT JSON — darslar massivi: [{...},{...},{...}]`
  return { system, user }
}

// ── AI javob sxemalari (zod — qat'iy darvoza) ────────────────────────────────

export const SectionsAiSchema = z.object({
  /** 2-4 so'zli toza kurs nomi — kurs sarlavhasi SHU bo'ladi */
  topic: z.string().min(3).max(60),
  /** Kurs yakunida 4 natija (Wondering "What you will achieve") */
  outcomes: z.array(z.string().min(5).max(200)).length(4),
  sections: z.array(z.object({
    title: z.string().min(1).max(60),
    lessons: z.array(z.object({
      title: z.string().min(1).max(80),
      tldr: z.string().min(20).max(500),
      hook: z.string().max(300).optional(),
      meaning: z.string().max(500).optional(),
      objective: z.string().max(300).optional(),
      likelyConfusion: z.string().max(300).optional(),
    })).length(AI_COURSE_MOCK_LESSONS_PER_SECTION),
  })).length(AI_COURSE_MOCK_SECTIONS),
})

export type CourseBlueprint = z.infer<typeof SectionsAiSchema>
export type OutlineSection = CourseBlueprint['sections'][number]

const LessonAiSchema = AiCourseLessonSchema.omit({ id: true, ord: true })
const SectionLessonsAiSchema = z.array(LessonAiSchema).length(AI_COURSE_MOCK_LESSONS_PER_SECTION)
export type SectionLessons = z.infer<typeof SectionLessonsAiSchema>

/**
 * Bitta section darslari: Meta chaqiriq + 1 retry; ikkalasi ham yiqilsa —
 * mock darslar (outline sarlavhalar saqlanadi, ichi zaxira).
 */
async function genSectionLessons(
  apiKey: string,
  input: AiCourseCreateInput,
  section: OutlineSection,
  si: number,
  fetchFn: FetchFn,
): Promise<SectionLessons> {
  const prompt = buildSectionLessonsPrompt(input, section.title, section.lessons)
  let lastError = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callMetaJson(apiKey, prompt.system, prompt.user, fetchFn, {
        timeoutMs: LESSONS_TIMEOUT_MS, maxTokens: LESSONS_MAX_TOKENS,
      })
      return SectionLessonsAiSchema.parse(raw)
    } catch (err) {
      lastError = (err as Error)?.message ?? 'network'
      console.warn(`[ai-course-meta] sec-${si + 1} urinish ${attempt}:`, lastError.slice(0, 120))
    }
  }
  // Zaxira: mock darslar + outline sarlavha/tldr (sxema-validligi kafolatli)
  console.warn(`[ai-course-meta] sec-${si + 1} mock fallback (${lastError.slice(0, 80)})`)
  const mock = buildMockOutline(input).sections[si % AI_COURSE_MOCK_SECTIONS]
  return mock.lessons.map((l, li) => {
    const { id: _id, ord: _ord, ...rest } = l
    const blueprint = section.lessons[li % section.lessons.length]
    return {
      ...rest,
      title: blueprint.title,
      tldr: blueprint.tldr,
      hook: blueprint.hook || l.hook,
      meaning: blueprint.meaning || l.meaning,
      objective: blueprint.objective || l.objective,
      likelyConfusion: blueprint.likelyConfusion || l.likelyConfusion,
    }
  })
}

// ── JSON extract (markdown fence'larni tozalaydi) ────────────────────────────

export function extractJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const text = (fence ? fence[1] : raw).trim()

  // 1. Direct parse
  try {
    return JSON.parse(text)
  } catch {
    // continue
  }

  // 2. Outermost slice
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  const firstBracket = text.indexOf('[')
  const lastBracket = text.lastIndexOf(']')

  const isArrayFirst = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
  const isObjectFirst = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)

  if (isArrayFirst && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.slice(firstBracket, lastBracket + 1))
    } catch {
      // continue to scanner
    }
  }

  if (isObjectFirst && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1))
    } catch {
      // continue to scanner
    }
  }

  // 3. Balanced scanner
  const open = text.search(/[[{]/)
  if (open === -1) throw new Error('JSON topilmadi')
  const closeFor: Record<string, string> = { '{': '}', '[': ']' }
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') stack.push(closeFor[ch])
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop()
        if (stack.length === 0) {
          try {
            return JSON.parse(text.slice(open, i + 1))
          } catch {
            // continue searching
          }
        }
      }
    }
  }
  throw new Error('JSON topilmadi')
}

// ── Semantik check (sxemadan keyingi darvoza) ────────────────────────────────

export function assertOutlineSemantics(payload: AiCoursePayload): void {
  for (const s of payload.sections) {
    for (const l of s.lessons) {
      const ids = new Set<string>()
      for (const p of l.practices) {
        if (ids.has(p.id)) throw new Error(`lesson ${l.id}: practice id takrorlangan (${p.id})`)
        ids.add(p.id)
        if (p.kind === 'mcq' && !p.options.some((o) => o.id === p.correctOptionId)) {
          throw new Error(`mcq ${p.id}: correctOptionId options'da yo'q`)
        }
        if (p.kind === 'cloze') {
          const seenAnswers = new Set<string>()
          for (const b of p.blanks) {
            if (!p.template.includes(`{{${b.id}}}`)) throw new Error(`cloze ${p.id}: template'da {{${b.id}}} yo'q`)
            if (!p.pool.includes(b.answer)) throw new Error(`cloze ${p.id}: javob pool'da yo'q`)
            if (seenAnswers.has(b.answer)) throw new Error(`cloze ${p.id}: bir xil javob takrorlangan`)
            seenAnswers.add(b.answer)
          }
          if (new Set(p.pool).size !== p.pool.length) throw new Error(`cloze ${p.id}: pool'da takror so'z`)
        }
        if (p.kind === 'order') {
          const stepIds = p.steps.map((st) => st.id)
          if (new Set(stepIds).size !== stepIds.length) throw new Error(`order ${p.id}: step id takrorlangan`)
        }
      }
    }
  }
}

// ── Meta chaqiriq ────────────────────────────────────────────────────────────

interface MetaChatResponse {
  choices?: { message?: { content?: string } }[]
}

export async function callMetaJson(
  apiKey: string,
  system: string,
  user: string,
  fetchFn: FetchFn,
  opts: { timeoutMs: number; maxTokens: number },
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    const res = await fetchFn(`${META_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: META_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
        // Outline — struktural JSON, chuqur mulohaza kerak emas: minimal
        // reasoning latency + narxni keskin kamaytiradi (reasoning tokenlar
        // output byudjetdan yeydi — dev.meta.ai/docs/reasoning).
        reasoning_effort: 'minimal',
        max_completion_tokens: opts.maxTokens,
        stream: false,
      }),
    })
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 150)
      throw new Error(`HTTP ${res.status} ${snippet}`)
    }
    const json = (await res.json()) as MetaChatResponse
    const text = json.choices?.[0]?.message?.content
    if (!text) throw new Error(`bo'sh javob`)
    return extractJson(text)
  } finally {
    clearTimeout(timeout)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export type CourseGenerator = 'meta' | 'mock'

/**
 * Real Meta generatsiya: 1 outline + 3 parallel section chaqiriq'i.
 * Yiqilsa throw — caller (generateCourseOutline) mock'ga tushadi.
 */
export async function generateCourseOutlineMeta(
  input: AiCourseCreateInput,
  fetchFn: FetchFn = fetch,
): Promise<{ payload: AiCoursePayload; topic: string }> {
  const apiKey = config.ai.metaApiKey
  if (!apiKey) throw new Error('META_API_KEY sozlanmagan')

  try {
    // 1-bosqich: reja (sarlavhalar + tldr + outcomes) — kichik va tez
    const outlinePrompt = buildSectionsPrompt(input)
    const outlineRaw = await callMetaJson(apiKey, outlinePrompt.system, outlinePrompt.user, fetchFn, {
      timeoutMs: OUTLINE_TIMEOUT_MS, maxTokens: OUTLINE_MAX_TOKENS,
    })
    const outline = SectionsAiSchema.parse(outlineRaw)

    // 2-bosqich: har section darslari — 3 ta PARALLEL chaqiriq.
    // Har section alohida himoyalangan: 1 retry, oxirida mock darslar
    // (bitta yomon section butun kursni mock'ga tushirmaydi).
    const sectionPayloads = await Promise.all(
      outline.sections.map(async (section, si) => {
        const lessons = await genSectionLessons(apiKey, input, section, si, fetchFn)
        const full: AiCourseLesson[] = lessons.map((l, li) => {
          const lessonId = `s${si + 1}-l${li + 1}`
          const blueprint = section.lessons[li]
          return {
            ...l,
            // BARCHA id'lar server deterministik beradi (AI ixtiyoriga topshirilmaydi —
            // section'lararo takrorlanish collateral'i shu bilan yopiladi)
            id: lessonId,
            ord: li,
            title: blueprint.title,
            tldr: blueprint.tldr,
            hook: blueprint.hook || l.hook,
            meaning: blueprint.meaning || l.meaning,
            objective: blueprint.objective || l.objective,
            likelyConfusion: blueprint.likelyConfusion || l.likelyConfusion,
            practices: l.practices.map((p, pi) => ({ ...p, id: `${lessonId}-${p.kind}-${pi}` })),
            knowledgeCards: l.knowledgeCards.map((c, ci) => ({ ...c, id: `${lessonId}-k${ci + 1}` })),
          }
        })
        return {
          id: `sec-${si + 1}`,
          ord: si,
          title: section.title,
          lessons: full,
        }
      }),
    )

    const payload = AiCoursePayloadSchema.parse({ version: 1, outcomes: outline.outcomes, sections: sectionPayloads })
    assertOutlineSemantics(payload)
    return { payload, topic: outline.topic }
  } catch (err) {
    const lastError = (err as Error)?.message ?? 'network'
    console.warn('[ai-course-meta]', lastError.slice(0, 160))
    throw new Error(`Meta generatsiya yiqildi: ${lastError.slice(0, 120)}`, { cause: err })
  }
}

export { genSectionLessons as synthesizeSectionLessons }

/**
 * 1-bosqich: Tezkor blueprint (reja, mavzular, pedagogik passportlar) — ~4-6s.
 */
export async function generateCourseBlueprintMeta(
  input: AiCourseCreateInput,
  fetchFn: FetchFn = fetch,
): Promise<{ blueprint: CourseBlueprint; topic: string }> {
  const apiKey = config.ai.metaApiKey
  if (!apiKey) throw new Error('META_API_KEY sozlanmagan')

  const outlinePrompt = buildSectionsPrompt(input)
  const outlineRaw = await callMetaJson(apiKey, outlinePrompt.system, outlinePrompt.user, fetchFn, {
    timeoutMs: OUTLINE_TIMEOUT_MS, maxTokens: OUTLINE_MAX_TOKENS,
  })
  const blueprint = SectionsAiSchema.parse(outlineRaw)
  return { blueprint, topic: blueprint.topic }
}

/**
 * Blueprint asosida darhol to'liq va o'ynaladigan AiCoursePayload tuzish (0-latency seed).
 */
export function buildPayloadFromBlueprint(
  input: AiCourseCreateInput,
  blueprint: CourseBlueprint,
): AiCoursePayload {
  const lang = input.language === 'ru' ? 'ru' : input.language === 'en' ? 'en' : 'uz'
  const isRu = lang === 'ru'
  const isEn = lang === 'en'

  const sections = blueprint.sections.map((sec, si) => {
    const lessons: AiCourseLesson[] = sec.lessons.map((b, li) => {
      const lessonId = `s${si + 1}-l${li + 1}`
      const hookText = b.hook || (isEn ? `How does ${b.title} work under real pressure?` : isRu ? `Как работает «${b.title}» в реальных условиях?` : `Qanday qilib «${b.title}» amaliyotda ishlaydi?`)
      const meaningText = b.meaning || b.tldr
      const objectiveText = b.objective || (isEn ? `Master core mechanics of ${b.title}` : isRu ? `Освоить основы «${b.title}»` : `«${b.title}» asosiy mexanizmlarini o'zlashtirish`)
      const confusionText = b.likelyConfusion || (isEn ? `Assuming memorization replaces intuitive understanding` : isRu ? `Ошибочное предположение, что механическое заучивание заменяет понимание` : `Yodlash tushunish o'rnini bosa oladi deb o'ylash`)

      const page1Body = isEn
        ? `**Core Principle** — ${meaningText}\n\n**Common Trap** — ${confusionText}. Focus on the underlying mental model rather than superficial facts.`
        : isRu
          ? `**Ключевой принцип** — ${meaningText}\n\n**Частая ловушка** — ${confusionText}. Фокусируйтесь на ментальной модели, а не на заучивании формулировок.`
          : `**Asosiy tamoyil** — ${meaningText}\n\n**Keng tarqalgan xato** — ${confusionText}. Quruq yodlashdan qochib, tub mantiqiy modelga e'tibor qarating.`

      const page3Body = isEn
        ? `**Practical Mastery** — ${objectiveText}.\n\nApply [[active retrieval|Retrieving knowledge from memory without prompts]] to cement long-term neural recall.`
        : isRu
          ? `**Практическое применение** — ${objectiveText}.\n\nИспользуйте [[активное извлечение|Воспроизведение материала по памяти без подсказок]] для укрепления долгосрочной памяти.`
          : `**Amaliy qo'llash** — ${objectiveText}.\n\nBilimni mustahkamlash uchun [[faol eslash|Kitobga qaramasdan ma'lumotni xotiradan qayta chaqirish usuli]] orqali sinab ko'ring.`

      const mcqPrompt = isEn
        ? `What is the key takeaway regarding ${b.title}?`
        : isRu
          ? `Каков ключевой вывод относительно темы «${b.title}»?`
          : `«${b.title}» mavzusida eng to'g'ri xulosa qaysi?`

      const mcqOpt1 = objectiveText.slice(0, 70)
      const mcqOpt2 = confusionText.slice(0, 70)
      const mcqOpt3 = isEn ? 'Rely solely on luck without systematic practice' : isRu ? 'Полагаться только на удачу без системы' : 'Hech qanday tahlilsiz tasodifga tayanish'

      const clozePrompt = isEn ? 'Complete the key statement' : isRu ? 'Заполните ключевую мысль' : 'Asosiy jumlani to\'ldiring'
      const clozeWord1 = isEn ? 'systematic practice' : isRu ? 'системной практике' : 'tizimli amaliyot'
      const clozeWord2 = isEn ? 'mental models' : isRu ? 'ментальных моделях' : 'mantiqiy tushunish'
      const clozeTemplate = isEn
        ? `True mastery is built through {{c1}} and rooted in {{c2}} blur.`
        : isRu
          ? `Мастерство строится на {{c1}} и держится на {{c2}} базе.`
          : `Haqiqiy mahorat {{c1}} orqali quriladi va {{c2}}ga tayanadi.`

      const flashPrompt = isEn ? `What is the core question behind ${b.title}?` : isRu ? `В чем главный вопрос темы «${b.title}»?` : `«${b.title}» ortidagi asosiy savol nima?`
      const flashAnswer = meaningText.slice(0, 140)

      const practices: AiCoursePractice[] = [
        {
          kind: 'mcq',
          id: `${lessonId}-mcq-0`,
          prompt: mcqPrompt,
          options: [
            { id: 'o1', text: mcqOpt1 },
            { id: 'o2', text: mcqOpt2 },
            { id: 'o3', text: mcqOpt3 },
          ],
          correctOptionId: 'o1',
        },
        {
          kind: 'cloze',
          id: `${lessonId}-cloze-1`,
          prompt: clozePrompt,
          template: clozeTemplate,
          blanks: [
            { id: 'c1', answer: clozeWord1 },
            { id: 'c2', answer: clozeWord2 },
          ],
          pool: [
            clozeWord1,
            clozeWord2,
            isEn ? 'blind luck' : isRu ? 'слепой удаче' : 'tasodifga',
            isEn ? 'cramming' : isRu ? 'зубрёжке' : 'quruq yodlashga',
          ],
        },
        {
          kind: 'flashcard',
          id: `${lessonId}-flashcard-2`,
          prompt: flashPrompt,
          answer: flashAnswer,
        },
      ]

      return {
        id: lessonId,
        ord: li,
        title: b.title,
        tldr: b.tldr,
        hook: hookText,
        meaning: meaningText,
        objective: objectiveText,
        likelyConfusion: confusionText,
        pages: [
          {
            kind: 'text',
            heading: isEn ? 'Why this matters' : isRu ? 'Почему это важно' : 'Nega bu muhim?',
            body: page1Body,
          },
          {
            kind: 'visual',
            style: 'bar-chart',
            heading: isEn ? 'Mastery Balance' : isRu ? 'Баланс усвоения' : 'O‘zlashtirish balansi',
            items: [
              { label: isEn ? 'Intuition' : isRu ? 'Интуиция' : 'Tub mantiq', value: 85 },
              { label: isEn ? 'Practice' : isRu ? 'Практика' : 'Amaliyot', value: 75 },
              { label: isEn ? 'Recall' : isRu ? 'Повторение' : 'Qayta eslash', value: 65 },
            ],
          },
          {
            kind: 'text',
            heading: isEn ? 'Core Application' : isRu ? 'Практическое применение' : 'Amaliy qo‘llash',
            body: page3Body,
          },
        ],
        practices,
        knowledgeCards: [
          {
            id: `${lessonId}-k1`,
            title: isEn ? 'Core Insight' : isRu ? 'Главный вывод' : 'Asosiy xulosa',
            body: meaningText.slice(0, 140),
          },
          {
            id: `${lessonId}-k2`,
            title: isEn ? 'Misconception Trap' : isRu ? 'Ловушка заблуждения' : 'Xatodan saqlanish',
            body: confusionText.slice(0, 140),
          },
        ],
      }
    })

    return {
      id: `sec-${si + 1}`,
      ord: si,
      title: sec.title,
      lessons,
    }
  })

  const payload = AiCoursePayloadSchema.parse({
    version: 1,
    outcomes: blueprint.outcomes,
    sections,
  })
  assertOutlineSemantics(payload)
  return payload
}

/**
 * 2-bosqich: Orqa fonda har bir bo'lim darslarini Meta AI orqali to'liq boyitish (background hydration).
 */
export async function hydrateCourseSections(
  courseId: number,
  input: AiCourseCreateInput,
  blueprint: CourseBlueprint,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const apiKey = config.ai.metaApiKey
  if (!apiKey) return

  await Promise.all(
    blueprint.sections.map(async (section, si) => {
      try {
        const lessons = await genSectionLessons(apiKey, input, section, si, fetchFn)
        const course = await aiCoursesRepository.getById(courseId)
        if (!course) return

        const currentPayload = course.payload
        if (!currentPayload.sections[si]) return

        const fullLessons: AiCourseLesson[] = lessons.map((l, li) => {
          const lessonId = `s${si + 1}-l${li + 1}`
          const b = section.lessons[li]
          return {
            ...l,
            id: lessonId,
            ord: li,
            title: b.title,
            tldr: b.tldr,
            hook: b.hook || l.hook,
            meaning: b.meaning || l.meaning,
            objective: b.objective || l.objective,
            likelyConfusion: b.likelyConfusion || l.likelyConfusion,
            practices: l.practices.map((p, pi) => ({ ...p, id: `${lessonId}-${p.kind}-${pi}` })),
            knowledgeCards: l.knowledgeCards.map((c, ci) => ({ ...c, id: `${lessonId}-k${ci + 1}` })),
          }
        })

        const updatedSections = [...currentPayload.sections]
        updatedSections[si] = {
          ...updatedSections[si],
          lessons: fullLessons,
        }

        const newPayload: AiCoursePayload = {
          ...currentPayload,
          sections: updatedSections,
        }

        assertOutlineSemantics(newPayload)
        await aiCoursesRepository.updateCoursePayload(courseId, newPayload)
        console.log(`[ai-course-hydrate] Course ${courseId} section ${si + 1} hydrated successfully in background.`)
      } catch (err) {
        console.warn(
          `[ai-course-hydrate] Course ${courseId} section ${si + 1} hydration skipped:`,
          (err as Error)?.message?.slice(0, 120),
        )
      }
    }),
  )
}

/**
 * Tezkor kurs generatsiyasi: 4-6s ichida blueprint + seed payload qaytaradi.
 */
export async function generateFastCourse(
  input: AiCourseCreateInput,
  fetchFn: FetchFn = fetch,
): Promise<{
  payload: AiCoursePayload
  generator: CourseGenerator
  title: string
  blueprint?: CourseBlueprint
}> {
  if (config.ai.metaApiKey) {
    try {
      const { blueprint, topic } = await generateCourseBlueprintMeta(input, fetchFn)
      const payload = buildPayloadFromBlueprint(input, blueprint)
      return { payload, generator: 'meta', title: topic, blueprint }
    } catch (err) {
      console.warn('[ai-course] meta fast blueprint failed, mock fallback:', (err as Error)?.message?.slice(0, 120))
    }
  }
  return {
    payload: buildMockOutline(input),
    generator: 'mock',
    title: cleanTopicForTitle(input.topic),
  }
}

/**
 * Router chaqiradigan YAGONA kirish: tezkor generatsiya bilan 4-6s da qaytadi.
 * `blueprint` mavjud bo'lsa, caller orqa fonda `hydrateCourseSections` ni chaqirishi mumkin.
 */
export async function generateCourseOutline(
  input: AiCourseCreateInput,
  fetchFn: FetchFn = fetch,
): Promise<{
  payload: AiCoursePayload
  generator: CourseGenerator
  title: string
  blueprint?: CourseBlueprint
}> {
  return generateFastCourse(input, fetchFn)
}
