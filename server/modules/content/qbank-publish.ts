/**
 * QBANK PUBLISH — Neon → PRIVATE R2 atomik nashr orkestratsiyasi.
 *
 * ATOMIK PUBLISH INVARIANTI:
 *   client'ga ko'rinadigan R2 versiyasi FAQAT `published.json` markerida
 *   yozilgan versiya. Marker barcha chunk/rasm/manifest yuklanib va HEAD
 *   bilan tekshirilgandan KEYIN, ENG OXIRIDA yoziladi — yarim publish
 *   hech qachon ko'rinmaydi (eski versiya xizmatda qoladi).
 *
 * Modul IO'dan ajratilgan (PublishDeps injektsiya) — unit testlar Neon/R2'siz
 * ishlaydi. Haqiqiy wiring: `makeNeonPublishDeps()` (CLI ishlatadi).
 */
import { createHash } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/connection'
import { questionBanks, questions, topics } from '../../schema'
import { config } from '../../config'
import { R2StorageProvider } from '../storage/r2-client'
import {
  buildBankExport,
  assertExportClean,
  validateExport,
  type ExportQuestionRow,
  type ImageRefResolver,
} from './qbank-export'

/**
 * subjectId ↔ R2 path segmenti ↔ bank mapping SSOT (11 fan).
 * `fizika → physics` tarixiy (birinchi publish shu segmentda, JONLI) —
 * qolganlarida segment = subjectId. Worker/token/client segmentni FAQAT
 * shu yerdan oladi (hech qayerda duplicate mapping YO'Q).
 * bankId ↔ shared/subjects.ts dataSourceId SINXRON bo'lishi SHART —
 * desync'ni qbank-publish.test.ts ushlaydi.
 */
export const QBANK_SUBJECTS = {
  yhq:        { pathSegment: 'yhq',        bankId: 'traffic_rules_db' },
  rustili:    { pathSegment: 'rustili',    bankId: 'russian_db' },
  fizika:     { pathSegment: 'physics',    bankId: 'physics_db' },
  matematika: { pathSegment: 'matematika', bankId: 'math_db' },
  kimyo:      { pathSegment: 'kimyo',      bankId: 'chemistry_db' },
  ingliz:     { pathSegment: 'ingliz',     bankId: 'english_db' },
  tarix:      { pathSegment: 'tarix',      bankId: 'history_db' },
  biologiya:  { pathSegment: 'biologiya',  bankId: 'biology_db' },
  geografiya: { pathSegment: 'geografiya', bankId: 'geography_db' },
  onatili:    { pathSegment: 'onatili',    bankId: 'onatili_db' },
  adabiyot:   { pathSegment: 'adabiyot',   bankId: 'adabiyot_db' },
} as const
export type QbankSubjectId = keyof typeof QBANK_SUBJECTS

export function isQbankSubject(subjectId: string): subjectId is QbankSubjectId {
  return subjectId in QBANK_SUBJECTS
}

export interface QbankStorage {
  uploadObject(key: string, body: Buffer, contentType?: string, cacheControl?: string): Promise<void>
  objectExists(key: string): Promise<boolean>
  getObject(key: string): Promise<Buffer | null>
  deleteObjects(keys: string[]): Promise<void>
  listObjects(prefix: string, maxKeys?: number): Promise<string[]>
}

export interface PublishDeps {
  /** Neon: joriy content_version (publish target) */
  readVersion(): Promise<number | null>
  /** Neon: EXPLICIT publik proyeksiya (SELECT * TAQIQLANADI) */
  readRows(): Promise<ExportQuestionRow[]>
  /** Neon: katalog mavzu id'lari */
  readTopicIds(): Promise<number[]>
  storage: QbankStorage
  /** DB rasm yo'lidan binary yuklaydi (CLI: public/ fayldan) — topilmasa null */
  loadImage(dbPath: string): Promise<Buffer | null>
  now?: () => Date
}

export interface PublishReport {
  subject: string
  pathSegment: string
  version: number
  dryRun: boolean
  questionCount: number
  topicCount: number
  chunkCount: number
  chunkBytes: number
  imageCount: number
  imageBytes: number
  /** HEAD'da mavjud bo'lib skip qilingan rasmlar (hash-dedup) */
  skippedImages: number
  /** Fayli topilmagan rasmlar (eski Vercel yo'li saqlanadi) */
  missingImages: number
  uploadedObjects: number
  verifiedObjects: number
  deletedOldVersions: number[]
  durationMs: number
}

