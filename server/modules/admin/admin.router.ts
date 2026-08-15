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
import { reloadOctagonPools } from '../../octagon'
import { db, executeRows } from '../../db/connection'
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

  // id yo'q bo'lsa — max(id)+1 (seed bilan bir xil strategiya). Parallel admin
  // so'rovlar bir xil max+1 hisoblab 23505 (PK/uq conflict) olishi mumkin —
  // shunda id QAYTA hisoblanib qayta uriniladi (INSERT...RETURNING).
  let newId: number | undefined = body.id
  let insertedId: number | null = null
  for (let attempt = 0; attempt < 3 && insertedId == null; attempt++) {
    if (newId == null) {
      const [row] = await db.select({ maxId: sql<number>`COALESCE(MAX(${questions.id}), 0)` }).from(questions)
      newId = row.maxId + 1
    }
    try {
      const [r] = await db.insert(questions).values({
        id:            newId,
        externalId:    String(newId),  // canonical identity: (bank_id, external_id)
        questionUz:    body.questionUz,
        questionRu:    body.questionRu,
        optionsUz:     body.optionsUz,
        optionsRu:     body.optionsRu,
        correctAnswer: body.correctAnswer,
        image:         body.image ?? null,
        topicId:       body.topicId ?? null,
      }).returning({ id: questions.id })
      insertedId = r.id
    } catch (err) {
      // 23505 = unique_violation — faqat avto-id oqimida qayta hisoblanadi;
      // aniq berilgan id konflikti (yoki boshqa xato) to'g'ridan-to'g'ri yuqoriga
      if (body.id != null || (err as { code?: string })?.code !== '23505' || attempt === 2) throw err
      newId = undefined
    }
  }
  questionsRepository.invalidateCache()
  // Octagon PvP pool staleness himoyasi (o'zgargan/o'chgan savol eski ko'rinishda qolmasin);
  // xatolik savol saqlanishini BEKOR QILMAYDI — savol allaqachon bazada
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))
  res.status(201).json({ id: insertedId, created: true })
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
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))
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
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))
  res.status(204).send()
}))

// ── GET /api/admin/questions — TO'LIQ qatorlar (correctAnswer bilan).
// Public GET /questions javobni endi qaytarmaydi (scoring trust boundary),
// shuning uchun admin panel alohida himoyalangan endpoint'dan oladi. ──
router.get('/admin/questions', wrap(async (_req, res) => {
  res.set('Cache-Control', 'no-store')   // javob kalitlari CDN/browser'da qolmasin
  res.json(await questionsRepository.findAll())
}))

// ── GET /api/admin/questions/meta — statistika (kelajak Dashboard uchun) ──
router.get('/admin/questions/meta', wrap(async (_req, res) => {
  const [stats] = await db
    .select({ total: sql<number>`COUNT(*)::int`, withTopic: sql<number>`COUNT(${questions.topicId})::int` })
    .from(questions)
  res.json(stats)
}))

// ── GET /api/admin/stats — Jonli tizim statistikasi ──
router.get('/admin/stats', wrap(async (_req, res) => {
  const [userStats] = await executeRows<{ totalUsers: number; premiumUsers: number }>(sql`
    SELECT
      COUNT(*)::int AS "totalUsers",
      COUNT(*) FILTER (WHERE tariff = 'premium' OR (premium_until IS NOT NULL AND premium_until > now()))::int AS "premiumUsers"
    FROM users
  `)

  const [questionStats] = await executeRows<{ totalQuestions: number }>(sql`
    SELECT COUNT(*)::int AS "totalQuestions" FROM questions
  `)

  const [progressStats] = await executeRows<{ totalAnswered: number }>(sql`
    SELECT COALESCE(SUM(answered), 0)::int AS "totalAnswered" FROM progress
  `)

  const [promoStats] = await executeRows<{ totalPromoCodes: number }>(sql`
    SELECT COUNT(*)::int AS "totalPromoCodes" FROM promo_codes
  `)

  const [dailyStats] = await executeRows<{ todayActiveUsers: number }>(sql`
    SELECT COUNT(DISTINCT user_id)::int AS "todayActiveUsers"
    FROM daily_records
    WHERE date = to_char(now(), 'YYYY-MM-DD')
  `)

  res.json({
    totalUsers: userStats?.totalUsers ?? 0,
    premiumUsers: userStats?.premiumUsers ?? 0,
    todayActiveUsers: dailyStats?.todayActiveUsers ?? 0,
    totalQuestions: questionStats?.totalQuestions ?? 0,
    totalAnswered: progressStats?.totalAnswered ?? 0,
    totalPromoCodes: promoStats?.totalPromoCodes ?? 0,
  })
}))

