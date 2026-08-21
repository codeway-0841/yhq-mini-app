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
// Multi-instance umumiy limiter (prod'da Neon DB counter, test/dev'da in-memory)
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { parseUserId }      from '../../utils/parse'
import { db }   from '../../db/connection'
import { questions, users } from '../../schema'
import { config } from '../../config'
import { tashkentDate } from '../../utils/date'
import {
  tutorUsageRepository, TUTOR_DAILY_USER_LIMIT, TUTOR_DAILY_GLOBAL_LIMIT, TUTOR_GLOBAL_USER_ID,
} from './tutor.repository'

const router = Router()

const BodySchema = z.object({
  questionId:     z.number().int().min(1),
  lang:           z.enum(['uz', 'ru']).default('uz'),
  /** To'g'ri javob berilganmi — prompt o'shanga qarab tanlanadi */
  answeredCorrect: z.boolean().default(false),
})

/** Effective premium (lifetime tariff YOKI referal muddati tugamagan) */
async function isPremium(uid: string): Promise<boolean> {
  const [row] = await db.select({ tariff: users.tariff, premiumUntil: users.premiumUntil })
    .from(users).where(eq(users.id, uid))
  return !!row && (row.tariff === 'premium' || (row.premiumUntil != null && row.premiumUntil > new Date()))
}

function buildPrompt(q: typeof questions.$inferSelect, lang: 'uz' | 'ru', answeredCorrect: boolean): string {
  const opts    = lang === 'ru' ? q.optionsRu : q.optionsUz
  const qText   = lang === 'ru' ? q.questionRu : q.questionUz
  const correct = q.correctAnswer
  const options = Object.entries(opts).map(([k, v]) => `${k}) ${v}`).join('\n')
  const ctx     = `Вопрос/Savol: ${qText}\n\nВарианты:\n${options}\n\nTo'g'ri javob: ${correct}`

  if (lang === 'ru') {
    if (!answeredCorrect) {
      return `Ты — терпеливый и дружелюбный преподаватель ПДД (пдд Узбекистана). Ученик ответил неправильно и не понял ПОЧЕМУ.\n\n${ctx}\n\nОбъясни ученику тщательно, простым языком, как будто сидишь с ним рядом:\n1. Что требует правило (цитируй суть ПДД).\n2. Почему именно "${correct}" — правильный ответ.\n3. Кратко по каждому НЕПРАВИЛЬНОМУ варианту — что в нём ловушка.\n4. Один совет, как это запомнить на будущее.\n\nОбычный живой разговорный тон, 200–300 слов. Без заголовков и маркеров — обычный текст с абзацами.`
    }
    return `Ты — дружелюбный преподаватель ПДД. Ученик ответил ПРАВИЛЬНО — коротко похвали и закрепи правило.\n\n${ctx}\n\n1. Кратко похвали (1 предложение).\n2. Объясни суть правила подробно (что требует ПДД, почему "${correct}" верен).\n3. Кратко по другим вариантам — почему они неверны.\n4. Совет, как запомнить.\n\nЖивой разговорный тон, 200–300 слов. Обычные абзацы без маркеров.`
  }
  if (!answeredCorrect) {
    return `Siz — sabrli va do'stona O'zbekiston YHQ ustozi. O'quvchi noto'g'ri javob berdi va NEGA xatoni tushunmadi.\n\n${ctx}\n\nO'quvchiga yonida o'tirib qo'yıb tushuntirganday batafsil, sodda tilda tushuntiring:\n1. Qoida nimani talab qiladi (YHQ mohiyatini aytib bering).\n2. Nega aynen "${correct}" javobi to'g'ri.\n3. Har bir NOTO'G'RI variant haqida qisqacha — undagi tuzo-qur trap qanday.\n4. Keyingi safar eslab qolish uchun 1 ta maslahat.\n\nOdatiy jonli suhbatdosh ohangi, 200–300 so'z. Sarlavhasiz, markirovkasiz — oddiy paragraflar.`
  }
  return `Siz — do'stona O'zbekiston YHQ ustozi. O'quvchi javobni TO'G'RI berdi — qisqacha tabriklang va qoidani mustahkam lab qo'ying.\n\n${ctx}\n\n1. Qisqacha tabrik (1 jum).\n2. Qoidani batafsil tushuntiring (nima talab qiladi, nega "${correct}" to'g'ri).\n3. Boshqa variantlar nega noto'g'ri — qisqacha.\n4. Eslab qolish uchun maslahat.\n\nJonli suhbatdosh ohangi, 200–300 so'z. Sarlavha va markirovkasiz oddiy paragraflar.`
}

