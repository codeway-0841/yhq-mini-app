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
} from '../../../shared/ai-courses'
import { buildCourseOutline as buildMockOutline } from './mock-provider'

export const META_BASE_URL = 'https://api.meta.ai/v1'

/** Faqat muse-spark-1.3 (fallback YO'Q — user talabi) */
const META_MODEL = 'muse-spark-1.3'

/** Outline chaqiriq'i kichik (~800 token) — 25s yetadi */
const OUTLINE_TIMEOUT_MS = 25_000
const OUTLINE_MAX_TOKENS = 1200
/** Section darslari (~1500 token) — 3 tasi parallel, har biri 40s */
const LESSONS_TIMEOUT_MS = 40_000
const LESSONS_MAX_TOKENS = 2500

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
  const uz = input.language !== 'ru'
  const system = uz
    ? `Sen — o'quv kurslari tuzuvchi mutaxassissan. Faqat SO'RALGAN JSON'ni qaytarasan: izohsiz, markdown'siz, kod-panjara'siz. Barcha matnlar O'zbek tilida.`
    : `Ты — составитель учебных курсов. Возвращай ТОЛЬКО запрошенный JSON: без пояснений, без markdown, без code-fence. Все тексты на русском языке.`
  const user = `Foydalanuvchi so'rovi / Запрос: "${input.topic}" (${input.inputKind})
Kurs rejasi / План курса: ROVNO ${AI_COURSE_MOCK_SECTIONS} bo'lim, har birida ROVNO ${AI_COURSE_MOCK_LESSONS_PER_SECTION} dars.

NOMLASH QOIDALARI (muhim — buzilmasin):
- "topic": 2-4 so'zli TOZA kurs nomi (masalan "Termodinamika", "Ingliz tili asoslari").
  Foydalanuvchi gapini KO'CHIRMA ("...kurs qilish kerak", "iltimos" kabi so'zlar TAQIQLANADI).
- Bo'lim "title": 1-3 so'zli QISQA nom ("Asoslar", "Amaliyot") + boshida "N. " raqami.
  Mavzu nomini TAKRORLAMA, HAMMASI KATTA HARFDA YOZMA.
- Dars "title": 2-5 so'z ("Issiqlik miqdori", "Birinchi qonun"). "tldr": bitta jumla (≤150 belgi).
STRICT JSON: {"topic":"...","sections":[{"title":"1. ...","lessons":[{"title":"...","tldr":"..."},...]},...]}`
  return { system, user }
}

export interface LessonBlueprint {
  title: string
  tldr: string
}

export function buildSectionLessonsPrompt(
  input: AiCourseCreateInput,
  sectionTitle: string,
  blueprints: LessonBlueprint[],
): { system: string; user: string } {
  const uz = input.language !== 'ru'
  const shape = SHAPE_BY_LENGTH[input.lessonLength]
  const system = uz
    ? `Sen — o'quv kurslari tuzuvchi mutaxassissan. Faqat SO'RALGAN JSON'ni qaytarasan: izohsiz, markdown'siz, kod-panjara'siz. Barcha matnlar O'zbek tilida.`
    : `Ты — составитель учебных курсов. Возвращай ТОЛЬКО запрошенный JSON: без пояснений, без markdown, без code-fence. Все тексты на русском языке.`
  const lessonList = blueprints.map((b, i) => `${i + 1}. "${b.title}" — ${b.tldr}`).join('\n')
  const user = `Mavzu/Тема: "${input.topic}". Bo'lim/Раздел: "${sectionTitle}".
Shu bo'limning ROVNO ${blueprints.length} darsini to'liq yoz (id/ord KERAK EMAS — faqat ichki maydonlar):
${lessonList}

Dars title/tldr YUQORIDAGI ro'yxatdan AYNAN olinsin (o'zgartirmang, foydalanuvchi gapini qo'shmang).

MUHIM — QISQA yoz (har dars ~1200 belgi, aks holda kesiladi):
- Matn body: 120-250 belgi. Bilim kartasi body: ≤150 belgi. Variant/step: ≤60 belgi.
- SIFAT: har matn sahifada BITTA aniq misol bo'lsin (nazariya + misol).
  mcq chalg'ituvchilari ishonarli (darhol bilinmaydigan) bo'lsin; cloze —
  kalit atamalardan; order — real jarayon bosqichlari; flashcard — imtihonda
  tushadigan yodlash nuqtasi. Bo'sh iboralar TAQIQLANADI ("juda muhim",
  "albatta yodlang", "xulosa qilib aytganda" kabi).
- "pages": ${shape.pages}. Matn: {"kind":"text","heading":"...","body":"..."}.
  Vizual: {"kind":"visual","style":"bar-chart"|"pie-chart"|"cycle","heading":"...","items":[{"label":"...","value":0-100}]} (2-4 items).
- "practices": ${shape.practices}.
  mcq: {"kind":"mcq","id":"...-mcq","prompt":"...","options":[{"id":"o1","text":"..."},{"id":"o2","text":"..."},{"id":"o3","text":"..."}],"correctOptionId":"o2"} — correctOptionId variantlar ICHIDA.
  cloze: {"kind":"cloze","id":"...-cloze","prompt":"...","template":"... {{c1}} ... {{c2}} ...","blanks":[{"id":"c1","answer":"..."}],"pool":["javob","...","chalg'ituvchi"]} — pool'da blank javoblari + 1 chalg'ituvchi.
  order: {"kind":"order","id":"...-order","prompt":"...","steps":[{"id":"st1","text":"..."},...]} — steps TO'G'RI tartibda (3-4 qadam).
  flashcard: {"kind":"flashcard","id":"...-flash","prompt":"savol","answer":"qisqa javob"}.
- "knowledgeCards": 2 ta {"id":"...-k1","title":"...","body":"..."}.
- Har dars title/tldr YUQORIDAGI ro'yxatdan olinsin (o'zgartirmang).

STRICT JSON — darslar massivi: [{...},{...},{...}]`
  return { system, user }
}