// ── GET /api/admin/users — Foydalanuvchilar qidiruvi ──
router.get('/admin/users', wrap(async (req, res) => {
  const q = String(req.query['query'] ?? '').trim()
  let usersList

  if (q) {
    usersList = await executeRows(sql`
      SELECT
        u.id,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.username,
        u.photo_url AS "photoUrl",
        u.phone,
        u.tariff,
        u.premium_until AS "premiumUntil",
        u.is_admin AS "isAdmin",
        u.created_at AS "createdAt",
        COALESCE(p.answered, 0)::int AS answered,
        COALESCE(p.correct, 0)::int AS correct,
        p.league
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id AND p.subject_id = 'yhq'
      WHERE
        u.id ILIKE ${'%' + q + '%'} OR
        u.first_name ILIKE ${'%' + q + '%'} OR
        u.last_name ILIKE ${'%' + q + '%'} OR
        u.username ILIKE ${'%' + q + '%'} OR
        u.phone ILIKE ${'%' + q + '%'}
      ORDER BY u.created_at DESC
      LIMIT 50
    `)
  } else {
    usersList = await executeRows(sql`
      SELECT
        u.id,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.username,
        u.photo_url AS "photoUrl",
        u.phone,
        u.tariff,
        u.premium_until AS "premiumUntil",
        u.is_admin AS "isAdmin",
        u.created_at AS "createdAt",
        COALESCE(p.answered, 0)::int AS answered,
        COALESCE(p.correct, 0)::int AS correct,
        p.league
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id AND p.subject_id = 'yhq'
      ORDER BY u.created_at DESC
      LIMIT 30
    `)
  }

  res.json({ users: usersList })
}))

// ── POST /api/admin/users/:userId/grant-premium — Qo'lda Premium berish ──
const GrantPremiumSchema = z.object({
  tariff: z.enum(['free', 'premium']),
  days: z.number().int().positive().nullable().optional(),
})

router.post(
  '/admin/users/:userId/grant-premium',
  validate({ body: GrantPremiumSchema }),
  wrap(async (req, res) => {
    const userId = String(req.params['userId'])
    const { tariff, days } = req.body as z.infer<typeof GrantPremiumSchema>

    if (tariff === 'free') {
      await executeRows(sql`
        UPDATE users
        SET tariff = 'free', premium_until = NULL, updated_at = now()
        WHERE id = ${userId}
      `)
    } else if (days && days > 0) {
      await executeRows(sql`
        UPDATE users
        SET
          tariff = 'premium',
          premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${days}::int),
          updated_at = now()
        WHERE id = ${userId}
      `)
    } else {
      // Lifetime premium
      await executeRows(sql`
        UPDATE users
        SET tariff = 'premium', premium_until = NULL, updated_at = now()
        WHERE id = ${userId}
      `)
    }

    const updated = await executeRows(sql`
      SELECT id, first_name AS "firstName", tariff, premium_until AS "premiumUntil"
      FROM users
      WHERE id = ${userId}
    `)

    res.json({ ok: true, user: updated[0] })
  }),
)

export default router
