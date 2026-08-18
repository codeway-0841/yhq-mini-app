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
import { adminRepository } from './admin.repository'
import { reloadOctagonPools } from '../../octagon'
import { SUBJECT_REGISTRY } from '../../config/subjects'

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
  // Relative path (images/q071.jpg), to'liq URL yoki base64 data URL
  image: z.string().max(10_000_000).nullable().optional(),
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
  await adminRepository.ensureBank(bankId)

  // id yo'q bo'lsa — max(id)+1 (seed bilan bir xil strategiya). Parallel admin
  // so'rovlar bir xil max+1 hisoblab 23505 (PK/uq conflict) olishi mumkin —
  // shunda id QAYTA hisoblanib qayta uriniladi (INSERT...RETURNING).
  let newId: number | undefined = body.id
  let insertedId: number | null = null
  for (let attempt = 0; attempt < 3 && insertedId == null; attempt++) {
    if (newId == null) {
      newId = await adminRepository.nextQuestionId()
    }
    insertedId = await adminRepository.insertQuestion({
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
    })
    if (insertedId == null) {
      // 23505 unique_violation — faqat avto-id oqimida qayta hisoblanadi
      if (body.id != null) throw new AppError(409, 'Bu id bilan savol allaqachon mavjud')
      if (attempt === 2) throw new AppError(500, 'Savol id ajratib bo\'lmadi (concurrency)')
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
    image: z.string().max(10_000_000).nullable().optional(),
    topicId: z.number().int().positive().nullable().optional(),
  })).min(1).max(500),
})

router.post('/admin/questions/bulk-import', validate({ body: BulkImportSchema }), wrap(async (req, res) => {
  const { subjectId, bankId: explicitBankId, items } = req.body as z.infer<typeof BulkImportSchema>
  const bankId = resolveBankId(explicitBankId || subjectId)

  await adminRepository.ensureBank(bankId)

  let currentMaxId = await adminRepository.nextQuestionId() - 1

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

  await adminRepository.bulkInsertQuestions(recordsToInsert)

  questionsRepository.invalidateCache()
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))

  res.status(201).json({ success: true, count: recordsToInsert.length })
}))

// ── PUT / PATCH /api/admin/questions/:id — tahrirlash ──
const handleQuestionUpdate = wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Noto'g'ri id")
  const body = req.body as UpsertBody

  const updated = await adminRepository.updateQuestion(id, {
    questionUz:    body.questionUz,
    questionRu:    body.questionRu,
    optionsUz:     body.optionsUz,
    optionsRu:     body.optionsRu,
    correctAnswer: body.correctAnswer,
    image:         body.image ?? null,
    topicId:       body.topicId ?? null,
  })

  if (!updated) throw new AppError(404, 'Savol topilmadi')
  questionsRepository.invalidateCache()
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))
  res.json({ id, updated: true })
})

router.put('/admin/questions/:id', validate({ body: QuestionUpsert }), handleQuestionUpdate)
router.patch('/admin/questions/:id', validate({ body: QuestionUpsert }), handleQuestionUpdate)

// ── DELETE /api/admin/questions/:id ──
router.delete('/admin/questions/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Noto'g'ri id")

  // Bog'liq yozuvlar BITTA CTE'da (audit: 3 alohida DELETE crash'da yarim holat qoldirardi)
  const deleted = await adminRepository.deleteQuestionCascade(id)

  if (!deleted) throw new AppError(404, 'Savol topilmadi')
  questionsRepository.invalidateCache()
  await reloadOctagonPools().catch((err) => console.error('[admin] octagon pool reload xatosi:', err))
  res.status(204).send()
}))

// ── GET /api/admin/questions — TO'LIQ qatorlar (correctAnswer bilan) fan bo'yicha ──
router.get('/admin/questions', wrap(async (req, res) => {
  const subjectParam = (req.query['subject'] || req.query['subjectId'] || req.query['bankId']) as string | undefined
  const bankId = resolveBankId(subjectParam)
  res.set('Cache-Control', 'no-store')   // javob kalitlari CDN/browser'da qolmasin

  const rows = await adminRepository.listQuestionsByBank(bankId)

  res.json(rows)
}))

// ── GET /api/admin/questions/meta — fan bo'yicha savol statistikasi ──
router.get('/admin/questions/meta', wrap(async (req, res) => {
  const subjectParam = (req.query['subject'] || req.query['subjectId'] || req.query['bankId']) as string | undefined
  const bankId = resolveBankId(subjectParam)

  const stats = await adminRepository.questionBankMeta(bankId)

  res.json(stats)
}))

