#!/usr/bin/env tsx
/**
 * Matematika Test Print bankini Neon DB'ga import qiladi (idempotent).
 *
 * - question_banks: 'math_db' qatori (ON CONFLICT DO NOTHING)
 * - topics: 368 variant, slug = `math_db-{externalId}` (production fizika konvensiyasi)
 * - questions: 11,040 savol, canonical externalId = `mtp-*` SAQLANADI
 *   (admin bulk-import endpoint externalId'ni numeric qiladi — shuning uchun alohida skript)
 *
 * Ishlatish:
 *   npx tsx scripts/import-math-bank.ts            # prod (.env DATABASE_URL)
 *   DATABASE_URL="$TEST_DATABASE_URL" npx tsx scripts/import-math-bank.ts  # test DB
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { executeRows } from '../server/db/connection'

const BANK_ID = 'math_db'
const BANK_NAME = 'Matematika Test Print'
const JSON_PATH = path.resolve(process.cwd(), 'content-banks/matematika/math-print.json')
const CHUNK_SIZE = 500
const EXPECTED_TOPICS = 368
const EXPECTED_ITEMS = 11040
const QUESTIONS_PER_TOPIC = 30

interface BankTopic { externalId: string; nameUz: string; nameRu: string }
interface BankItem {
  externalId: string
  topicExternalId: string
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  correctAnswer: string
  source: string
  image: string | null
}
interface BankFile {
  version: number
  subjectId: string
  bankId: string
  bankName: string
  topics: BankTopic[]
  items: BankItem[]
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL topilmadi (.env)')
  if (!fs.existsSync(JSON_PATH)) throw new Error(`Bank fayli topilmadi: ${JSON_PATH}`)

  const bank = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as BankFile
  if (bank.bankId !== BANK_ID) throw new Error(`bankId kutilgan ${BANK_ID}, actual ${bank.bankId}`)
  if (bank.topics.length !== EXPECTED_TOPICS) throw new Error(`topics ${bank.topics.length} != ${EXPECTED_TOPICS}`)
  if (bank.items.length !== EXPECTED_ITEMS) throw new Error(`items ${bank.items.length} != ${EXPECTED_ITEMS}`)

  const perTopic = new Map<string, number>()
  for (const item of bank.items) perTopic.set(item.topicExternalId, (perTopic.get(item.topicExternalId) ?? 0) + 1)
  for (const topic of bank.topics) {
    if (perTopic.get(topic.externalId) !== QUESTIONS_PER_TOPIC) {
      throw new Error(`topic ${topic.externalId}: ${perTopic.get(topic.externalId)} != ${QUESTIONS_PER_TOPIC} savol`)
    }
  }
  console.log(`✅ Bank fayli tekshirildi: ${EXPECTED_TOPICS} topics, ${EXPECTED_ITEMS} items`)

  const before = await executeRows<{ q: number; t: number }>(sql`
    SELECT (SELECT COUNT(*)::int FROM questions WHERE bank_id = ${BANK_ID}) AS q,
           (SELECT COUNT(*)::int FROM topics WHERE bank_id = ${BANK_ID}) AS t
  `)
  console.log('Importdan oldin math_db:', before[0])

  // 1. Bank qatori
  await executeRows(sql`
    INSERT INTO question_banks (id, name) VALUES (${BANK_ID}, ${BANK_NAME})
    ON CONFLICT (id) DO NOTHING
  `)

  // 2. Topics (slug = math_db-{externalId}, fizika production konvensiyasi)
  const topicRows = bank.topics.map((t) => ({ ...t, slug: `${BANK_ID}-${t.externalId}` }))
  const insertedTopics = await executeRows<{ id: number }>(sql`
    INSERT INTO topics (name_uz, name_ru, slug, bank_id)
    VALUES ${sql.join(topicRows.map((t) => sql`(${t.nameUz}, ${t.nameRu}, ${t.slug}, ${BANK_ID})`), sql`, `)}
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `)
  console.log(`Topics: ${insertedTopics.length} yangi qator kiritildi`)

  const dbTopics = await executeRows<{ id: number; slug: string }>(sql`
    SELECT id, slug FROM topics WHERE bank_id = ${BANK_ID}
  `)
  if (dbTopics.length !== EXPECTED_TOPICS) throw new Error(`DB topics ${dbTopics.length} != ${EXPECTED_TOPICS}`)
  const topicIdBySlug = new Map(dbTopics.map((t) => [t.slug, t.id]))
  const topicIdFor = (externalId: string): number => {
    const id = topicIdBySlug.get(`${BANK_ID}-${externalId}`)
    if (id === undefined) throw new Error(`topic topilmadi: ${externalId}`)
    return id
  }

  // 3. Questions — explicit id (global MAX+1), canonical externalId bilan
  const maxRow = await executeRows<{ max: number }>(sql`SELECT COALESCE(MAX(id), 0)::int AS max FROM questions`)
  let nextId = (maxRow[0]?.max ?? 0) + 1
  console.log(`Questions id boshlanishi: ${nextId}`)

  let insertedQuestions = 0
  for (let start = 0; start < bank.items.length; start += CHUNK_SIZE) {
    const chunk = bank.items.slice(start, start + CHUNK_SIZE)
    const values = chunk.map((it) => {
      const id = nextId++
      return sql`(${id}, ${BANK_ID}, ${it.externalId}, ${it.questionUz}, ${it.questionRu},
        ${JSON.stringify(it.optionsUz)}::jsonb, ${JSON.stringify(it.optionsRu)}::jsonb,
        ${it.correctAnswer}, ${it.image}, ${topicIdFor(it.topicExternalId)})`
    })
    const rows = await executeRows<{ id: number }>(sql`
      INSERT INTO questions (id, bank_id, external_id, question_uz, question_ru,
        options_uz, options_ru, correct_answer, image, topic_id)
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (bank_id, external_id) DO NOTHING
      RETURNING id
    `)
    insertedQuestions += rows.length
    process.stdout.write(`\rQuestions: ${Math.min(start + CHUNK_SIZE, bank.items.length)}/${bank.items.length} (${insertedQuestions} yangi)`)
  }
  console.log('')

  // 4. Yakuniy tekshiruv
  const after = await executeRows<{ q: number; t: number }>(sql`
    SELECT (SELECT COUNT(*)::int FROM questions WHERE bank_id = ${BANK_ID}) AS q,
           (SELECT COUNT(*)::int FROM topics WHERE bank_id = ${BANK_ID}) AS t
  `)
  console.log('Importdan keyin math_db:', after[0])

  if (after[0]?.q !== EXPECTED_ITEMS || after[0]?.t !== EXPECTED_TOPICS) {
    throw new Error(`Post-check FAILED: questions=${after[0]?.q}, topics=${after[0]?.t}`)
  }
  console.log(`🎉 MUVAFFAQIYAT: math_db = ${EXPECTED_ITEMS} savol, ${EXPECTED_TOPICS} mavzu (yangi: ${insertedQuestions} savol, ${insertedTopics.length} topic)`)
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
