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
import { questions, questionExplanations, savedQuestions, topics, questionBanks } from '../../schema'
import { SUBJECT_REGISTRY } from '../../config/subjects'
import { eq, asc, sql } from 'drizzle-orm'

const router = Router()

function resolveBankId(subjectOrBank: string | undefined): string {
  if (!subjectOrBank) return 'traffic_rules_db'
  const matchDataSource = SUBJECT_REGISTRY.find((s) => s.dataSourceId === subjectOrBank)
  if (matchDataSource) return subjectOrBank
  const matchSubject = SUBJECT_REGISTRY.find((s) => s.id === subjectOrBank)
  return matchSubject ? matchSubject.dataSourceId : 'traffic_rules_db'
}

// ── Rate limiting: admin operatsiyalar uchun juda past (abuse himoyasi) ──
router.use('/admin', rateLimit({ maxPerMinute: 20, keyFn: (req) => req.ip ?? 'unknown' }))
router.use('/admin', requireAdmin)   // ← barcha CRUD admin bo'lishi shart

const OptionsSchema = z
  .record(z.string().regex(/^[A-Z]\d+$/), z.string().min(1))   // kalitlar: F1, F2, ...
  .refine((rec) => Object.keys(rec).length >= 2, { message: 'Kamida 2 variant kerak' })

const QuestionUpsert = z.object({
  id: z.number().int().positive().optional(),        // yangi savol — id avto (max+1)
  subjectId: z.string().optional(),
  bankId: z.string().optional(),
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
  const bankId = resolveBankId(body.bankId || body.subjectId)

  // Ensure bank exists in DB
  await db.insert(questionBanks).values({ id: bankId, name: bankId }).onConflictDoNothing()

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
        bankId:        bankId,
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

// ── POST /api/admin/questions/bulk-import — ommaviy savollar yuklash ──
const BulkImportSchema = z.object({
  subjectId: z.string().optional(),
  bankId: z.string().optional(),
  items: z.array(z.object({
    questionUz: z.string().min(2).max(2000),
    questionRu: z.string().min(2).max(2000),
    optionsUz: OptionsSchema,
    optionsRu: OptionsSchema,
    correctAnswer: z.string().regex(/^[A-Z]\d+$/),
    image: z.string().max(500).nullable().optional(),
    topicId: z.number().int().positive().nullable().optional(),
  })).min(1).max(500),
})

router.post('/admin/questions/bulk-import', validate({ body: BulkImportSchema }), wrap(async (req, res) => {
  const { subjectId, bankId: explicitBankId, items } = req.body as z.infer<typeof BulkImportSchema>
  const bankId = resolveBankId(explicitBankId || subjectId)

  await db.insert(questionBanks).values({ id: bankId, name: bankId }).onConflictDoNothing()

  const [row] = await db.select({ maxId: sql<number>`COALESCE(MAX(${questions.id}), 0)` }).from(questions)
  let currentMaxId = row.maxId

  const recordsToInsert = items.map((it) => {
    currentMaxId += 1
    return {
      id: currentMaxId,
      bankId,
      externalId: String(currentMaxId),
      questionUz: it.questionUz,
      questionRu: it.questionRu,
      optionsUz: it.optionsUz,
      optionsRu: it.optionsRu,
      correctAnswer: it.correctAnswer,
      image: it.image ?? null,
      topicId: it.topicId ?? null,
    }
  })

  // Insert in chunks of 100 for safety
  const CHUNK_SIZE = 100
  for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE)
    await db.insert(questions).values(chunk)
  }

  questionsRepository.invalidateCache()
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))

  res.status(201).json({ success: true, count: recordsToInsert.length })
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

// ── GET /api/admin/questions — TO'LIQ qatorlar (correctAnswer bilan) fan bo'yicha ──
router.get('/admin/questions', wrap(async (req, res) => {
  const subjectParam = (req.query['subject'] || req.query['subjectId'] || req.query['bankId']) as string | undefined
  const bankId = resolveBankId(subjectParam)
  res.set('Cache-Control', 'no-store')   // javob kalitlari CDN/browser'da qolmasin

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.bankId, bankId))
    .orderBy(asc(questions.id))

  res.json(rows)
}))

// ── GET /api/admin/questions/meta — fan bo'yicha savol statistikasi ──
router.get('/admin/questions/meta', wrap(async (req, res) => {
  const subjectParam = (req.query['subject'] || req.query['subjectId'] || req.query['bankId']) as string | undefined
  const bankId = resolveBankId(subjectParam)

  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      withTopic: sql<number>`COUNT(${questions.topicId})::int`,
    })
    .from(questions)
    .where(eq(questions.bankId, bankId))

  res.json(stats ?? { total: 0, withTopic: 0 })
}))

// ── GET /api/admin/topics — fan bo'yicha mavzular ──
router.get('/admin/topics', wrap(async (req, res) => {
  const subjectParam = (req.query['subject'] || req.query['subjectId'] || req.query['bankId']) as string | undefined
  const bankId = resolveBankId(subjectParam)

  const topicRows = await db
    .select()
    .from(topics)
    .where(eq(topics.bankId, bankId))
    .orderBy(asc(topics.id))

  res.json(topicRows)
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
    SELECT COALESCE(SUM(total_answered), 0)::int AS "totalAnswered" FROM progress
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
        COALESCE(p.total_answered, 0)::int AS answered,
        COALESCE(p.total_correct, 0)::int AS correct,
        COALESCE(p.league, 'bronze') AS league
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      WHERE
        u.id ILIKE ${'%' + q + '%'} OR
        COALESCE(u.first_name, '') ILIKE ${'%' + q + '%'} OR
        COALESCE(u.last_name, '') ILIKE ${'%' + q + '%'} OR
        COALESCE(u.username, '') ILIKE ${'%' + q + '%'} OR
        COALESCE(u.phone, '') ILIKE ${'%' + q + '%'}
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
        COALESCE(p.total_answered, 0)::int AS answered,
        COALESCE(p.total_correct, 0)::int AS correct,
        COALESCE(p.league, 'bronze') AS league
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 50
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

// ── BROADCAST (OMMAVIY XABARNOMA) ENDPOINTS ──

const BroadcastSchema = z.object({
  target: z.enum(['all', 'free', 'premium', 'inactive_7d', 'active_today']),
  text: z.string().min(2).max(4000),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  imageData: z.string().max(10_000_000).nullable().optional(),
  buttonText: z.string().max(64).nullable().optional(),
  buttonUrl: z.string().max(1000).nullable().optional(),
  testTelegramId: z.union([z.string(), z.number()]).nullable().optional(),
})

const BroadcastPreviewSchema = z.object({
  target: z.enum(['all', 'free', 'premium', 'inactive_7d', 'active_today']),
})

router.post(
  '/admin/broadcast/preview-count',
  validate({ body: BroadcastPreviewSchema }),
  wrap(async (req, res) => {
    const { target } = req.body as z.infer<typeof BroadcastPreviewSchema>
    const { getTargetTelegramIds } = await import('./broadcast.service')
    const targets = await getTargetTelegramIds(target)
    res.json({ target, count: targets.length })
  }),
)

router.post(
  '/admin/broadcast',
  validate({ body: BroadcastSchema }),
  wrap(async (req, res) => {
    const body = req.body as z.infer<typeof BroadcastSchema>
    const { executeBroadcast } = await import('./broadcast.service')
    const result = await executeBroadcast(body)
    res.json({ ok: true, ...result })
  }),
)

export default router