export interface PublishedMarker {
  subject: string
  version: number
  questionCount: number
  publishedAt: string
}

const JSON_CT = 'application/json; charset=utf-8'
const IMMUTABLE_CC = 'public, max-age=31536000, immutable'
/** Parallel yuklash/tekshirish darajasi — Neon/R2'ni bosmaslik uchun */
const CONCURRENCY = 8

export function markerKey(pathSegment: string): string {
  return `questions/${pathSegment}/published.json`
}

function versionPrefix(pathSegment: string, version: number): string {
  return `questions/${pathSegment}/v${version}`
}

function imageKey(pathSegment: string, hash: string, ext: string): string {
  return `images/${pathSegment}/${hash}.${ext}`
}

function imageContentType(ext: string): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'image/webp'
}

/** Kichik concurrency-pool (async map, tartib saqlanadi). */
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
 * ATOMIK PUBLISH. Qadamlar (tartib MUHIM):
 *  1. Neon: version + publik qatorlar + mavzular
 *  2. Rasmlar: bytes → sha256 → R2 ref map (mavjudlari skip)
 *  3. buildBankExport + assertExportClean (javob kaliti skani) + validateExport
 *  4. dryRun → shu yerda to'xtaydi (hech narsa yozilmaydi)
 *  5. Upload: rasmlar → chunk'lar → manifest (manifest oxirida)
 *  6. HEAD verify: HAMMA chunk + manifest + yuklangan rasmlar
 *  7. Marker (`published.json`) — FAQAT endi, ENG OXIRIDA
 *  8. Tozalash: joriy-1'dan eski versiyalar (best-effort)
 */
