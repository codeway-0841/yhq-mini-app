/**
 * QBANK EXPORT CORE — Neon → R2 publik savol banki generatori (SOF modul).
 *
 * Xavfsizlik kafolatlari (scoring trust boundary):
 *  - FAQAT whitelist ustunlar ko'chadi (id/externalId/topicId/questionUz/Ru/
 *    optionsUz/Ru/image) — `correctAnswer` structuraviy kirmaydi;
 *  - `assertNoAnswerKeys()` har bir artifact'ni (manifest + chunk JSON)
 *    chuqur rekursiv skanerlaydi — taqiqlangan kalit nomi topilsa THROW
 *    (publish to'xtaydi, marker yozilmaydi);
 *  - serialize qilingan JSON string'da ham denylist regex tekshiruvi
 *    (belt & braces).
 *
 * Chunking: packed chunks — mavzular BUTUN holda ~targetChunkBytes'lik
 * chunk'larga joylanadi, manifest'da topicId → chunk indeksi (fizikada
 * 296 kichik mavzu bor: per-topic chunk 296 so'rov bo'lardi, packed esa
 * ~40 ta ~150KB'lik so'rov — mobil WebView'da tezroq). Bitta mavzu
 * hardMaxBytes'dan katta bo'lsa, u bir necha chunk'ga bo'linadi
 * (manifest'da topic.chunks massiv).
 *
 * Deterministiklik: bir xil kirish → bayt-bayt bir xil natija
 * (`generatedAt` injektsiya qilinadi).
 */

/** Neon'dan o'qiladigan PUBLIK qator — explicit proyeksiya (SELECT * YO'Q). */
export interface ExportQuestionRow {
  id: number
  externalId: string
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  /** DB'dagi rasm yo'li (masalan /physics-print/x.webp) yoki null */
  image: string | null
  topicId: number | null
}

/** Chunk'dagi savol — learner'ga kerakli maydonlargina (javob kaliti YO'Q). */
export interface ChunkQuestion {
  id: number
  externalId: string
  topicId: number | null
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  /** R2/Worker rasm yo'li (/images/<subject>/<hash>.webp) yoki null */
  image: string | null
}

export interface QbankManifestTopic {
  topicId: number | null
  questionCount: number
  /** 1+ chunk yo'li (katta mavzu bo'linganda bir nechta) */
  chunks: string[]
}

export interface QbankManifestFile {
  path: string
  bytes: number
  questionCount: number
}

export interface QbankManifest {
  subject: string
  contentVersion: number
  generatedAt: string
  questionCount: number
  topics: QbankManifestTopic[]
  files: QbankManifestFile[]
}

export interface QbankExportArtifacts {
  manifest: QbankManifest
  manifestJson: string
  /** chunk path (`chunks/chunk-001.json`) → JSON string */
  chunks: Map<string, string>
}

/** DB rasm yo'lini R2 referensiyasiga o'giruvchi (CLI injektsiya qiladi). */
export type ImageRefResolver = (dbImagePath: string) => string | null

const DEFAULT_TARGET_CHUNK_BYTES = 150 * 1024

/** Taqiqlangan kalit nomlari — javob kaliti/izoh HECH QACHON chiqmasligi uchun. */
const FORBIDDEN_KEY_RE = /correct|answer_?key|answerkey|explanation|hint|solution/i
/** Serialize qilingan JSON'da ham shu nomlar qidiriladi (belt & braces). */
const FORBIDDEN_JSON_RE = /"(correctAnswer|correct_answer|answerKey|answer_key|explanationUz|explanationRu)"\s*:/i

/**
 * Publik savol — WHITELIST proyeksiya. `resolveImage` DB yo'lini R2 ref'ga
 * o'giradi; null qaytarsa rasm ESKI (Vercel static) yo'lida qoladi
 * (graceful fallback) — lekin hech qachon base64/data: URI eksport qilinmaydi.
 */
export function sanitizeQuestion(row: ExportQuestionRow, resolveImage?: ImageRefResolver): ChunkQuestion {
  let image: string | null = null
  if (row.image) {
    if (row.image.startsWith('data:')) {
      // Base64 JSON ichida TAQIQLANGAN — rasm alohida R2 obyekti bo'lishi shart.
      image = null
    } else {
      image = resolveImage ? (resolveImage(row.image) ?? row.image) : row.image
    }
  }
  return {
    id: row.id,
    externalId: row.externalId,
    topicId: row.topicId,
    questionUz: row.questionUz,
    questionRu: row.questionRu,
    optionsUz: row.optionsUz,
    optionsRu: row.optionsRu,
    image,
  }
}

