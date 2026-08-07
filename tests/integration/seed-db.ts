/**
 * Integration test DB seeder — IDEMPOTENT minimal savollar.
 *
 * Ba'zi testlar (masalan security-critical) questions jadvalidan
 * `limit 1` o'qiydi; bo'sh CI bazasida ularning o'tishi uchun minimal
 * kontent kiritiladi. Ma'lumot allaqachon bo'lsa HECH NIMA QILINMAYDI.
 *
 * Ishga tushirish (faqat TEST bazaga!):
 *   NODE_ENV=test TEST_DATABASE_URL=... npx tsx tests/integration/seed-db.ts
 */
import 'dotenv/config'
process.env.NODE_ENV = 'test'

const { db }  = await import('../../server/db/connection')
const { questions, topics } = await import('../../server/schema')

const existing = await db.select({ id: questions.id }).from(questions).limit(1)
if (existing.length > 0) {
  console.log(`[seed-test] questions allaqachon bor (${existing.length}+) — o'tkazildi`)
  process.exit(0)
}

const [topic] = await db.insert(topics).values({
  nameUz: 'Test mavzu', nameRu: 'Тестовая тема', slug: 'test-topic',
}).onConflictDoNothing().returning()

const topicId = topic?.id ?? (await db.select({ id: topics.id }).from(topics).limit(1))[0].id

await db.insert(questions).values([
  { id: 900001, questionUz: 'Test savoli 1?', questionRu: 'Тестовый вопрос 1?', optionsUz: { F1: 'A', F2: 'B' }, optionsRu: { F1: 'А', F2: 'Б' }, correctAnswer: 'F1', topicId },
  { id: 900002, questionUz: 'Test savoli 2?', questionRu: 'Тестовый вопрос 2?', optionsUz: { F1: 'A', F2: 'B' }, optionsRu: { F1: 'А', F2: 'Б' }, correctAnswer: 'F2', topicId },
  { id: 900003, questionUz: 'Test savoli 3?', questionRu: 'Тестовый вопрос 3?', optionsUz: { F1: 'A', F2: 'B' }, optionsRu: { F1: 'А', F2: 'Б' }, correctAnswer: 'F1', topicId },
]).onConflictDoNothing()

console.log('[seed-test] 3 ta test savoli kiritildi (topic: test-topic)')
process.exit(0)
