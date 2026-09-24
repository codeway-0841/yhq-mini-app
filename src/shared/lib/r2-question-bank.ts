/**
 * R2/Worker orqali savol bankini yuklash (BARCHA fanlar).
 *
 * Oqim:
 *  1. kontent tokeni (POST /api/content/token, 10 daqiqalik) + R2 segmenti
 *     (server javobidan — client'da fan↔segment MAPPING YO'Q);
 *  2. manifest.json (Worker, edge-cache);
 *  3. chunk'lar parallel (concurrency 6, edge-cache, immutable);
 *  4. savollar → mavjud `DbQuestion[]` shakli (store/consumers O'ZGARMAYDI);
 *  5. savollar soni manifest bilan tekshiriladi.
 *
 * XAVFSIZLIK: chunk'larda correctAnswer strukturaviy YO'Q (server export
 * whitelist + assertNoAnswerKeys) — bu yerda faqat shakl tekshiriladi.
 *
 * Xato → THROW: caller (useQuestionsStore) telemetry yozib legacy
 * /api/questions fallback'ga tushadi.
 */
import { config } from '../config'
import type { DbQuestion } from '../api'
import { getContentTokenState } from './content-token'

const FETCH_TIMEOUT_MS = 20_000
const CHUNK_CONCURRENCY = 6
/** Sog'lom chegaralar — buzilgan/yolg'on manifest'dan himoya */
const MAX_QUESTIONS = 200_000
const MAX_CHUNKS = 2_000

interface ManifestFile {
  path: string
  bytes: number
  questionCount: number
}

interface BankManifest {
  subject: string
  contentVersion: number
  questionCount: number
  topics: Array<{ topicId: number | null; questionCount: number; chunks: string[] }>
  files: ManifestFile[]
}

interface ChunkPayload {
  topicIds: Array<number | null>
  questions: DbQuestion[]
}

const CHUNK_PATH_RE = /^chunks\/chunk-\d{3}\.json$/

function assertManifest(raw: unknown, expectedVersion: number): BankManifest {
  const m = raw as Partial<BankManifest>
  if (
    !m || typeof m !== 'object'
    || typeof m.subject !== 'string'
    || m.contentVersion !== expectedVersion
    || !Number.isInteger(m.questionCount)
    || (m.questionCount as number) <= 0
    || (m.questionCount as number) > MAX_QUESTIONS
    || !Array.isArray(m.topics)
    || !Array.isArray(m.files)
    || m.files.length === 0
    || m.files.length > MAX_CHUNKS
  ) {
    throw new Error('r2_manifest_invalid')
  }
  for (const file of m.files) {
    if (
      !file || typeof file.path !== 'string'
      || !CHUNK_PATH_RE.test(file.path)
      || !Number.isInteger(file.questionCount)
    ) {
      throw new Error('r2_manifest_invalid_file')
    }
  }
  return m as BankManifest
}

function assertChunk(raw: unknown): ChunkPayload {
  const c = raw as Partial<ChunkPayload>
  if (!c || typeof c !== 'object' || !Array.isArray(c.questions)) {
    throw new Error('r2_chunk_invalid')
  }
  for (const q of c.questions) {
    if (
      !q || typeof q.id !== 'number'
      || typeof q.questionUz !== 'string'
      || typeof q.questionRu !== 'string'
      || typeof q.optionsUz !== 'object' || q.optionsUz === null
      || typeof q.optionsRu !== 'object' || q.optionsRu === null
    ) {
      throw new Error('r2_chunk_question_invalid')
    }
  }
  return c as ChunkPayload
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`r2_http_${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[]
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index] as T)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Fan bankini R2'dan tortish. `r2v` = "cv<N>" (server /questions/version).
 * Qaytaradi: legacy `/api/questions` bilan BIR XIL shakldagi DbQuestion[]
 * (id bo'yicha o'suvchi tartib — consumers deterministikligiga tayanadi).
 */
export async function loadSubjectBankR2(subjectId: string, r2v: string): Promise<DbQuestion[]> {
  const base = config.contentWorkerUrl
  if (!base) throw new Error('r2_worker_url_missing')
  const version = Number(String(r2v).replace(/^cv/, ''))
  if (!Number.isInteger(version) || version <= 0) throw new Error('r2_bad_version')

  const { token, segment } = await getContentTokenState(subjectId)
  if (!segment) throw new Error('r2_segment_missing')
  const manifestRaw = await fetchJson(`${base}/questions/${segment}/v${version}/manifest.json`, token)
  const manifest = assertManifest(manifestRaw, version)

  const chunks = await mapLimit(manifest.files, CHUNK_CONCURRENCY, async (file) => {
    const raw = await fetchJson(`${base}/questions/${segment}/v${version}/${file.path}`, token)
    return assertChunk(raw)
  })

  const questions: DbQuestion[] = []
  for (const chunk of chunks) {
    for (const q of chunk.questions) {
      questions.push({
        id: q.id,
        questionUz: q.questionUz,
        questionRu: q.questionRu,
        optionsUz: q.optionsUz,
        optionsRu: q.optionsRu,
        image: q.image ?? null,
        topicId: q.topicId ?? null,
      })
    }
  }
  if (questions.length !== manifest.questionCount) {
    throw new Error(`r2_count_mismatch:${questions.length}!=${manifest.questionCount}`)
  }
  // Legacy ORDER BY id deterministikligi (marathon/bilet/adaptive tartibiga tayanadi)
  questions.sort((a, b) => a.id - b.id)
  return questions
}

/**
 * @deprecated Fizika pilot nomi — loadSubjectBankR2('fizika', r2v) ishlating.
 * Mavjud chaqiruvlar buzilmasligi uchun SAQLANADI.
 */
export function loadPhysicsBankR2(r2v: string): Promise<DbQuestion[]> {
  return loadSubjectBankR2('fizika', r2v)
}