interface TopicGroup {
  topicId: number | null
  questions: ChunkQuestion[]
}

function groupByTopic(rows: ExportQuestionRow[], resolveImage?: ImageRefResolver): TopicGroup[] {
  const map = new Map<number | null, ChunkQuestion[]>()
  for (const row of rows) {
    const key = row.topicId
    const list = map.get(key) ?? []
    list.push(sanitizeQuestion(row, resolveImage))
    map.set(key, list)
  }
  // Deterministik tartib: mavzular id bo'yicha o'suvchi (null — oxirida),
  // mavzu ichida savollar id bo'yicha o'suvchi.
  return [...map.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([topicId, questions]) => ({
      topicId,
      questions: questions.sort((x, y) => x.id - y.id),
    }))
}

function chunkJson(topicIds: Array<number | null>, questions: ChunkQuestion[]): string {
  return JSON.stringify({ topicIds, questions })
}

/**
 * Bank eksporti: sanitize → topic group → packed chunk → manifest.
 * MUHIM: faqat publik qatorlar qabul qiladi (caller proyeksiyani kafolatlaydi).
 */
export function buildBankExport(opts: {
  subject: string
  contentVersion: number
  rows: ExportQuestionRow[]
  /** Katalogdagi mavzu id'lari (topics jadvali) — count tekshiruvi uchun */
  topicIds: number[]
  resolveImage?: ImageRefResolver
  /** Deterministik test uchun injektsiya; default — hozirgi vaqt */
  generatedAt?: string
  targetChunkBytes?: number
}): QbankExportArtifacts {
  const { subject, contentVersion, rows, resolveImage, generatedAt, targetChunkBytes } = opts
  if (rows.length === 0) throw new Error('qbank_export_empty_bank')
  const target = Math.max(16 * 1024, targetChunkBytes ?? DEFAULT_TARGET_CHUNK_BYTES)

  const groups = groupByTopic(rows, resolveImage)
  const chunks = new Map<string, string>()
  const manifestTopics: QbankManifestTopic[] = []
  const files: QbankManifestFile[] = []

  let chunkIndex = 0
  const writeChunk = (topicIds: Array<number | null>, questions: ChunkQuestion[]): string => {
    chunkIndex += 1
    const path = `chunks/chunk-${String(chunkIndex).padStart(3, '0')}.json`
    const json = chunkJson(topicIds, questions)
    chunks.set(path, json)
    files.push({ path, bytes: Buffer.byteLength(json, 'utf8'), questionCount: questions.length })
    return path
  }

  let pending: ChunkQuestion[] = []
  let pendingTopicIds = new Set<number | null>()
  let pendingTopicOrder: Array<number | null> = []

  const flush = (): void => {
    if (pending.length === 0) return
    const path = writeChunk(pendingTopicOrder, pending)
    for (const topic of manifestTopics) {
      if (topic.chunks.length === 0 && pendingTopicIds.has(topic.topicId)) {
        topic.chunks.push(path)
      }
    }
    pending = []
    pendingTopicIds = new Set()
    pendingTopicOrder = []
  }

  for (const group of groups) {
    const groupBytes = Buffer.byteLength(chunkJson([group.topicId], group.questions), 'utf8')

    if (groupBytes > target) {
      // Target'dan katta mavzu — pending'ni yopib, mavzuni alohida chunk'larga bo'lamiz.
      flush()
      const topicEntry: QbankManifestTopic = { topicId: group.topicId, questionCount: group.questions.length, chunks: [] }
      manifestTopics.push(topicEntry)
      let slice: ChunkQuestion[] = []
      for (const question of group.questions) {
        const candidate = [...slice, question]
        if (slice.length > 0 && Buffer.byteLength(chunkJson([group.topicId], candidate), 'utf8') > target) {
          topicEntry.chunks.push(writeChunk([group.topicId], slice))
          slice = [question]
        } else {
          slice = candidate
        }
      }
      if (slice.length > 0) topicEntry.chunks.push(writeChunk([group.topicId], slice))
      continue
    }

    // Oddiy holat: mavzu butun holda pending chunk'ga SIG'ADI (packed).
    const candidateBytes = Buffer.byteLength(
      chunkJson([...pendingTopicOrder, group.topicId], [...pending, ...group.questions]),
      'utf8',
    )
    if (candidateBytes > target && pending.length > 0) {
      flush()
    }
    pending.push(...group.questions)
    pendingTopicIds.add(group.topicId)
    pendingTopicOrder.push(group.topicId)
    manifestTopics.push({ topicId: group.topicId, questionCount: group.questions.length, chunks: [] })
  }
  flush()

  const manifest: QbankManifest = {
    subject,
    contentVersion,
    generatedAt: generatedAt ?? new Date().toISOString(),
    questionCount: rows.length,
    topics: manifestTopics,
    files,
  }
  return { manifest, manifestJson: JSON.stringify(manifest), chunks }
}

