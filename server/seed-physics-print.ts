import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { db } from './db/connection'
import { questionBanks, questions, topics } from './schema'

type Bank = {
  bankId: string
  bankName: string
  topics: Array<{ externalId: string; nameUz: string; nameRu: string }>
  items: Array<{
    externalId: string
    topicExternalId: string
    questionUz: string
    questionRu: string
    optionsUz: Record<string, string>
    optionsRu: Record<string, string>
    correctAnswer: string
    image: string | null
  }>
}

/** Idempotent local import of the extracted Physics Test Print bank. */
async function seed(): Promise<void> {
  const file = path.resolve(process.cwd(), 'content-banks/fizika/physics-print.json')
  const bank = JSON.parse(fs.readFileSync(file, 'utf8')) as Bank
  await db.insert(questionBanks).values({ id: bank.bankId, name: bank.bankName }).onConflictDoNothing()

  for (const topic of bank.topics) {
    await db.insert(topics).values({
      bankId: bank.bankId,
      slug: `${bank.bankId}-${topic.externalId}`,
      nameUz: topic.nameUz,
      nameRu: topic.nameRu,
    }).onConflictDoNothing()
  }

  const topicRows = await db.select().from(topics).where(eq(topics.bankId, bank.bankId))
  const topicIds = new Map(topicRows.map((topic) => [topic.slug.slice(`${bank.bankId}-`.length), topic.id]))
  const [max] = await db.select({ id: sql<number>`COALESCE(MAX(${questions.id}), 0)` }).from(questions)
  const existingRows = await db.select({ id: questions.id, externalId: questions.externalId }).from(questions).where(eq(questions.bankId, bank.bankId))
  const existing = new Set(existingRows.map((q) => q.externalId))
  const existingIds = new Map(existingRows.map((q) => [q.externalId, q.id]))
  let nextId = Number(max?.id ?? 0) + 1
  const rows = bank.items.filter((item) => !existing.has(item.externalId)).map((item) => ({
    id: nextId++, bankId: bank.bankId, externalId: item.externalId,
    questionUz: item.questionUz, questionRu: item.questionRu,
    optionsUz: item.optionsUz, optionsRu: item.optionsRu,
    correctAnswer: item.correctAnswer, image: item.image,
    topicId: topicIds.get(item.topicExternalId) ?? null,
  }))
  for (let i = 0; i < rows.length; i += 100) await db.insert(questions).values(rows.slice(i, i + 100))
  // Re-imports also refresh text/options/image paths when the extractor is
  // improved. Updates are issued in bounded parallel batches to avoid a huge
  // single SQL statement and remain safe by canonical externalId.
  const updates = bank.items.filter((item) => existingIds.has(item.externalId))
  for (let i = 0; i < updates.length; i += 100) {
    await Promise.all(updates.slice(i, i + 100).map((item) => db.update(questions).set({
      questionUz: item.questionUz, questionRu: item.questionRu,
      optionsUz: item.optionsUz, optionsRu: item.optionsRu,
      correctAnswer: item.correctAnswer, image: item.image,
      topicId: topicIds.get(item.topicExternalId) ?? null,
    }).where(and(eq(questions.id, existingIds.get(item.externalId)!), eq(questions.bankId, bank.bankId)))))
  }
  console.log(`Physics Test Print: ${rows.length} new questions, ${updates.length} existing questions refreshed`)
}

seed().catch((error) => { console.error(error); process.exitCode = 1 })
