/**
 * Statik tushuntirishlar seeder'i — FREE foydalanuvchilar uchun
 * (AI Tutor premium-only bo'lgani uchun muqobil).
 *
 * Strategiya: har bir savol → topicId → topic.slug → MODULE_TOPICS →
 * modulning 1-darsi. Dars matnining birinchi 2 paragrafi tushuntirish bo'ladi.
 * To'g'ri javob matni birinchi qatorda ko'rsatiladi (kontekst uchun).
 *
 * Idempotent: onConflictDoNothing — qayta ishga tushirsa dublikat bo'lmaydi.
 * Question o'chirilsa (reseed) cascade o'chadi.
 *
 * Ishga tushirish: npx tsx server/seed-explanations.ts
 */
import 'dotenv/config'
import { db } from './db/connection'
import { questions, topics, questionExplanations } from './schema'
import { MODULE_TOPICS } from '../src/data/modules'
import { lessons } from '../src/data/lessons'

// slug → modId (teskari map)
const SLUG_TO_MODULE: Record<string, number> = {}
for (const [modId, slugs] of Object.entries(MODULE_TOPICS)) {
  for (const slug of slugs) SLUG_TO_MODULE[slug] = Number(modId)
}

function buildExplanation(
  correctText: string,
  lesson: { titleUz: string; titleRu: string; bodyUz: string[]; bodyRu: string[] },
): { uz: string; ru: string } {
  // Dars matnidan birinchi 2 paragraf + modul sarlavhasi (kontekst)
  const uzBody = lesson.bodyUz.slice(0, 2).join('\n\n')
  const ruBody = lesson.bodyRu.slice(0, 2).join('\n\n')
  return {
    uz: `✅ To'g'ri javob: ${correctText}\n\n📖 ${lesson.titleUz}\n${uzBody}`,
    ru: `✅ Правильный ответ: ${correctText}\n\n📖 ${lesson.titleRu}\n${ruBody}`,
  }
}

const allTopics = await db.select().from(topics)
const topicById = new Map(allTopics.map((t) => [t.id, t]))

const allQuestions = await db.select().from(questions)

const rows: { questionId: number; explanationUz: string; explanationRu: string }[] = []
let skipped = 0

for (const q of allQuestions) {
  if (!q.topicId) { skipped++; continue }
  const topic = topicById.get(q.topicId)
  if (!topic) { skipped++; continue }
  const modId = SLUG_TO_MODULE[topic.slug]
  if (!modId) { skipped++; continue }                       // mapping yo'q slug
  const lesson = lessons[modId]?.[0]
  if (!lesson) { skipped++; continue }

  // To'g'ri javob matni — savolning o'z options'idan
  const correctUz = q.optionsUz[q.correctAnswer] ?? q.correctAnswer
  const { uz, ru } = buildExplanation(correctUz, lesson)
  rows.push({ questionId: q.id, explanationUz: uz, explanationRu: ru })
}

if (rows.length > 0) {
  await db.insert(questionExplanations).values(rows).onConflictDoNothing()
}

console.log(`✅ Seeded ${rows.length} explanations; skipped ${skipped} (topic/modul mapping yo'q)`)
process.exit(0)
