import { asc, eq } from 'drizzle-orm'
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
  findAll() {
    return cached('questions:all', () =>
      db.select().from(questions).orderBy(asc(questions.id)))
  },

  findByTopic(topicId: number) {
    return cached(`questions:topic:${topicId}`, () =>
      db.select().from(questions).where(eq(questions.topicId, topicId)).orderBy(asc(questions.id)))
  },

  findTopics() {
    return cached('topics:all', () => db.select().from(topics))
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
