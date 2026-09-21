import { createHash } from 'node:crypto'
import type { QuestionBankProvider, QuestionRow, TopicRow } from '../../providers/QuestionBankProvider'

/**
 * Bank kontent VERSIYASI — client persist-keshining (IndexedDB) ishonch manbai.
 *
 * EGRESS (2026-09-21, "A" bosqich): ilgari client har app launch'da butun
 * bankni (5-13MB) qayta tortardi, chunki kesh faqat RAM'da edi (TG Mini App
 * sahifani har ochishda reload qiladi). Endi client bankni server versiyasi
 * BILAN IndexedDB'ga yozadi: keyingi launch'da faqat `GET /questions/version`
 * (~40 bayt) so'raladi — versiya bir xil bo'lsa bank QAYTA TORTILMAYDI.
 *
 * Xavfsizlik: hash FAQAT public payload'dan (correctAnswer'siz) hisoblanadi —
 * client hech qachon ko'rmaydigan maydon (correctAnswer) versiyani
 * o'zgartirmaydi ham: admin faqat javob kalitini tuzatsa, client keshi
 * bekor qilinMAYDI (u baribir uni ko'rmaydi).
 */

const TTL_MS = 30 * 60_000 // questions.repository TTL bilan bir xil
const cache = new Map<string, { at: number; v: string }>()

/**
 * Public kontentning barqaror fingerprint'i.
 * Deterministik: bir xil qatorlar → har lambda'da bir xil hash
 * (JSONB kalit tartibi PG'da normalize bo'lgani uchun JSON.stringify barqaror).
 * Tezlik: md5 (kriptografik emas — bu faqat o'zgarish detektori).
 */
export function hashBankContent(rows: QuestionRow[], topicRows: TopicRow[]): string {
  const hash = createHash('md5')
  for (const q of rows) {
    hash.update(String(q.id))
    hash.update('')
    hash.update(q.externalId ?? '')
    hash.update('')
    hash.update(q.questionUz ?? '')
    hash.update('')
    hash.update(q.questionRu ?? '')
    hash.update('')
    hash.update(JSON.stringify(q.optionsUz))
    hash.update('')
    hash.update(JSON.stringify(q.optionsRu))
    hash.update('')
    hash.update(q.image ?? '')
    hash.update('')
    hash.update(String(q.topicId ?? ''))
    hash.update('\x1e') // record separator
  }
  hash.update('\x1f') // topics bo'limi
  for (const t of topicRows) {
    hash.update(String(t.id))
    hash.update('')
    hash.update(t.nameUz ?? '')
    hash.update('')
    hash.update(t.nameRu ?? '')
    hash.update('')
    hash.update(t.slug ?? '')
    hash.update('\x1e')
  }
  return hash.digest('hex')
}

/**
 * Provider bank'ining joriy kontent versiyasi (30 daq per-lambda kesh).
 * Provider'lar o'zi ham keshli (repo 30daq / russian 5daq) — admin CRUD
 * invalidateCache() orqali hammasini birdan tozalaydi (quyida ulanadi).
 */
export async function bankContentVersion(provider: QuestionBankProvider): Promise<string> {
  const hit = cache.get(provider.sourceId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v
  const [rows, topicRows] = await Promise.all([provider.getAllQuestions(), provider.getTopics()])
  const v = hashBankContent(rows, topicRows)
  cache.set(provider.sourceId, { at: Date.now(), v })
  return v
}

/** Admin CRUD'dan keyin — questionsRepository.invalidateCache() ichidan chaqiriladi. */
export function invalidateBankVersions(): void {
  cache.clear()
}

/** Testlar uchun — kesh holatini qo'lda tozalash. */
export function _clearVersionCacheForTests(): void {
  cache.clear()
}
