/**
 * Admin router — savollar CRUD (savol bazasini boshqarish).
 *
 * Barcha route'lar `requireAdmin` middleware ortida (401/403 qaytaradi).
 * Katta formatlar QuestionBankProvider'ga taalluqli emas — bu ROOT admin o'yini
 * faqat YHQ bazasiga (hozirma main question storage'ga) yozadi.
 *
 * Kelajakda har bir yangi provider o'z CRUD'ini qo'yishi mumkin (Strategy).
 */

import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { rateLimit } from '../../middleware/rate-limiter'
import { requireAdmin } from '../../middleware/admin'
import { questionsRepository } from '../questions/questions.repository'
import { db } from '../../db/connection'
import { questions, questionExplanations, savedQuestions } from '../../schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

const router = Router()

// ── Rate limiting: admin operatsiyalar uchun juda past (abuse himoyasi) ──
router.use('/admin', rateLimit({ maxPerMinute: 20, keyFn: (req) => req.ip ?? 'unknown' }))
router.use('/admin', requireAdmin)   // ← barcha CRUD admin bo'lishi shart

const OptionsSchema = z
  .record(z.string().regex(/^[A-Z]\d+$/), z.string().min(1))   // kalitlar: F1, F2, ...
  .refine((rec) => Object.keys(rec).length >= 2, { message: 'Kamida 2 variant kerak' })

const QuestionUpsert = z.object({
  id: z.number().int().positive().optional(),        // yangi savol — id avto (max+1)
  questionUz: z.string().min(3).max(2000),
  questionRu: z.string().min(3).max(2000),
  optionsUz: OptionsSchema,
  optionsRu: OptionsSchema,
  correctAnswer: z.string().regex(/^[A-Z]\d+$/, { message: 'F1, F2, ... format' }),
  // Relative path (images/q071.jpg) ham, to'liq URL ham — seed formati relative
  image: z.string().max(500).nullable().optional(),
  topicId: z.number().int().positive().nullable().optional(),
}).refine((q) => {
  // Uzbek/Rus variant kalitlari bir xil bo'lishi shart
  const uzKeys = Object.keys(q.optionsUz)
  const ruKeys = Object.keys(q.optionsRu)
  if (uzKeys.length !== ruKeys.length || !uzKeys.every((k) => ruKeys.includes(k))) return false
  // To'g'ri javob variantlarda bo'lishi shart
  return uzKeys.includes(q.correctAnswer)
}, { message: 'UZ/RU variant kalitlari bir xil bo\'lishi va correctAnswer variantda bo\'lishi shart' })

type UpsertBody = z.infer<typeof QuestionUpsert>

// ── POST /api/admin/questions — yangi savol yaratish ──
router.post('/admin/questions', validate({ body: QuestionUpsert }), wrap(async (req, res) => {
  const body = req.body as UpsertBody

  // id yo'q bo'lsa — max(id)+1 (seed bilan bir xil strategiya)
  let newId = body.id
  if (newId == null) {
    const [row] = await db.select({ maxId: sql<number>`COALESCE(MAX(${questions.id}), 0)` }).from(questions)
    newId = row.maxId + 1
  }

  await db.insert(questions).values({
    id:            newId,
    questionUz:    body.questionUz,
    questionRu:    body.questionRu,
    optionsUz:     body.optionsUz,
    optionsRu:     body.optionsRu,
    correctAnswer: body.correctAnswer,
    image:         body.image ?? null,
    topicId:       body.topicId ?? null,
  })
  questionsRepository.invalidateCache()
  res.status(201).json({ id: newId, created: true })
}))

// ── PUT /api/admin/questions/:id — tahrirlash ──
router.put('/admin/questions/:id', validate({ body: QuestionUpsert }), wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Noto'g'ri id")
  const body = req.body as UpsertBody

  const updated = await db
    .update(questions)
    .set({
      questionUz:    body.questionUz,
      questionRu:    body.questionRu,
      optionsUz:     body.optionsUz,
      optionsRu:     body.optionsRu,
      correctAnswer: body.correctAnswer,
      image:         body.image ?? null,
      topicId:       body.topicId ?? null,
    })
    .where(eq(questions.id, id))
    .returning({ id: questions.id })

  if (updated.length === 0) throw new AppError(404, 'Savol topilmadi')
  questionsRepository.invalidateCache()
  res.json({ id, updated: true })
}))

// ── DELETE /api/admin/questions/:id ──
router.delete('/admin/questions/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Noto'g'ri id")

  // Bog'liq yozuvlarni ham o'chir (saved_questions FK cascade emasdi schemada —
  // xavfsizlik uchun avval manual tekshirish)
  await db.delete(savedQuestions).where(eq(savedQuestions.questionId, id))
  await db.delete(questionExplanations).where(eq(questionExplanations.questionId, id))
  const deleted = await db.delete(questions).where(eq(questions.id, id)).returning({ id: questions.id })

  if (deleted.length === 0) throw new AppError(404, 'Savol topilmadi')
  questionsRepository.invalidateCache()
  res.status(204).send()
}))

// ── GET /api/admin/questions/meta — statistika (kelajak Dashboard uchun) ──
router.get('/admin/questions/meta', wrap(async (_req, res) => {
  const [stats] = await db
    .select({ total: sql<number>`COUNT(*)::int`, withTopic: sql<number>`COUNT(${questions.topicId})::int` })
    .from(questions)
  res.json(stats)
}))

export default router
