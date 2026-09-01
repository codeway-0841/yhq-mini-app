/**
 * Express app factory.
 *
 * Separated from server/index.ts so the app can be imported in integration
 * tests without binding to a port.
 *
 * Mount order:
 *   1. Global middleware (logger, CORS, JSON body parser)
 *   2. Feature routers under /api
 *   3. Global error handler (must be last)
 */

import express          from 'express'
import cors             from 'cors'
import { sql }           from 'drizzle-orm'
import { config }        from './config'
import { requestLogger } from './middleware/request-logger'
import { errorHandler }  from './middleware/error-handler'
import { rateLimit, identityKey } from './middleware/rate-limiter'
import { telegramAuth }  from './middleware/auth'
import { createReadinessHandler } from './middleware/readiness'
import { executeRows }   from './db/connection'
import { questionsRepository } from './modules/questions/questions.repository'

import authRouter        from './modules/auth/auth.router'
import usersRouter       from './modules/users/users.router'
import progressRouter    from './modules/progress/progress.router'
import settingsRouter    from './modules/settings/settings.router'
import savedRouter       from './modules/saved/saved.router'
import leaderboardRouter from './modules/leaderboard/leaderboard.router'
import questionsRouter   from './modules/questions/questions.router'
import dashboardRouter   from './modules/dashboard/dashboard.router'
import analyticsRouter   from './modules/analytics/analytics.router'
import dailyRouter       from './modules/daily/daily.router'
import cronRouter        from './modules/cron/cron.router'
import achievementsRouter from './modules/achievements/achievements.router'
import tutorRouter        from './modules/tutor/tutor.router'
import adminRouter        from './modules/admin/admin.router'
import promoRouter        from './modules/promo/promo.router'
import coinsRouter        from './modules/coins/coins.router'
import bossRouter         from './modules/boss/boss.router'
import aiTestsRouter      from './modules/ai-tests/ai-tests.router'
import certificateRouter  from './modules/certificate/certificate.router'
import shareRouter        from './modules/share/share.router'
import { paymentRouter }  from './modules/payments/payment.router'