// POST /api/tutor/explain
router.post(
  '/tutor/explain',
  rateLimit({
    maxPerMinute: 10,
    bucket: 'tutor',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ body: BodySchema }),
  wrap(async (req, res) => {
    const key = config.ai.geminiApiKey
    if (!key) throw new AppError(503, 'AI Tutor vaqtincha o\'chiq (GEMINI_API_KEY yo\'q)')

    const { questionId, lang, answeredCorrect } = req.body as z.infer<typeof BodySchema>
    const verifiedId = (req as { userId?: string }).userId
    const uid = verifiedId ? parseUserId(verifiedId) : null
    if (!uid) throw new AppError(401, 'user_not_identified')

    if (!(await isPremium(uid))) throw new AppError(403, 'premium_required')

    // COST CONTROL: Gemini har chaqiruvda pul — premium bo'lsa ham kunlik
    // user limiti va global byudjet shifti tekshiriladi (atomik upsert).
    // TARTIB MUHIM (audit #10): USER limiti AVVAL tekshiriladi — o'z limitidan
    // oshgan user'ning so'rovi baribir 429 bo'ladi, shuning uchun GLOBAL
    // byudjetdan bekorga slot yemasligi kerak (avval global birinchi bo'lsa,
    // || short-circuit tufayli global slot sarflanib bo'lgach user limiti
    // ushlab qolardi — behuda sarflangan global kvota).
    const date = tashkentDate()
    if (!(await tutorUsageRepository.tryConsume(uid, date, TUTOR_DAILY_USER_LIMIT))
      || !(await tutorUsageRepository.tryConsume(TUTOR_GLOBAL_USER_ID, date, TUTOR_DAILY_GLOBAL_LIMIT))) {
      throw new AppError(429, 'daily_limit')
    }

    const [q] = await db.select().from(questions).where(eq(questions.id, questionId))
    if (!q) throw new AppError(404, 'Question not found')

    // Upstream Gemini request: 45s timeout + client uzilganda abort.
    // Aks holda ochiq qolgan stream server resurslarini cheksiz egallaydi
    // va AI kvotasi bekor requestlarga sarflanadi.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000)
    res.on('close', () => controller.abort())

    let apiRes: Response
    try {
      apiRes = await fetch(
        // Model alias: `gemini-2.0-flash` kunlik kvotasi tugab qolishi mumkin —
        // `flash-latest` har doim oxirgi flash modelga ishora qiladi
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildPrompt(q, lang, answeredCorrect) }] }],
            // flash-latest reasoning-model — fikrlash ham token yeydi; 3000 yetarli
            generationConfig: { maxOutputTokens: 3000, temperature: 0.6 },
          }),
        },
      )
    } catch (err) {
      clearTimeout(timeout)
      if (controller.signal.aborted) {
        if (res.destroyed) return // client o'zi uzilgan — javob kerak emas
        throw new AppError(504, 'ai_timeout')
      }
      throw err
    }
    if (!apiRes.ok || !apiRes.body) {
      clearTimeout(timeout)
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
        if (done || controller.signal.aborted) break
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
    } catch (err) {
      // 45s timeout yoki client uzilishi abort qilganda reader.read()
      // AbortError tashlaydi — bu kutilgan holat, stream'ni toza yopamiz.
      if (!controller.signal.aborted) throw err
    } finally {
      clearTimeout(timeout)
      // Client uzilgan bo'lsa (socket destroyed) yozishga urunmaymiz;
      // timeout holatida esa ochiq stream'ni toza yopamiz.
      if (!res.writableEnded && !res.destroyed) {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }
  }),
)

export default router
