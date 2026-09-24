/**
 * POST /api/content/token — R2/Worker kontent tokeni (QBANK_SUBJECTS'dagi fanlar).
 *
 * Oqim:
 *   client (login) → POST /api/content/token {subjectId:'fizika'}
 *     → backend sessiyani tekshiradi (telegramAuth middleware — endpoint
 *       HECH QANDAY PUBLIC ro'yxatda YO'Q, ya'ni auth MAJBURIY)
 *     → 5/min + kunlik kvota (Neon counter, multi-instance)
 *     → joriy PUBLISHED versiya (R2 marker) bilan 10 daqiqalik HMAC token
 *   client → Worker'ga token bilan boradi (Neon chunk so'rovlarida ISHLATILMAYDI).
 * Javobdagi `segment` — R2 path segmenti (client URL qurish uchun).
 *
 * Fail-closed: QBANK_R2_ENABLED=false → 404; secret yo'q → 503;
 * publish bo'lmagan → 503 (client legacy /api/questions fallback'ga tushadi).
 *
 * Xom token HECH QAYERGA log'lanmaydi — abuse audit'da faqat userId/ip.
 */
import { Router } from 'express'
import { z } from 'zod'
import { AppError, wrap } from '../../middleware/error-handler'
import { config } from '../../config'
import { dbRateLimit, dbRateConsumeWindow } from '../../middleware/db-rate-limiter'
import { validate } from '../../middleware/validate'
import { authRepository } from '../auth/auth.repository'
import { Sentry } from '../../utils/sentry'
import { issueContentToken } from './content-token'
import { QBANK_SUBJECTS, getPublishedVersion, isQbankSubject } from './qbank-publish'

const router = Router()

const TokenBody = z.object({
  subjectId: z.string().min(1).max(32),
})

/** Token issuance — 5/min/user (bank yuklashda 1-2 token yetadi). */
const tokenLimit = dbRateLimit({
  maxPerMinute: 5,
  bucket: 'content-token',
})

router.post('/content/token', tokenLimit, validate({ body: TokenBody }), wrap(async (req, res) => {
  // Feature flag — o'chiq bo'lsa endpoint mavjud emasdek (client legacy yo'lda)
  if (!config.qbank.enabled) throw new AppError(404, 'content_delivery_unavailable')

  // Auth MAJBURIY (promo-style ichki guard) — anonim token YO'Q:
  // Worker'ga kirish huquqi faqat haqiqiy sessiyaga bog'lanadi
  // (massa-yig'ishda userId kvotasi + audit izi qoladi).
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') throw new AppError(401, 'AUTH_REQUIRED')

  const { subjectId } = req.body as z.infer<typeof TokenBody>
  // QBANK_SUBJECTS'dagi fanlar (11 fan) — qolganlari 403
  if (!isQbankSubject(subjectId)) throw new AppError(403, 'subject_not_supported')

  // Kunlik kvota — anti-scrape cap (token 10 daqiqa yashaydi; 60/kun =
  // 10 soatlik uzluksiz sessiyani qoplaydi, skript esa devor uradi).
  // Limiter xatosi fail-OPEN emas: bu endpoint xavfsizlik chegarasi —
  // DB uzilganda 503 (client legacy fallback'ga tushadi, kontent yo'qolmaydi).
  const day = await dbRateConsumeWindow(`content-token:day:${userId}`, config.qbank.tokenDailyCap, 24 * 3600)
  if (!day.allowed) {
    void authRepository.createAuditLog({
      userId,
      action: 'content_token_abuse',
      resourceType: 'question_bank',
      changes: { subjectId, count: day.count, cap: config.qbank.tokenDailyCap },
      ipAddress: req.ip ?? 'unknown',
    }).catch(() => {})
    Sentry.captureMessage('content token daily cap exceeded', {
      level: 'warning',
      tags: { userId, subjectId, count: day.count },
    })
    throw new AppError(429, 'content_token_daily_cap')
  }

  const secret = config.qbank.tokenSecret
  if (!secret) throw new AppError(503, 'content_delivery_unavailable')

  // Joriy PUBLISHED versiya — marker o'qib bo'lmasa R2 yo'li tayyor emas
  const published = await getPublishedVersion(subjectId)
  if (published === null) throw new AppError(503, 'content_not_published')

  const ttl = config.qbank.tokenTtlSeconds
  const exp = Math.floor(Date.now() / 1000) + ttl
  const token = issueContentToken(secret, {
    sub: userId,
    sid: QBANK_SUBJECTS[subjectId].pathSegment,
    v: published,
    exp,
  })

  res.set('Cache-Control', 'private, no-store')
  res.json({
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    version: `cv${published}`,
    // R2 path segmenti — client manifest/chunk/image URL'larini shu bilan
    // quradi (client'da DUPLICATE mapping YO'Q — SSOT shu yerda).
    segment: QBANK_SUBJECTS[subjectId].pathSegment,
  })
}))

export default router
