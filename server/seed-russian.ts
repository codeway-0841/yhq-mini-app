import 'dotenv/config'
// Prod xavfsizligi (audit B3): prod DB'da FAQAT aniq --yes bayrog'i bilan.
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--yes')) {
  console.error("DIQQAT: NODE_ENV=production — seed prod DB'ga YOZADI. Davom etish uchun: --yes")
  process.exit(1)
}
import { db } from './db/connection'
import { questionBanks, topics, questions } from './schema'
import { eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'

const RUSSIAN_TOPICS = [
  { slug: 'rus-fonetika-grafika', nameUz: 'Fonetika va grafika', nameRu: 'Фонетика и графика' },
  { slug: 'rus-leksika-frazeologiya', nameUz: 'Leksikologiya va frazeologiya', nameRu: 'Лексикология и фразеология' },
  { slug: 'rus-morfemika-slovoobrazovaniye', nameUz: 'Morfemika va so‘z yasalishi', nameRu: 'Морфемика и словообразование' },
  { slug: 'rus-orfografiya', nameUz: 'Orfografiya va orfoepiya', nameRu: 'Орфография и орфоэпия' },
  { slug: 'rus-morfologiya', nameUz: 'Morfologiya va so‘z turkumlari', nameRu: 'Морфология и части речи' },
  { slug: 'rus-literatura', nameUz: 'Rus adabiyoti (XIX-XX asr)', nameRu: 'Русская литература (XIX-XX вв.)' },
]

async function seedRussian() {
  console.log('🇷🇺 Rus tili savollar bazasi (russian_db) yuklanmoqda...')

  // 1. Question bank qatori
  await db
    .insert(questionBanks)
    .values({
      id: 'russian_db',
      name: 'Rus tili va adabiyoti savollar bazasi',
    })
    .onConflictDoNothing()

  // 2. Topics kiritish
  await db
    .insert(topics)
    .values(
      RUSSIAN_TOPICS.map((t) => ({
        nameUz: t.nameUz,
        nameRu: t.nameRu,
        slug: t.slug,
        bankId: 'russian_db',
      })),
    )
    .onConflictDoNothing()

  const allTopics = await db.select().from(topics).where(eq(topics.bankId, 'russian_db'))
  const slugToId = Object.fromEntries(allTopics.map((t) => [t.slug, t.id]))

  // 3. Savollar ro'yxatini yuklash
  const jsonPath = path.resolve(process.cwd(), 'content/russian_questions.json')
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Savollar fayli topilmadi: ${jsonPath}`)
  }

  const rawQuestions: Array<{
    id: number
    variant: number
    qIndex: number
    externalId: string
    questionUz: string
    questionRu: string
    optionsUz: Record<string, string>
    optionsRu: Record<string, string>
    correctAnswer: string
    topicSlug: string
  }> = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  // Delete any existing questions for russian_db to guarantee clean update
  await db.delete(questions).where(eq(questions.bankId, 'russian_db'))

  // Insert in batches of 100
  let inserted = 0
  for (let i = 0; i < rawQuestions.length; i += 100) {
    const batch = rawQuestions.slice(i, i + 100).map((q) => {
      const slug = q.topicSlug.startsWith('rus-') ? q.topicSlug : `rus-${q.topicSlug}`
      const topicId = slugToId[slug] ?? slugToId['rus-orfografiya'] ?? null

      return {
        id: q.id,
        bankId: 'russian_db' as const,
        externalId: q.externalId,
        questionUz: q.questionUz || q.questionRu,
        questionRu: q.questionRu,
        optionsUz: q.optionsUz,
        optionsRu: q.optionsRu,
        correctAnswer: q.correctAnswer,
        image: null,
        topicId,
      }
    })

    await db.insert(questions).values(batch)
    inserted += batch.length
  }

  console.log(`✅ Rus tili fani uchun ${inserted} ta savol to'liq matn va variantlari bilan muvaffaqiyatli yuklandi!`)
}

seedRussian()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Xatolik:', err)
    process.exit(1)
  })
