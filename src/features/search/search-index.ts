/**
 * Qidiruv indeksi (FIXPLAN #45) — SOF funksiyalar, side-effect yo'q.
 *
 * Savollar (useQuestionsStore'dan kelayotgan mapped Question[]) va darslik
 * (modules + lessons statik kontenti) bo'yicha client-side substring qidiruvi.
 * Network yo'q — barcha ma'lumot allaqachon xotirada (fan yuklanganda).
 *
 * Normalizatsiya: lowercase + apostrof/o'zbek harf variantlari birlashtiriladi
 * («o'quv» == «o‘quv» == «o`quv» == «oquv») — qidiruvda apostrof stili
 * farqi tekshiruvchini qiynamasligi kerak.
 */

import type { Question, DbTopic } from '../../shared/api'

export interface LessonHit {
  moduleId: number
  lessonIdx: number
  title: string
  moduleTitle: string
  snippet: string
}

export interface QuestionHit {
  question: Question
  topicName: string
}

export interface SearchResults {
  questions: QuestionHit[]
  lessons: LessonHit[]
}

interface LessonSource {
  titleUz: string
  titleRu: string
  bodyUz: string[]
  bodyRu: string[]
}
interface ModuleSource {
  id: number
  title: string
  titleRu: string
}

/** Apostrof/toksimonlar — barcha variantlarni olib tashlaymiz (match osonlashadi):
 *  U+27 ('), U+2018 (‘), U+2019 (’), U+2BB (ʻ), U+2BC (ʼ), U+2B9 (ʹ), U+60 (`), U+B4 (´) */
const APOSTROPHES = /['’‘ʻʼʹ`´]/gu

export function normalizeSearchText(s: string): string {
  return s.toLowerCase().replace(APOSTROPHES, '').replace(/\s+/g, ' ').trim()
}

/** So'zni qisqa snippet'ga kesish — birinchi uchragan joy atrofida */
function makeSnippet(body: string, nq: string, maxLen = 120): string {
  const nb = normalizeSearchText(body)
  const i = nb.indexOf(nq)
  if (i === -1) return body.slice(0, maxLen)
  const start = Math.max(0, i - 40)
  const prefix = start > 0 ? '…' : ''
  const snippet = body.slice(start, start + maxLen)
  return prefix + snippet + (start + maxLen < body.length ? '…' : '')
}

export function searchContent(
  rawQuery: string,
  input: {
    questions: Question[]
    topics: DbTopic[]
    lessons: Record<number, LessonSource[]>
    modules: ModuleSource[]
    lang: 'uz' | 'ru'
  },
  limits: { questions?: number; lessons?: number } = {},
): SearchResults {
  const q = normalizeSearchText(rawQuery)
  const empty: SearchResults = { questions: [], lessons: [] }
  if (q.length < 2) return empty

  const qLimit = limits.questions ?? 24
  const lLimit = limits.lessons ?? 12
  const { questions, topics, lessons, modules, lang } = input

  // Savollar: matn bo'yicha substring (variantlarni ham — javob topilsa ko'rinadi)
  const topicName = (id: number | null): string => {
    const t = topics.find((t) => t.id === id)
    return t ? (lang === 'ru' ? t.nameRu : t.nameUz) : ''
  }
  const qHits: QuestionHit[] = []
  for (const qq of questions) {
    if (qHits.length >= qLimit) break
    const inStem = normalizeSearchText(qq.text).includes(q)
    const inOpts = !inStem && qq.options.some((o) => normalizeSearchText(o.text).includes(q))
    if (inStem || inOpts) {
      qHits.push({ question: qq, topicName: topicName(qq.topicId) })
    }
  }

  // Darslar: sarlavha YUQORI ustuvor, so'ng body'lar
  const lHits: LessonHit[] = []
  const byTitle: LessonHit[] = []
  const byBody: LessonHit[] = []
  for (const mod of modules) {
    const moduleTitle = lang === 'ru' ? mod.titleRu : mod.title
    ;(lessons[mod.id] ?? []).forEach((les, lessonIdx) => {
      const title = lang === 'ru' ? les.titleRu : les.titleUz
      const body = (lang === 'ru' ? les.bodyRu : les.bodyUz).join(' ')
      const hit = (): LessonHit => ({
        moduleId: mod.id, lessonIdx, title, moduleTitle, snippet: makeSnippet(body, q),
      })
      if (normalizeSearchText(title).includes(q)) byTitle.push(hit())
      else if (normalizeSearchText(body).includes(q)) byBody.push(hit())
    })
  }
  for (const h of [...byTitle, ...byBody]) {
    if (lHits.length >= lLimit) break
    lHits.push(h)
  }

  return { questions: qHits, lessons: lHits }
}
