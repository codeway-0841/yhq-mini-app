import { eq } from 'drizzle-orm'
import { db } from '../../db/connection'
import { questions, topics } from '../../schema'

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
  findAll() {
    return cached('questions:all', () => db.select().from(questions))
  },

  findByTopic(topicId: number) {
    return cached(`questions:topic:${topicId}`, () =>
      db.select().from(questions).where(eq(questions.topicId, topicId)))
  },

  findTopics() {
    return cached('topics:all', () => db.select().from(topics))
  },
}
