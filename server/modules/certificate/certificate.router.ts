/**
 * Certificate router — Telegram bot orqali sertifikat jo'natish.
 *
 * POST /api/certificate/send — Telegram WebApp'da to'g'ridan-to'g'ri foydalanuvchining
 * Telegram chatiga sertifikat rasmini yuqori sifatli fayl/rasm sifatida jo'natadi.
 */

import { Router } from 'express'
import { z } from 'zod'
import { Bot, InputFile } from 'grammy'
import { requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { wrap, AppError } from '../../middleware/error-handler'
import { config } from '../../config'
import { executeRows } from '../../db/connection'
import { sql } from 'drizzle-orm'

const router = Router()

const SendCertificateSchema = z.object({
  // ~3.7MB rasmgacha (base64 ≈ 4/3) — route-level body limit 5mb bilan mos (audit H-9).
  imageBase64: z.string().min(50).max(5_000_000),
  certId:      z.string().min(3).max(64),
  subjectName: z.string().min(1).max(128),
  score:       z.number().optional(),
  total:       z.number().optional(),
  percent:     z.number().optional(),
})

router.post(
  '/certificate/send',
  requireAuth,
  rateLimit({ maxPerMinute: 6, bucket: 'certificate' }),
  validate({ body: SendCertificateSchema }),
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId
    if (!userId || userId === '0') {
      throw new AppError(401, 'Avval tizimga kiring', 'AUTH_REQUIRED')
    }

    const { imageBase64, certId, subjectName, score, total, percent } = req.body as z.infer<typeof SendCertificateSchema>

    const token = config.telegram.botToken
    if (!token) {
      console.warn('[Certificate] Telegram botToken is not configured in config.telegram')
      res.json({ success: true, sentToTelegram: false, message: 'bot_not_configured' })
      return
    }

    // 1. Foydalanuvchining Telegram ID sini aniqlaymiz
    let tgId: number | null = null
    if (/^\d{5,12}$/.test(userId)) {
      tgId = Number(userId)
    } else {
      // Identity'dan qidiramiz
      const rows = await executeRows<{ provider_uid: string }>(sql`
        SELECT provider_uid FROM auth_identities
        WHERE user_id = ${userId} AND provider = 'telegram'
        LIMIT 1
      `)
      if (rows[0] && /^\d+$/.test(rows[0].provider_uid)) {
        tgId = Number(rows[0].provider_uid)
      }
    }

    if (!tgId) {
      res.json({ success: true, sentToTelegram: false, message: 'no_telegram_linked' })
      return
    }

    // 2. Base64 to Buffer
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(cleanBase64, 'base64')
    const fileName = `kivvi-certificate-${certId}.png`

    // 3. Telegram Bot orqali to'g'ridan-to'g'ri yuborish
    try {
      const bot = new Bot(token)
      const caption = [
        `🏆 *TABRIKLAYMIZ! RASMIY SERTIFIKAT TAYYOR!*`,
        ``,
        `📚 Fan: *${subjectName}*`,
        score != null && total != null ? `🎯 Natija: *${score}/${total} (${percent}%)*` : `🎯 Natija: *${percent}%*`,
        `🆔 Sertifikat ID: \`${certId}\``,
        ``,
        `_Ushbu rasmni galereyangizga saqlab oling yoki do'stlaringiz bilan ulashing!_ 🚗`,
      ].join('\n')

      await bot.api.sendPhoto(tgId, new InputFile(buffer, fileName), {
        caption,
        parse_mode: 'Markdown',
      })

      res.json({ success: true, sentToTelegram: true })
    } catch (err: unknown) {
      console.error('[Certificate bot send error]', err)
      throw new AppError(500, 'certificate_delivery_failed')
    }
  }),
)

export default router