/**
 * TAqiQLANGAN KALIT SKANERI — rekursiv. Birorta taqiqlangan kalit topilsa
 * THROW (publish to'xtaydi). Manifest + har bir chunk JSON'da chaqiriladi.
 */
export function assertNoAnswerKeys(value: unknown, path = '$'): void {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAnswerKeys(item, `${path}[${index}]`))
    return
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_RE.test(key)) {
        throw new Error(`qbank_export_forbidden_key:${path}.${key}`)
      }
      assertNoAnswerKeys(child, `${path}.${key}`)
    }
  }
}

/** Serialize qilingan JSON string'da denylist regex tekshiruvi. */
export function assertJsonClean(json: string, label: string): void {
  if (FORBIDDEN_JSON_RE.test(json)) {
    throw new Error(`qbank_export_forbidden_json:${label}`)
  }
}

/**
 * Eksport validatsiyasi — publish'dan OLDIN:
 *  - savollar soni manba bilan bir xil;
 *  - manifest'dagi har bir chunk fayl MAVJUD (va teskari: yolg'iz chunk yo'q);
 *  - har bir mavzu kamida bitta chunk'ga ega;
 *  - chunk'lardagi savollar yig'indisi == bankdagi savollar soni;
 *  - topicId'lar katalog bilan mos.
 */
export function validateExport(
  artifacts: QbankExportArtifacts,
  source: { questionCount: number; topicIds: number[] },
): void {
  const { manifest, chunks } = artifacts
  if (manifest.questionCount !== source.questionCount) {
    throw new Error(`qbank_export_count_mismatch:${manifest.questionCount}!=${source.questionCount}`)
  }
  let chunkQuestionTotal = 0
  for (const file of manifest.files) {
    if (!chunks.has(file.path)) throw new Error(`qbank_export_chunk_missing:${file.path}`)
    chunkQuestionTotal += file.questionCount
  }
  if (chunkQuestionTotal !== source.questionCount) {
    throw new Error(`qbank_export_chunk_total_mismatch:${chunkQuestionTotal}!=${source.questionCount}`)
  }
  const referenced = new Set(manifest.files.map((f) => f.path))
  for (const path of chunks.keys()) {
    if (!referenced.has(path)) throw new Error(`qbank_export_orphan_chunk:${path}`)
  }
  const sourceTopicIds = new Set(source.topicIds)
  for (const topic of manifest.topics) {
    if (topic.chunks.length === 0) {
      throw new Error(`qbank_export_topic_without_chunk:${String(topic.topicId)}`)
    }
    for (const path of topic.chunks) {
      if (!referenced.has(path)) throw new Error(`qbank_export_topic_bad_ref:${String(topic.topicId)}:${path}`)
    }
    if (topic.topicId !== null && !sourceTopicIds.has(topic.topicId)) {
      throw new Error(`qbank_export_unknown_topic:${topic.topicId}`)
    }
  }
}

/** Barcha artifact'lar ustidan to'liq xavfsizlik skani (publish gate). */
export function assertExportClean(artifacts: QbankExportArtifacts): void {
  assertNoAnswerKeys(artifacts.manifest)
  assertJsonClean(artifacts.manifestJson, 'manifest.json')
  for (const [path, json] of artifacts.chunks) {
    assertNoAnswerKeys(JSON.parse(json), path)
    assertJsonClean(json, path)
  }
}
