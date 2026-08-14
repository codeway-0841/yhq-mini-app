import type { QuestionBankProvider, QuestionRow, TopicRow } from './QuestionBankProvider'
import { db } from '../db/connection'
import { questions, topics } from '../schema'
import { eq, asc, and } from 'drizzle-orm'

// In-memory cache for Russian language questions
const TTL_MS = 5 * 60_000
const cache = new Map<string, { at: number; data: unknown }>()

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T
  const data = await fn()
  cache.set(key, { at: Date.now(), data })
  return data
}

/**
 * RussianQuestionBankProvider — Rus tili savollar bazasi (russian_db) provideri.
 */
export class RussianQuestionBankProvider implements QuestionBankProvider {
  readonly sourceId = 'russian_db'

  getAllQuestions(): Promise<QuestionRow[]> {
    return cached('russian:questions:all', () =>
      db
        .select()
        .from(questions)
        .where(eq(questions.bankId, this.sourceId))
        .orderBy(asc(questions.id)),
    )
  }

  getQuestionById(questionId: number): Promise<QuestionRow | null> {
    return cached(`russian:questions:id:${questionId}`, async () => {
      const [row] = await db
        .select()
        .from(questions)
        .where(and(eq(questions.id, questionId), eq(questions.bankId, this.sourceId)))
      return row ?? null
    })
  }

  getQuestionsByTopic(topicId: number): Promise<QuestionRow[]> {
    return cached(`russian:questions:topic:${topicId}`, () =>
      db
        .select()
        .from(questions)
        .where(and(eq(questions.topicId, topicId), eq(questions.bankId, this.sourceId)))
        .orderBy(asc(questions.id)),
    )
  }

  getTopics(): Promise<TopicRow[]> {
    return cached('russian:topics:all', () =>
      db.select().from(topics).where(eq(topics.bankId, this.sourceId)),
    )
  }

  async getStats(): Promise<{ totalQuestions: number; totalTopics: number }> {
    const [qs, ts] = await Promise.all([this.getAllQuestions(), this.getTopics()])
    return { totalQuestions: qs.length, totalTopics: ts.length }
  }

  invalidateCache(): void {
    cache.clear()
  }
}