// ── AI javob sxemalari (zod — qat'iy darvoza) ────────────────────────────────

const SectionsAiSchema = z.object({
  /** 2-4 so'zli toza kurs nomi — kurs sarlavhasi SHU bo'ladi */
  topic: z.string().min(3).max(60),
  sections: z.array(z.object({
    title: z.string().min(1).max(60),
    lessons: z.array(z.object({
      title: z.string().min(1).max(80),
      tldr: z.string().min(20).max(500),
    })).length(AI_COURSE_MOCK_LESSONS_PER_SECTION),
  })).length(AI_COURSE_MOCK_SECTIONS),
})

const LessonAiSchema = AiCourseLessonSchema.omit({ id: true, ord: true })
const SectionLessonsAiSchema = z.array(LessonAiSchema).length(AI_COURSE_MOCK_LESSONS_PER_SECTION)
type SectionLessons = z.infer<typeof SectionLessonsAiSchema>
type OutlineSection = z.infer<typeof SectionsAiSchema>['sections'][number]

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
    return {
      ...rest,
      title: section.lessons[li % section.lessons.length].title,
      tldr: section.lessons[li % section.lessons.length].tldr,
    }
  })
}

// ── JSON extract (markdown fence'larni tozalaydi) ────────────────────────────

export function extractJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const text = (fence ? fence[1] : raw).trim()
  // Top-level array (section darslari) yoki object (outline) — ikkalasi ham valid
  if (text.startsWith('[')) {
    const end = text.lastIndexOf(']')
    if (end <= 0) throw new Error('JSON topilmadi')
    return JSON.parse(text.slice(0, end + 1))
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('JSON topilmadi')
  return JSON.parse(text.slice(start, end + 1))
}

// ── Semantik check (sxemadan keyingi darvoza) ────────────────────────────────

export function assertOutlineSemantics(payload: AiCoursePayload): void {
  for (const s of payload.sections) {
    for (const l of s.lessons) {
      for (const p of l.practices) {
        if (p.kind === 'mcq' && !p.options.some((o) => o.id === p.correctOptionId)) {
          throw new Error(`mcq ${p.id}: correctOptionId options'da yo'q`)
        }
        if (p.kind === 'cloze') {
          for (const b of p.blanks) {
            if (!p.template.includes(`{{${b.id}}}`)) throw new Error(`cloze ${p.id}: template'da {{${b.id}}} yo'q`)
            if (!p.pool.includes(b.answer)) throw new Error(`cloze ${p.id}: javob pool'da yo'q`)
          }
        }
        if (p.kind === 'order') {
          const ids = p.steps.map((st) => st.id)
          if (new Set(ids).size !== ids.length) throw new Error(`order ${p.id}: step id takrorlangan`)
        }
      }
    }
  }
}

// ── Meta chaqiriq ────────────────────────────────────────────────────────────

interface MetaChatResponse {
  choices?: { message?: { content?: string } }[]
}

async function callMetaJson(
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
    // 1-bosqich: reja (sarlavhalar + tldr) — kichik va tez
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
        const full: AiCourseLesson[] = lessons.map((l, li) => ({
          ...l,
          // id/ord/title/tldr — server deterministik beradi (AI ixtiyoriga topshirilmaydi)
          id: `s${si + 1}-l${li + 1}`,
          ord: li,
          title: section.lessons[li].title,
          tldr: section.lessons[li].tldr,
        }))
        return {
          id: `sec-${si + 1}`,
          ord: si,
          title: section.title,
          lessons: full,
        }
      }),
    )

    const payload = AiCoursePayloadSchema.parse({ version: 1, sections: sectionPayloads })
    assertOutlineSemantics(payload)
    return { payload, topic: outline.topic }
  } catch (err) {
    const lastError = (err as Error)?.message ?? 'network'
    console.warn('[ai-course-meta]', lastError.slice(0, 160))
    throw new Error(`Meta generatsiya yiqildi: ${lastError.slice(0, 120)}`, { cause: err })
  }
}

/**
 * Router chaqiradigan YAGONA kirish: kalit bo'lsa Meta, bo'lmasa yoki
 * yiqilsa — deterministik mock. Hech qachon throw qilmaydi.
 * `title` — ko'rinadigan toza kurs nomi (AI topic yoki tozalangan matn).
 */
export async function generateCourseOutline(
  input: AiCourseCreateInput,
  fetchFn: FetchFn = fetch,
): Promise<{ payload: AiCoursePayload; generator: CourseGenerator; title: string }> {
  if (config.ai.metaApiKey) {
    try {
      const { payload, topic } = await generateCourseOutlineMeta(input, fetchFn)
      return { payload, generator: 'meta', title: topic }
    } catch (err) {
      console.warn('[ai-course] meta yiqildi, mock fallback:', (err as Error)?.message?.slice(0, 120))
    }
  }
  return { payload: buildMockOutline(input), generator: 'mock', title: cleanTopicForTitle(input.topic) }
}