// ── GET /api/admin/topics — fan bo'yicha mavzular ──
router.get('/admin/topics', wrap(async (req, res) => {
  const subjectParam = (req.query['subject'] || req.query['subjectId'] || req.query['bankId']) as string | undefined
  const bankId = resolveBankId(subjectParam)

  const topicRows = await adminRepository.listTopicsByBank(bankId)

  res.json(topicRows)
}))

// ── GET /api/admin/stats — Jonli tizim statistikasi ──
router.get('/admin/stats', wrap(async (_req, res) => {
  res.json(await adminRepository.getStats())
}))

// ── GET /api/admin/users — Foydalanuvchilar qidiruvi ──
router.get('/admin/users', wrap(async (req, res) => {
  const q = String(req.query['query'] ?? '').trim()
  const usersList = await adminRepository.searchUsers(q)

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

    await adminRepository.grantPremium(userId, tariff, days ?? null)
    const updated = await adminRepository.getUserForGrant(userId)
    res.json({ ok: true, user: updated })
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

// ── TG BROADCAST kampaniyalari (M-5: chunked, resumable) ──

const TgBroadcastCreateSchema = z.object({
  segment: z.enum(['all', 'free', 'premium', 'inactive_7d', 'active_today']),
  message: z.string().min(3).max(4096),
  imageUrl: z.string().url().nullable().optional(),
  buttonText: z.string().max(40).nullable().optional(),
  buttonUrl: z.string().max(300).nullable().optional(),
})

router.post(
  '/admin/tg-broadcasts',
  validate({ body: TgBroadcastCreateSchema }),
  wrap(async (req, res) => {
    const body = req.body as z.infer<typeof TgBroadcastCreateSchema>
    const { tgBroadcastService } = await import('./tg-broadcast.service')
    const broadcast = await tgBroadcastService.create(body)
    res.json({ ok: true, broadcast })
  }),
)

router.get(
  '/admin/tg-broadcasts',
  wrap(async (_req, res) => {
    const { tgBroadcastService } = await import('./tg-broadcast.service')
    res.json({ broadcasts: await tgBroadcastService.list() })
  }),
)

router.post(
  '/admin/tg-broadcasts/:id/dispatch',
  wrap(async (req, res) => {
    const { tgBroadcastService } = await import('./tg-broadcast.service')
    const result = await tgBroadcastService.dispatchChunk(Number(req.params['id']))
    res.json({ ok: true, ...result })
  }),
)

// ── AI QUESTION STUDIO & TEXT GENERATOR ──

router.post(
  '/admin/ai/generate-questions',
  wrap(async (req, res) => {
    const { GenerateQuestionsInputSchema, generateAiQuestions } = await import('./ai-question-generator.service')
    const parsed = GenerateQuestionsInputSchema.parse(req.body)
    const questions = await generateAiQuestions(parsed)
    res.json({ ok: true, count: questions.length, questions })
  }),
)

// ── SMS MARKETING (FAQAT sms_opt_in userlar) ──

const SmsCampaignSchema = z.object({
  title:   z.string().min(3).max(80),
  message: z.string().min(10).max(300),
})

// Auditoriya soni (compose preview)
router.get('/admin/sms/audience', wrap(async (_req, res) => {
  const { smsCampaignService } = await import('./sms-campaign.service')
  res.json({ optedIn: await smsCampaignService.audienceCount() })
}))

// Yangi draft kampaniya
router.post('/admin/sms/campaigns', validate({ body: SmsCampaignSchema }), wrap(async (req, res) => {
  const { smsCampaignService } = await import('./sms-campaign.service')
  const { title, message } = req.body as z.infer<typeof SmsCampaignSchema>
  try {
    const campaign = await smsCampaignService.create(title, message)
    res.status(201).json({ ok: true, campaign })
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    if (msg === 'message_too_short' || msg === 'message_too_long') {
      throw new AppError(400, msg)
    }
    throw err
  }
}))

// Kampaniyalar ro'yxati (+ statistika)
router.get('/admin/sms/campaigns', wrap(async (_req, res) => {
  const { smsCampaignService } = await import('./sms-campaign.service')
  res.json({ campaigns: await smsCampaignService.list() })
}))

// Bitta chunk yuborish — admin UI remaining=0 bo'lguncha takrorlaydi
router.post('/admin/sms/campaigns/:id/send', rateLimit({ maxPerMinute: 12 }), wrap(async (req, res) => {
  const { smsCampaignService } = await import('./sms-campaign.service')
  const id = Number(req.params['id'])
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Invalid campaign id')
  try {
    res.json({ ok: true, ...(await smsCampaignService.dispatchChunk(id)) })
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    if (msg === 'not_found') throw new AppError(404, 'Campaign not found')
    if (msg === 'already_sent') throw new AppError(409, 'Campaign already fully sent')
    throw err
  }
}))

export default router
