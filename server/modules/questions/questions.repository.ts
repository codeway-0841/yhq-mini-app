import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { questions, topics, questionExplanations } from '../../schema'

// In-memory TTL cache — questions/topics change rarely (manual seed only),
// so there's no need to hit the DB on every request.
const TTL_MS = 5 * 60_000
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

  /** Readiness check — question pool loaded va non-empty */
  async isPoolReady(): Promise<boolean> {
    try {
      const pool = await questionsRepository.findAll('traffic_rules_db')
      return pool.length > 0
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
      db.select().from(topics).where(eq(topics.bankId, bankId)),
    )
  },

  /** Admin CRUD'dan keyin cache'ni tozalash — aks holda 5 daqiqagacha
      eski savollar qaytadi (TTL 300s) */
  invalidateCache() {
    cache.clear()
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
}
