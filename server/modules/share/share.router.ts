/**
 * Share router — Telegram bot orqali UMUMIY rasm jo'natish (FIXPLAN #48 fix).
 *
 * Nima uchun bu kerak: Telegram WebView ichida `navigator.share` yo'q va
 * `<a download>` blob yuklab olish jimgina ishlamaydi (download manager yo'q).
 * Kafolatlangan rasm yetkazish — bot'ning user bilan shaxsiy chatiga yuborish;
 * user u yerdan forward/qayta ulashadi (certificate.router bilan bir xil pattern).
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

const ShareImageSchema = z.object({
  imageBase64: z.string().min(50).max(4_000_000), // ~3MB PNG base64
  caption:     z.string().min(1).max(1024),       // Telegram caption limiti
  fileName:    z.string().min(1).max(80).regex(/^[\w.-]+$/, 'fileName').optional(),
})

/** Canonical user id → Telegram chatId (raqam id yoki telegram identity).
 *  Regex octagon.ts WS_USER_ID_RE bilan sinxron (audit #13: eski \d{5,12}
 *  yangi/kattaroq Telegram id'lar uchun DB fallback'ga tushib qolardi —
 *  ishlaydi, lekin keraksiz sekin yo'l). */
async function resolveTgChatId(userId: string): Promise<number | null> {
  if (/^\d{1,20}$/.test(userId)) return Number(userId)
  const rows = await executeRows<{ provider_uid: string }>(sql`
    SELECT provider_uid FROM auth_identities
    WHERE user_id = ${userId} AND provider = 'telegram'
    LIMIT 1
  `)
  const uid = rows[0]?.provider_uid
  return uid && /^\d+$/.test(uid) ? Number(uid) : null
}

router.post(
  '/share/image',
  requireAuth,
  rateLimit({ maxPerMinute: 6, bucket: 'share' }),
  validate({ body: ShareImageSchema }),
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId
    if (!userId || userId === '0') {
      throw new AppError(401, 'Avval tizimga kiring', 'AUTH_REQUIRED')
    }

    const token = config.telegram.botToken
    if (!token) {
      res.json({ ok: true, sentToTelegram: false, message: 'bot_not_configured' })
      return
    }

    const tgId = await resolveTgChatId(userId)
    if (!tgId) {
      res.json({ ok: true, sentToTelegram: false, message: 'no_telegram_linked' })
      return
    }

    const { imageBase64, caption, fileName } = req.body as z.infer<typeof ShareImageSchema>
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')

    // Magic bytes tekshiruvi (audit Q3): zod faqat uzunlikni biladi — ixtiyoriy
    // bayt oqimini Telegram'ga "rasm" deb yuborish mumkin edi. FAQAT PNG/JPEG.
    const isPng = buffer.length > 8
      && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    const isJpeg = buffer.length > 3
      && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (!isPng && !isJpeg) {
      throw new AppError(400, 'unsupported_image_format')
    }

    try {
      const bot = new Bot(token)
      await bot.api.sendPhoto(tgId, new InputFile(buffer, fileName ?? 'kiwi-share.png'), { caption })
      res.json({ ok: true, sentToTelegram: true })
    } catch (err) {
      console.error('[share/image bot send error]', err)
      throw new AppError(500, 'share_delivery_failed')
    }
  }),
)

export default router
