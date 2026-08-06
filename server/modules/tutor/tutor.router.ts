/**
 * AI Tutor — xato yechilgan savolni Google Gemini (flash-2.0) tushuntiradi.
 *
 * POST /api/tutor/explain {questionId, lang} → text/event-stream (SSE passthrough)
 *
 *  - FAQAT premium foydalanuvchilar uchun (AI API pullik — cop foydalanish cheklovi).
 *  - Streaming: Gemini `streamGenerateContent` (alt=sse) matn qismlari real vaqtda
 *    uzatiladi — client'da "yozib borayotgan" effekt hosil qiladi.
 *  - Env: GEMINI_API_KEY (Vercel env'ga qo'yiladi).
 */

import { Router } from 'express'
import { z }  from 'zod'
import { eq } from 'drizzle-orm'
import { wrap, AppError }   from '../../middleware/error-handler'
import { validate }         from '../../middleware/validate'
import { rateLimit }        from '../../middleware/rate-limiter'
import { parseBigInt }      from '../../utils/parse'
import { db }   from '../../db/connection'
import { questions, users } from '../../schema'

const router = Router()

const BodySchema = z.object({
  questionId: z.number().int().min(1),
  lang:       z.enum(['uz', 'ru']).default('uz'),
  userId:     z.string().regex(/^\d{1,19}$/),
})

/** Effective premium (lifetime tariff YOKI referal muddati tugamagan) */
async function isPremium(uid: bigint): Promise<boolean> {
  const [row] = await db.select({ tariff: users.tariff, premiumUntil: users.premiumUntil })
    .from(users).where(eq(users.id, uid))
  return !!row && (row.tariff === 'premium' || (row.premiumUntil != null && row.premiumUntil > new Date()))
}

function buildPrompt(q: typeof questions.$inferSelect, lang: 'uz' | 'ru'): string {
  const opts    = lang === 'ru' ? q.optionsRu : q.optionsUz
  const qText   = lang === 'ru' ? q.questionRu : q.questionUz
  const correct = q.correctAnswer
  const options = Object.entries(opts).map(([k, v]) => `${k}) ${v}`).join('\n')

  return lang === 'ru'
    ? `Ты — дружелюбный преподаватель ПДД. Ученик выбрал неправильный ответ.\n\nВопрос: ${qText}\n\nВарианты:\n${options}\n\nПравильный ответ: ${correct}\n\nОбъясни ученику коротко и простыми словами (до 120 слов): почему ответ "${correct}" правильный и какая ошибка у ученика могла быть. Без воды — только суть правила.`
    : `Siz — yo'l harakati qoidalari bo'yicha do'stona ustoz. O'quvchi noto'g'ri javobni tanladi.\n\nSavol: ${qText}\n\nVariantlar:\n${options}\n\nTo'g'ri javob: ${correct}\n\nO'quvchiga qisqa va oddiy tilda (120 so'zdan kam) tushuntiring: nega "${correct}" javobi to'g'ri va o'quvchi qanday xato qihgan bo'lishi mumkin — faqat qoidaning mohiyati.`
}

// POST /api/tutor/explain
router.post(
  '/tutor/explain',
  rateLimit({ maxPerMinute: 10 }),
  validate({ body: BodySchema }),
  wrap(async (req, res) => {
    const key = process.env['GEMINI_API_KEY']
    if (!key) throw new AppError(503, 'AI Tutor vaqtincha o\'chiq (GEMINI_API_KEY yo\'q)')

    const { questionId, lang, userId } = req.body as z.infer<typeof BodySchema>
    const uid = parseBigInt(userId)
    if (!uid) throw new AppError(400, 'Invalid userId')

    if (!(await isPremium(uid))) throw new AppError(403, 'premium_required')

    const [q] = await db.select().from(questions).where(eq(questions.id, questionId))
    if (!q) throw new AppError(404, 'Question not found')

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(q, lang) }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
        }),
      },
    )
    if (!apiRes.ok || !apiRes.body) {
      const text = await apiRes.text().catch(() => '')
      console.error('[tutor] Gemini error:', apiRes.status, text.slice(0, 300))
      if (apiRes.status === 429) throw new AppError(503, 'quota')
      throw new AppError(502, 'unavailable')
    }

    // SSE passthrough — Gemini JSON chunk'laridan faqat matn qismini ajratamiz
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const reader  = apiRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''
        for (const line of parts) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const json = trimmed.slice(5).trim()
          if (!json || json === '[DONE]') continue
          try {
            const obj = JSON.parse(json) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
            const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
          } catch { /* noto'liq JSON — keyingi chunk'da to'g'rilanadi */ }
        }
      }
    } finally {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }),
)

export default router