export async function publishQuestionBank(
  subjectId: string,
  deps: PublishDeps,
  opts: { dryRun?: boolean; log?: (msg: string) => void } = {},
): Promise<PublishReport> {
  const started = Date.now()
  const log = opts.log ?? (() => {})
  if (!isQbankSubject(subjectId)) throw new Error(`qbank_subject_not_supported:${subjectId}`)
  const { pathSegment, bankId } = QBANK_SUBJECTS[subjectId]
  const now = deps.now ?? (() => new Date())
  const dryRun = opts.dryRun === true

  // 1. Neon o'qishlar
  const [version, rows, topicIds] = await Promise.all([deps.readVersion(), deps.readRows(), deps.readTopicIds()])
  if (version === null) throw new Error(`qbank_bank_not_found:${bankId}`)
  if (rows.length === 0) throw new Error(`qbank_empty_bank:${bankId}`)
  log(`[qbank] ${subjectId}: version=cv${version}, rows=${rows.length}, topics=${topicIds.length}`)

  // 2. Rasmlar: DB yo'li → {hash, ext, bytes} (noyob yo'llar bo'yicha)
  const uniqueImagePaths = [...new Set(rows.map((r) => r.image).filter((v): v is string => Boolean(v)))]
  interface ResolvedImage { hash: string; ext: string; bytes: Buffer }
  const imageMap = new Map<string, ResolvedImage>()
  let missingImages = 0
  await mapLimit(uniqueImagePaths, CONCURRENCY, async (dbPath) => {
    const bytes = await deps.loadImage(dbPath)
    if (!bytes || bytes.length === 0) {
      missingImages += 1
      return
    }
    const ext = (dbPath.split('.').pop() ?? 'webp').toLowerCase()
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    imageMap.set(dbPath, { hash, ext, bytes })
  })
  const resolveImage: ImageRefResolver = (dbPath) => {
    const img = imageMap.get(dbPath)
    return img ? `/${imageKey(pathSegment, img.hash, img.ext)}` : null
  }

  // 3. Export build + xavfsizlik skani + validatsiya
  const artifacts = buildBankExport({
    subject: pathSegment,
    contentVersion: version,
    rows,
    topicIds,
    resolveImage,
    generatedAt: now().toISOString(),
  })
  assertExportClean(artifacts)
  validateExport(artifacts, { questionCount: rows.length, topicIds })
  const chunkBytes = artifacts.manifest.files.reduce((sum, f) => sum + f.bytes, 0)
  const imageBytes = [...imageMap.values()].reduce((sum, img) => sum + img.bytes.length, 0)
  log(`[qbank] chunks=${artifacts.chunks.size} (${chunkBytes}B), images=${imageMap.size} (${imageBytes}B), missingImages=${missingImages}`)

  const report: PublishReport = {
    subject: subjectId,
    pathSegment,
    version,
    dryRun,
    questionCount: rows.length,
    topicCount: topicIds.length,
    chunkCount: artifacts.chunks.size,
    chunkBytes,
    imageCount: imageMap.size,
    imageBytes,
    skippedImages: 0,
    missingImages,
    uploadedObjects: 0,
    verifiedObjects: 0,
    deletedOldVersions: [],
    durationMs: 0,
  }
  if (dryRun) {
    report.durationMs = Date.now() - started
    return report
  }

  // 5. Upload — rasmlar (hash-dedup: mavjudini skip), keyin chunk'lar, OXIRIDA manifest
  const prefix = versionPrefix(pathSegment, version)
  const images = [...imageMap.values()]
  await mapLimit(images, CONCURRENCY, async (img) => {
    const key = imageKey(pathSegment, img.hash, img.ext)
    if (await deps.storage.objectExists(key)) {
      report.skippedImages += 1
      return
    }
    await deps.storage.uploadObject(key, img.bytes, imageContentType(img.ext), IMMUTABLE_CC)
    report.uploadedObjects += 1
  })
  log(`[qbank] images uploaded=${report.uploadedObjects}, skipped=${report.skippedImages}`)

  await mapLimit([...artifacts.chunks.entries()], CONCURRENCY, async ([path, json]) => {
    await deps.storage.uploadObject(`${prefix}/${path}`, Buffer.from(json, 'utf8'), JSON_CT, IMMUTABLE_CC)
    report.uploadedObjects += 1
  })
  // Manifest — chunk'lardan KEYIN (u ularga ishora qiladi)
  await deps.storage.uploadObject(`${prefix}/manifest.json`, Buffer.from(artifacts.manifestJson, 'utf8'), JSON_CT, IMMUTABLE_CC)
  report.uploadedObjects += 1

  // 6. HEAD verify — HAMMA obyekt (chunk + manifest). Rasmlar hash-dedup'li:
  //    skip qilinganlari allaqachon mavjudligi HEAD bilan aniq; yangi
  //    yuklanganlarni ham tekshiramiz.
  const verifyKeys = [
    `${prefix}/manifest.json`,
    ...[...artifacts.chunks.keys()].map((path) => `${prefix}/${path}`),
  ]
  const verifyResults = await mapLimit(verifyKeys, CONCURRENCY, (key) => deps.storage.objectExists(key))
  const missing = verifyKeys.filter((_, index) => !verifyResults[index])
  if (missing.length > 0) {
    // MARKER YOZILMAYDI — eski versiya xizmatda qoladi (atomik publish).
    throw new Error(`qbank_publish_verify_failed:${missing.slice(0, 3).join(',')}${missing.length > 3 ? `+${missing.length - 3}` : ''}`)
  }
  report.verifiedObjects = verifyKeys.length

  // 7. MARKER — ENG OXIRIDA. Shu nuqtadan boshlab client'lar yangi versiyani ko'radi.
  const marker: PublishedMarker = {
    subject: pathSegment,
    version,
    questionCount: rows.length,
    publishedAt: now().toISOString(),
  }
  await deps.storage.uploadObject(
    markerKey(pathSegment),
    Buffer.from(JSON.stringify(marker), 'utf8'),
    JSON_CT,
    'no-store',
  )
  log(`[qbank] PUBLISHED ${pathSegment} v${version} (${rows.length} savol, ${artifacts.chunks.size} chunk)`)

  // 8. Eski versiyalarni tozalash — joriy VA oldingi saqlanadi (yarim
  //    sessiyadagi client'lar sinmasin). Best-effort: xato publish'ni buzmaydi.
  try {
    const allKeys = await deps.storage.listObjects(`questions/${pathSegment}/v`)
    const oldKeys = allKeys.filter((key) => {
      const match = key.match(/^questions\/[^/]+\/v(\d+)\//)
      return match !== null && Number(match[1]) < version - 1
    })
    if (oldKeys.length > 0) {
      await deps.storage.deleteObjects(oldKeys)
      report.deletedOldVersions = [
        ...new Set(
          oldKeys
            .map((key) => key.match(/^questions\/[^/]+\/v(\d+)\//)?.[1])
            .filter((v): v is string => Boolean(v))
            .map(Number),
        ),
      ]
    }
  } catch (err) {
    log(`[qbank] WARN: eski versiyalarni tozalash xatosi (publish buzilmadi): ${String(err)}`)
  }

  report.durationMs = Date.now() - started
  return report
}

/**
 * PUBLISHED versiyani o'qish — /questions/version (r2v) va /content/token
 * uchun. Marker yo'q/o'qib bo'lmasa → null (client legacy yo'lda qoladi).
 */
export async function readPublishedVersion(
  storage: Pick<QbankStorage, 'getObject'>,
  pathSegment: string,
): Promise<number | null> {
  const buf = await storage.getObject(markerKey(pathSegment))
  if (!buf) return null
  try {
    const marker = JSON.parse(buf.toString('utf8')) as Partial<PublishedMarker>
    return Number.isInteger(marker.version) && (marker.version as number) > 0 ? (marker.version as number) : null
  } catch {
    return null
  }
}

// ── Runtime marker cache (30s TTL) ────────────────────────────────────────
// /questions/version har so'rovida R2'ga bormasligi uchun qisqa in-lambda kesh.
// 30s staleness qabul qilinadi: versiyalar immutable, eski versiya retention
// (joriy-1) saqlanadi — client yangi versiyani ko'rmasa ham sinmaydi.
const MARKER_TTL_MS = 30_000
const markerCache = new Map<string, { at: number; version: number | null }>()

/** Testlar uchun cache reset. */
export function resetPublishedVersionCache(): void {
  markerCache.clear()
}

// ── Haqiqiy wiring (CLI / runtime) ────────────────────────────────────────

let qbankStorage: R2StorageProvider | null | undefined

/**
 * PRIVATE qbank bucket'ga ulangan storage (media bucket'idan ALOHIDA).
 * Credential'lar umumiy config.r2'dan, bucket config.qbank.bucket'dan.
 * Sozlanmagan bo'lsa null (runtime fail-open → client legacy yo'lda).
 */
export function getQbankStorage(): R2StorageProvider | null {
  if (qbankStorage !== undefined) return qbankStorage
  const { accountId, accessKeyId, secretAccessKey } = config.r2
  const bucket = config.qbank.bucket
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    qbankStorage = null
  } else {
    qbankStorage = new R2StorageProvider({ accountId, accessKeyId, secretAccessKey, bucket })
  }
  return qbankStorage
}

/** Runtime uchun: cache'li marker o'qish (subjectId → published version). */
export async function getPublishedVersion(subjectId: string): Promise<number | null> {
  if (!config.qbank.enabled || !isQbankSubject(subjectId)) return null
  const cached = markerCache.get(subjectId)
  if (cached && Date.now() - cached.at < MARKER_TTL_MS) return cached.version
  const storage = getQbankStorage()
  let version: number | null = null
  if (storage) {
    try {
      version = await readPublishedVersion(storage, QBANK_SUBJECTS[subjectId].pathSegment)
    } catch {
      version = null // R2 vaqtinchalik uzilgan — legacy fallback (fail-open)
    }
  }
  markerCache.set(subjectId, { at: Date.now(), version })
  return version
}

/** Neon'dan EXPLICIT publik proyeksiya — publish (CLI) uchun, cache'siz. */
export function makeNeonPublishDeps(
  subjectId: QbankSubjectId,
  storage: QbankStorage,
  loadImage: (dbPath: string) => Promise<Buffer | null>,
): PublishDeps {
  const { bankId } = QBANK_SUBJECTS[subjectId]
  return {
    storage,
    loadImage,
    async readVersion() {
      const rows = await db
        .select({ v: questionBanks.contentVersion })
        .from(questionBanks)
        .where(eq(questionBanks.id, bankId))
      return rows[0] ? Number(rows[0].v) : null
    },
    async readRows() {
      // SELECT * TAQIQLANADI — faqat publik ustunlar (correct_answer Neon'dan chiqmaydi)
      return db
        .select({
          id: questions.id,
          externalId: questions.externalId,
          questionUz: questions.questionUz,
          questionRu: questions.questionRu,
          optionsUz: questions.optionsUz,
          optionsRu: questions.optionsRu,
          image: questions.image,
          topicId: questions.topicId,
        })
        .from(questions)
        .where(eq(questions.bankId, bankId))
        .orderBy(asc(questions.id))
    },
    async readTopicIds() {
      const rows = await db
        .select({ id: topics.id })
        .from(topics)
        .where(eq(topics.bankId, bankId))
        .orderBy(asc(topics.id))
      return rows.map((row) => row.id)
    },
  }
}
