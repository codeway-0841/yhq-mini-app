import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { questions, topics, questionExplanations } from '../../schema'
import { invalidateBankVersions } from './bank-version'

// In-memory TTL cache — questions/topics change rarely (manual seed only),
// so there's no need to hit the DB on every request.
// EGRESS TEJASH (2026-09-16 Neon overage): TTL 5 → 30 min (6x kam DB refetch).
// Admin CRUD'dan keyin invalidateCache() darhol tozalaydi — eskirgan kontent
// faqat tabiiy TTL ichida yashaydi.
const TTL_MS = 30 * 60_000
const cache  = new Map<string, { at: number; data: unknown }>()

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T
  const data = await fn()
  cache.set(key, { at: Date.now(), data })
  return data
}

export const questionsRepository = {
  // ORDER BY id — deterministik tartib SHART: Biletlar seededShuffle massiv
  // tartibiga bog'liq; tartibsiz SELECT reseed'dan keyin bilet tarkibini buzardi.
  findAll(bankId = 'traffic_rules_db') {
    return cached(`questions:all:${bankId}`, () =>
      db
        .select()
        .from(questions)
        .where(eq(questions.bankId, bankId))
        .orderBy(asc(questions.id)),
    )
  },

  countByBank(bankId = 'traffic_rules_db'): Promise<number> {
    return cached(`questions:count:${bankId}`, async () => {
      const [row] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(questions)
        .where(eq(questions.bankId, bankId))
      return Number(row?.count ?? 0)
    })
  },

  /** Mavzu katalogi uchun savollar soni (v2: UI full-bank'siz katalog chizadi).
   *  Javob kaliti/tekst YO'Q — faqat id→count (public metadata). */
  countByTopic(bankId = 'traffic_rules_db'): Promise<Map<number, number>> {
    return cached(`questions:count-by-topic:${bankId}`, async () => {
      const rows = await db
        .select({ topicId: questions.topicId, count: sql<number>`COUNT(*)::int` })
        .from(questions)
        .where(eq(questions.bankId, bankId))
        .groupBy(questions.topicId)
      return new Map(
        rows
          .filter((row) => row.topicId !== null)
          .map((row) => [row.topicId as number, Number(row.count)]),
      )
    })
  },

  /** Readiness check — question pool loaded va non-empty.
   *  EGRESS (2026-09-21 Neon overage): ilgari findAll('traffic_rules_db') —
   *  BUTUN bankni (~1-1.5MB) tortardi, /api/ready esa har TestPage mount'ida +
   *  har 4 daqiqalik keep-alive'da uriladi (har sovuq lambda + TTL expiry).
   *  Endi 1-qatorlik arzon probe (~100 bayt). Cache'siz — readiness SOF bo'lishi
   *  kerak (aks holda DB o'lganda ham keshdan "ready" qaytardi). */
  async isPoolReady(): Promise<boolean> {
    try {
      const rows = await db
        .select({ one: sql<number>`1` })
        .from(questions)
        .where(eq(questions.bankId, 'traffic_rules_db'))
        .limit(1)
      return rows.length > 0
    } catch (err) {
      console.error('[questions] Pool readiness check failed:', err)
      return false
    }
  },

  findById(questionId: number, bankId = 'traffic_rules_db') {
    return cached(`questions:id:${bankId}:${questionId}`, async () => {
      const [row] = await db
        .select()
        .from(questions)
        .where(and(eq(questions.id, questionId), eq(questions.bankId, bankId)))
      return row ?? null
    })
  },

  findByTopic(topicId: number, bankId = 'traffic_rules_db') {
    return cached(`questions:topic:${bankId}:${topicId}`, () =>
      db
        .select()
        .from(questions)
        .where(and(eq(questions.topicId, topicId), eq(questions.bankId, bankId)))
        .orderBy(asc(questions.id)),
    )
  },

  findTopics(bankId = 'traffic_rules_db') {
    return cached(`topics:all:${bankId}`, () =>
      // Seed order is the printed bank order (topic serial id); keep it
      // deterministic for the variant picker and topic navigation.
      db.select().from(topics).where(eq(topics.bankId, bankId)).orderBy(asc(topics.id)),
    )
  },

  /** Admin CRUD'dan keyin cache'ni tozalash — aks holda 5 daqiqagacha
      eski savollar qaytadi (TTL 300s). Bank versiyasi keshi ham tozalanadi —
      aks holda client persist-keshi eski versiyani "to'g'ri" deb 30 daqiqagacha
      yangi kontentni tortmas edi. */
  invalidateCache() {
    cache.clear()
    invalidateBankVersions()
  },

  /** Statik tushuntirish (free foydalanuvchilar uchun AI Tutor o'rniga) — yo'q bo'lsa null */
  findExplanation(questionId: number): Promise<{ explanationUz: string; explanationRu: string } | null> {
    return cached(`explanation:${questionId}`, async () => {
      const [row] = await db
        .select({ explanationUz: questionExplanations.explanationUz, explanationRu: questionExplanations.explanationRu })
        .from(questionExplanations)
        .where(eq(questionExplanations.questionId, questionId))
      return row ?? null
    })
  },

  async search(bankId = 'traffic_rules_db', query: string, language: 'uz' | 'ru', limit = 30): Promise<Array<{ id: number; text: string; topicId: number | null }>> {
    const column = language === 'ru' ? questions.questionRu : questions.questionUz
    // LIKE wildcard escape: `%`/`_`/`\` so'zma-so'z qidiriladi — aks holda
    // "%%" so'rovi butun bankni qaytarib, search full-bank enumeration
    // yo'liga aylanardi (question-bank-protection v2).
    const searchPattern = `%${escapeLikePattern(query)}%`
    const rows = await db
      .select({
        id: questions.id,
        text: column,
        topicId: questions.topicId,
      })
      .from(questions)
      .where(and(
        eq(questions.bankId, bankId),
        sql`${column} ILIKE ${searchPattern} ESCAPE '\'`,
      ))
      .limit(limit)
    return rows
  },
}

/**
 * SQL LIKE pattern escape (`%`, `_`, `\` → literal).
 * Sof funksiya — unit testlar to'g'ridan-to'g'ri chaqiradi.
 */
export function escapeLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}