export function createApp() {
  const app = express()

  // ── Global middleware ────────────────────────────────────────────────────
  app.use(requestLogger)
  app.use(cors({
    origin:         config.server.allowedOrigins,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // X-Login-Code — Telegram-login polling header'i (api.checkTelegramLogin).
    // Ro'yxatda bo'lmasa preflight rad etiladi va WebView/brauzer so'rovni
    // UMUMAN yubormaydi: APK'da login spinner'i cheksiz aylanardi (2026-08-31
    // incident — bot sessiya chiqargan, lekin client buni hech qachon olmadi).
    // Desync'ni tests/unit/middleware/cors-headers.test.ts ushlaydi.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'X-Request-Id', 'X-Login-Code'],
    credentials:    true,
  }))
  // Body-parser limiti ROUTE bo'yicha (audit #11): oldin 10mb GLOBAL edi —
  // har bir endpoint (login, purchase, coins, tutor...) 120 req/min'da 10MB
  // body qabul qilardi (asossiz katta DoS sirti). Rasm/base64 qabul qiladigan
  // route'lar (admin savol rasmi, share/image) o'z alohida limitiga ega —
  // Express shu path'larga BIRINCHI mos keladigan json() parser'ni ishlatadi
  // (keyingi umumiy chaqiruv req._body allaqachon parse qilinganini ko'rib
  // o'tkazib yuboradi). Qolgan barcha route uchun kichik default.
  app.use('/api/admin/questions', express.json({ limit: '10mb' }))
  app.use('/api/share/image', express.json({ limit: '5mb' }))
  // Sertifikat PNG base64 (canvas.toDataURL) odatda 300KB'dan oshadi — umumiy
  // 300kb limit 413 qaytarardi (audit H-9). share/image bilan bir kategoriya.
  app.use('/api/certificate/send', express.json({ limit: '5mb' }))
  app.use(express.json({ limit: '300kb' }))

  // Vercel/Render load balancer ortida — req.ip X-Forwarded-For'dan o'qilsin.
  // Bo'lmasa rate limiter barcha foydalanuvchini bitta bucket'ga soladi.
  app.set('trust proxy', 1)

  // Minimal xavfsizlik header'lari (helmet kerak emas — API JSON-only)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })

  // Health check — must stay above auth/rate-limit so monitors always reach it
  // `/health` alias: Render healthCheckPath ham shu handler umumiy (bitta entry — standalone.ts birlashtirildi).
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) })
  }
  app.get('/api/health', healthHandler)
  app.get('/health', healthHandler)

  // `/` root — uptime monitor/ping servislar (Render keep-alive dah) shu yerga uradi.
  // SPA bu server'da serve QILINMAYDI (Vercel'da), shuning uchun route'siz 404 warn
  // log'larni to'ldirardi; 200 'ok' — ping'lar xotirjam, log toza.
  app.get('/', healthHandler)

  // Readiness — LIVENESS'dan farqli: DB ping + question pool loaded check.
  // Deploy/monitoring faqat ready nodeni tanlashi kerak (DB/pool yo'q bo'lsa 503).
  app.get('/api/ready', createReadinessHandler(async () => {
    await executeRows(sql`SELECT 1`)  // DB connectivity
    const poolReady = await questionsRepository.isPoolReady()
    if (!poolReady) throw new Error('Question pool not loaded')
  }))

  // ── Qatlam 1: DoS qalqoni (auth'dan OLDIN, IP bo'yicha) ──────────────────
  //
  // DIQQAT — bu limit ATAYLAB juda bo'sh. Ilgari shu joyda 120/min turardi va
  // u IP bo'yicha kalitlanardi, chunki `req.userId` telegramAuth'dan KEYIN
  // paydo bo'ladi. Lekin mobil operatorlar CGNAT ishlatadi: minglab abonent
  // bitta public IPv4 ortida. Bitta faol foydalanuvchi ~10-20 req/min qiladi,
  // ya'ni bitta operator shlyuzidagi 6-12 foydalanuvchi BUTUN API'ni
  // o'chirardi — testlarni emas, hammasini.
  //
  // Qiymat hisobi: bitta operator shlyuzida bir vaqtda 300+ faol foydalanuvchi
  // bo'lishi mumkin, har biri ~15 req/min — ya'ni 4500+/min mutlaqo normal.
  // 6000/min (100 req/s) shundan ham yuqori, lekin bitta Mini App mijozi uchun
  // aniq g'ayritabiiy. Ya'ni bu chegara faqat qo'pol flood'ni kesadi.
  //
  // Hajmli (volumetric) hujum uchun ASOSIY himoya bu yerda emas: Vercel
  // platformasi DDoS mitigatsiyasi va WAF/BotID bilan funksiya ishga
  // tushishidan OLDIN filtrlaydi. App darajasidagi IP limiti CGNAT tufayli
  // hech qachon aniq bo'la olmaydi — uni yagona devor deb hisoblamang.
  app.use('/api', rateLimit({
    maxPerMinute: 6000,
    keyFn: (req) => req.ip ?? 'unknown',
  }))

  // Vercel Cron — telegramAuth'dan OLDIN (Telegram initData yo'q); CRON_SECRET himoyali
  app.use('/api', cronRouter)

  // Telegram initData verification (enforced in production, see middleware/auth)
  app.use('/api', telegramAuth)

  // ── Qatlam 2: foydalanuvchi bo'yicha adolatli limit (auth'dan KEYIN) ─────
  //
  // Endi `req.userId` mavjud, shuning uchun chelak SHAXSGA tegishli va bitta
  // operator IP'sidagi qo'shnilar bir-birini bloklamaydi. Anonim so'rovlar
  // (login/OTP) uchun IP'ga qaytamiz — ular kamdan-kam va shu bo'sh limitga
  // bemalol sig'adi.
  app.use('/api', rateLimit({
    maxPerMinute: 120,
    keyFn: identityKey,
  }))

  // ── Feature routers ──────────────────────────────────────────────────────
  // All public API routes are prefixed with /api.
  // Each router only knows its own sub-path (e.g. /init, /profile/:id).
  app.use('/api', authRouter)
  app.use('/api', usersRouter)
  app.use('/api', progressRouter)
  app.use('/api', settingsRouter)
  app.use('/api', savedRouter)
  app.use('/api', leaderboardRouter)
  app.use('/api', questionsRouter)
  app.use('/api', dashboardRouter)
  app.use('/api', analyticsRouter)
  app.use('/api', dailyRouter)
  app.use('/api', achievementsRouter)
  app.use('/api', tutorRouter)
  app.use('/api', adminRouter)
  app.use('/api', promoRouter)
  app.use('/api', coinsRouter)
  app.use('/api', bossRouter)
  // DIQQAT: adminRouter'dan KEYIN — /api/admin/ai-tests/generate shu orqali
  // requireAdmin'dan o'tadi (router.use('/admin', requireAdmin) prefix-match).
  app.use('/api', aiTestsRouter)
  app.use('/api', certificateRouter)
  app.use('/api', shareRouter)
  app.use('/api/payments', paymentRouter)

  // 404 catch-all for unmatched /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler)

  return app
}
