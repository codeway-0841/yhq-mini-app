/**
 * Centralized config — barcha env var'lar FAQAT shu yerda o'qiladi va
 * zod bilan VALIDATSIYA qilinadi (startup fail-fast, runtime'da emas).
 *
 * Usage:  import { config } from '../config'
 * Qoidasi: boshqa joyda `process.env` O'QIMANG — shu yerga qo'shing.
 */
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),

  /** Neon PostgreSQL — majburiy */
  DATABASE_URL:      z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional().transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),

  /** Server */
  PORT:           z.string().regex(/^\d+$/).optional(),
  /** CORS/WS origin allowlist — bitta origin yoki vergul bilan ajratilgan
   *  ro'yxat (domen ko'chirish davrida eski+yangi ikkalasi ham kerak). */
  ALLOWED_ORIGIN: z.string().optional(),

  /** Telegram Bot — production'da MAJBURIY (pastda assertProdConfig).
   *  Module-level require qilsak migrate/seed scriptlar ham qotardi,
   *  shuning uchun shu yerda optional. */
  BOT_TOKEN:           z.string().optional(),
  BOT_WEBHOOK_SECRET:  z.string().optional(),
  /** Bot username (@ belgisisiz) — Telegram ulash deep-link `t.me/<bot>?start=link_<code>` uchun */
  BOT_USERNAME:        z.string().regex(/^[A-Za-z0-9_]{3,32}$/).optional(),

  /** Deploy */
  APP_URL:                z.string().url().optional(),
  VERCEL_GIT_COMMIT_SHA:  z.string().optional(),

  /** Integratsiyalar (optional — yo'q bo'lsa feature o'chiq) */
  GEMINI_API_KEY: z.string().optional(),
  /** Math Board kvota o'chirgichi — TEST uchun 'true' (hammaga bepul).
   *  Production default: kvota YOQILGAN. Prod'da 'true' bo'lsa boot FATAL. */
  MATH_BOARD_QUOTA_DISABLED: z.enum(['true', 'false']).optional().default('false'),
  /** Meta Model API (AI Kurslar real generatsiyasi) — yo'q bo'lsa mock fallback */
  META_API_KEY:  z.string().optional(),
  CRON_SECRET:    z.string().optional(),
  SENTRY_DSN:     z.string().optional(),

  /** SMS OTP — Eskiz.uz (O'zbekiston SMS gateway) */
  ESKIZ_EMAIL:    z.string().email().optional(),
  ESKIZ_PASSWORD: z.string().optional(),
  SMS_ENABLED:    z.enum(['true', 'false']).optional().default('false'),
  SMS_CALLBACK_URL: z.string().url().optional(),

  /** Email — Resend API for transactional emails */
  RESEND_API_KEY:  z.string().optional(),
  EMAIL_FROM:      z.string().email().optional(),
  APP_DOMAIN:      z.string().optional(),

  /** Auth sessiyalari — telefon+parol / TG Login Widget login'da yaratiladigan
   *  opaque token TTL (kun). Default 30. */
  SESSION_TTL_DAYS: z.string().regex(/^\d+$/).optional(),

  /** initData auth_date MAKSIMAL yoshi (sekund) — replay oynasi.
   *  Default 1 soat (avval 24 soat edi — audit P1-4). Klient 401'da Mini App'ni
   *  bir marta qayta yuklab yangi initData oladi (loop guard'li). */
  INITDATA_MAX_AGE_SECONDS: z.string().regex(/^\d+$/).optional(),

  /** OTP hash server pepper — HMAC-SHA256 kalit (DB dump'da OTP brute-force
   *  himoyasi). Yo'q bo'lsa plain sha256 fallback (dev uchun; prod'da o'rnating). */
  OTP_PEPPER: z.string().optional().transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)).pipe(z.string().min(16).optional()),

  /** Test-session v2 delivery proof HMAC kaliti. Yangi API bu kalitsiz
   *  production'da fail-closed (503); eski API migratsiya davrida ishlaydi. */
  TEST_SESSION_PROOF_SECRET: z.string().optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))
    .pipe(z.string().min(32).optional()),

  /** Legacy contraction flags (question-bank-protection v2, Phase 4).
   *  Default ON — prod o'zgarishsiz; migratsiya tugagach cohort/subject
   *  bo'yicha 'false' qilinadi. Rollback = env o'chirish (default true).
   *  - LEGACY_QUESTION_BANK_ENABLED=false → GET /api/questions 410
   *  - LEGACY_RESULT_ENABLED=false → POST /progress/:userId/result 410 */
  LEGACY_QUESTION_BANK_ENABLED: z.enum(['true', 'false']).optional().default('true'),
  LEGACY_RESULT_ENABLED: z.enum(['true', 'false']).optional().default('true'),

  /** Click Payment Gateway */
  CLICK_SERVICE_ID:       z.string().optional(),
  CLICK_MERCHANT_ID:      z.string().optional(),
  CLICK_SECRET_KEY:       z.string().optional(),
  CLICK_MERCHANT_USER_ID: z.string().optional(),

  /** Payme (Paycom) Payment Gateway — merchant kabiynet credential'lari.
   *  Secret'siz webhook FAIL-CLOSED (Click bilan bir xil himoya modeli). */
  PAYME_MERCHANT_ID:      z.string().optional(),
  PAYME_SECRET_KEY:       z.string().optional(),

  /** Telegram VIP Group Chat IDs (bot auto-invite link creation) */
  TG_GROUP_RUSTILI:       z.string().optional(),
  TG_GROUP_YHQ:           z.string().optional(),

  /** Cloudflare R2 Storage (Image Pipeline) */
  CLOUDFLARE_ACCOUNT_ID:          z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID:     z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET:            z.string().optional(),
  CLOUDFLARE_PUBLIC_URL:           z.string().optional(),

  /** Question Bank → PRIVATE R2 + Worker delivery (AUDIT-NEON-EGRESS phase 2,
   *  fizika pilot). Alohida PRIVATE bucket (media bucket'idan FARQLI — u public).
   *  QBANK_R2_ENABLED=false → /questions/version'da r2v yo'q → client legacy
   *  yo'lda qoladi (server-side kill switch, redeploy'siz rollback).
   *  CONTENT_TOKEN_SECRET — 5-15 daqiqalik kontent tokeni HMAC kaliti;
   *  Worker shu secret bilan LOKAL tekshiradi (Neon chaqirilmaydi). */
  QBANK_R2_ENABLED:            z.enum(['true', 'false']).optional().default('false'),
  CLOUDFLARE_R2_QBANK_BUCKET:  z.string().optional(),
  CONTENT_TOKEN_SECRET:        z.string().optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))
    .pipe(z.string().min(32).optional()),
  /** Kontent token TTL (sekund) — default 600 (10 daqiq) */
  CONTENT_TOKEN_TTL_SECONDS:   z.string().regex(/^\d+$/).optional(),
  /** Bitta user uchun token issuance kunlik kvota — anti-scrape cap */
  CONTENT_TOKEN_DAILY_CAP:     z.string().regex(/^\d+$/).optional(),
}).refine((data) => {
  // SMS enabled bo'lsa credentials MAJBURIY — fail-fast startup validation
  if (data.SMS_ENABLED === 'true') {
    return Boolean(data.ESKIZ_EMAIL && data.ESKIZ_PASSWORD)
  }
  return true
}, {
  message: 'ESKIZ_EMAIL and ESKIZ_PASSWORD are required when SMS_ENABLED=true',
})

// Startup'da parse — format xatolar (masalan bo'sh DATABASE_URL) darhol ko'rinadi
const env = envSchema.parse(process.env)

/** ALLOWED_ORIGIN'ni ro'yxatga aylantiradi: vergul bilan ajratiladi, bo'sh
 *  elementlar va oxirgi `/` tashlanadi (`https://a.uz/` va `https://a.uz`
 *  CORS uchun bir xil origin — brauzer hech qachon slash bilan yubormaydi). */
function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0)
}

/** Production app boot xavfsizligi: xavfsizlikka ta'sir qiluvchi secret'lar
 *  YO'Q bo'lsa server ishga tushMASLIGI kerak (fail-open himoyasi):
 *  - BOT_TOKEN — butun API + WS authsiz qoladi;
 *  - CRON_SECRET — cron endpoint'lar himoyasiz (broadcast/cleanup'ni kimdir chaqiradi);
 *  - OTP_PEPPER — pepper'siz OTP hash DB dump'da brute-force qilinadi (1M qiymat);
 *  - CLICK_SECRET_KEY — Click webhook imzosi sozlanmasa to'lovlar fail-closed
 *    rad etiladi (xizmat ko'rmaydi), shuning uchun Click sozlangan bo'lsa majburiy.
 *  DIQQAT: BOT_WEBHOOK_SECRET bu yerga QO'SHILMAYDI — bu funksiya server/index.ts
 *  (Render standalone WS server) TOMONIDAN HAM chaqiriladi, u Telegram webhook'ni
 *  UMUMAN ishlatmaydi (faqat api/bot.ts ishlatadi) — Render'da BOT_WEBHOOK_SECRET
 *  sozlanmagani uchun bu yerga qo'shilishi butun WS serverni boot'da qulatib
 *  qo'ydi (incident). Tekshiruv assertBotWebhookConfig()'ga alohida chiqarildi —
 *  FAQAT api-entry/bot.ts chaqiradi. */
export function assertProdConfig(): void {
  if (env.NODE_ENV === 'production') {
    const missing: string[] = []
    if (!config.telegram.botToken) missing.push('BOT_TOKEN')
    if (!config.cron.secret) missing.push('CRON_SECRET')
    if (!config.auth.otpPepper) missing.push('OTP_PEPPER')
    if ((env.CLICK_SERVICE_ID || env.CLICK_MERCHANT_ID) && !env.CLICK_SECRET_KEY) missing.push('CLICK_SECRET_KEY')
    // L-4 (audit): Click yoqilgan (secret bor), lekin merchant ID'lar unutilgan —
    // checkout havolasi yaratib bo'lmaydi (buildClickPaymentUrl fail-closed).
    if (env.CLICK_SECRET_KEY && (!env.CLICK_SERVICE_ID || !env.CLICK_MERCHANT_ID)) missing.push('CLICK_SERVICE_ID/CLICK_MERCHANT_ID')
    if (env.PAYME_MERCHANT_ID && !env.PAYME_SECRET_KEY) missing.push('PAYME_SECRET_KEY')
    // WS origin allowlist + CORS prod domeni (audit A3): yo'q bo'lsa octagon
    // origin tekshiruvi FAIL-OPEN ishlaydi va CORS localhost:5173 default'ga
    // tushadi — prod'da ikkalasi ham xavfli.
    if (parseOrigins(env.ALLOWED_ORIGIN).length === 0) missing.push('ALLOWED_ORIGIN')
    // R2 question-bank delivery yoqilgan bo'lsa: token secret (Worker imzo
    // tekshiruvi) + private bucket nomi MAJBURIY — aks holda token endpoint
    // fail-open ishga tushib qolardi.
    if (env.QBANK_R2_ENABLED === 'true') {
      if (!env.CONTENT_TOKEN_SECRET) missing.push('CONTENT_TOKEN_SECRET')
      if (!env.CLOUDFLARE_R2_QBANK_BUCKET) missing.push('CLOUDFLARE_R2_QBANK_BUCKET')
    }
    if (missing.length > 0) {
      throw new Error(`FATAL: required in production but missing: ${missing.join(', ')}`)
    }
  }
}

/** FAQAT api-entry/bot.ts chaqiradi (Telegram webhook handler) — Render'dagi
 *  standalone WS server buni ISHLATMAYDI, shuning uchun assertProdConfig()'ga
 *  qo'shilmaydi (yuqoridagi izohga qarang). */
export function assertBotWebhookConfig(): void {
  if (env.NODE_ENV === 'production' && !config.telegram.webhookSecret) {
    throw new Error('FATAL: required in production but missing: BOT_WEBHOOK_SECRET')
  }
}

export const config = {
  // NODE_ENV dinamik getter — testlar runtime'da o'zgartirishi mumkin
  // (boshqa barcha maydonlar startup snapshot'idir).
  // Noma'lum muhit xavfsizlik nuqtai nazaridan production hisoblanadi.
  // Bu hosted platformada NODE_ENV tasodifan yo'qolsa auth fail-open bo'lishini to'xtatadi.
  get env(): string { return process.env['NODE_ENV'] ?? 'production' },
  get isProd(): boolean { return (process.env['NODE_ENV'] ?? 'production') === 'production' },

  db: {
    // Integration test explicit test bazani olsa o'shanga ulanadi; production URL
    // fallbacki faqat unit test importlari uchun, integration script alohida guard qiladi.
    url: env.NODE_ENV === 'test' && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
    productionUrl: env.DATABASE_URL,
    testUrl: env.TEST_DATABASE_URL,
  },

  server: {
    port:           Number(env.PORT ?? '3001'),
    /** Birlamchi (kanonik) origin — bot tugmalari/redirect uchun. Ro'yxat
     *  berilgan bo'lsa birinchisi. */
    allowedOrigin:  parseOrigins(env.ALLOWED_ORIGIN)[0] ?? 'http://localhost:5173',
    /** CORS/WS uchun ruxsat etilgan barcha origin'lar — ALLOWED_ORIGIN
     *  ro'yxati + Capacitor native WebView origin'lari (Android
     *  https://localhost yoki http://localhost, iOS capacitor://localhost).
     *  SDK konstantalari, secret emas — env'siz statik ro'yxat. */
    allowedOrigins: [
      ...(parseOrigins(env.ALLOWED_ORIGIN).length > 0
        ? parseOrigins(env.ALLOWED_ORIGIN)
        : ['http://localhost:5173']),
      'capacitor://localhost',
      'https://localhost',
      'http://localhost',
    ] as string[], // mutable — cors() `StaticOrigin` readonly array qabul qilmaydi
    /** ALLOWED_ORIGIN ANIQ berilganmi? WS origin himoyasi FAQAT shunda
     *  fail-closed — aks holda default qiymat hamma connection'ni yopardi. */
    allowedOriginExplicit: parseOrigins(env.ALLOWED_ORIGIN).length > 0,
  },

  // Used to verify Telegram initData (HMAC-SHA256 with bot token).
  telegram: {
    botToken:       env.BOT_TOKEN,
    webhookSecret:  env.BOT_WEBHOOK_SECRET,
    botUsername:    env.BOT_USERNAME,
  },

  /** Deploy URL + har deployda o'zgaradigan cache-bust build id (?v=<sha>) */
  deploy: {
    appUrl:  env.APP_URL ?? 'https://app.kivvi.uz',
    buildId: (env.VERCEL_GIT_COMMIT_SHA ?? 'v1').slice(0, 8),
  },

  /** AI Tutor (Gemini) — yo'q bo'lsa endpoint 503 qaytaradi */
  ai: {
    geminiApiKey: env.GEMINI_API_KEY,
    /** Math Board kvota — prod default ON; 'true' faqat test/dev uchun */
    mathBoardQuotaDisabled: env.MATH_BOARD_QUOTA_DISABLED === 'true',
    /** Meta Model API (AI Kurslar) — yo'q bo'lsa deterministik mock outline */
    metaApiKey: env.META_API_KEY,
  },

  /** Vercel Cron himoyasi — yo'q bo'lsa cron endpoint himoyasiz (faqat dev'da OK) */
  cron: {
    secret: env.CRON_SECRET,
  },

  /** Multi-provider auth — session sozlamalari */
  auth: {
    sessionTtlDays: Math.max(1, Number(env.SESSION_TTL_DAYS ?? '30')),
    otpPepper: env.OTP_PEPPER,
    /** initData auth_date replay oynasi (sekund) — default 1 soat */
    initDataMaxAgeSeconds: Math.max(60, Number(env.INITDATA_MAX_AGE_SECONDS ?? '3600')),
  },

  /** Server-authoritative test sessionlari. Production secret rollout
   *  tugamaguncha route mavjud, lekin session yaratmaydi (fail-closed). */
  testSessions: {
    // Lokal/testda deterministik dev kalit endpoint va integration testlarni
    // ishlatadi. Productionda fallback YO'Q — secret bo'lmasa service 503.
    proofSecret: env.TEST_SESSION_PROOF_SECRET
      ?? (env.NODE_ENV === 'production' ? undefined : 'kivvi-test-session-dev-only-secret'),
    bufferSize: 6,
    ttlMinutes: 180,
    marathonTtlMinutes: 300,
  },

  /** Legacy contraction (v2 Phase 4) — default ON, faqat explicit 'false' yopadi. */
  legacy: {
    questionBankEnabled: env.LEGACY_QUESTION_BANK_ENABLED !== 'false',
    resultEnabled: env.LEGACY_RESULT_ENABLED !== 'false',
  },

  /** SMS OTP — disabled bo'lsa kod console'ga chiqadi (dev) */
  sms: {
    enabled:        env.SMS_ENABLED === 'true',
    eskizEmail:     env.ESKIZ_EMAIL,
    eskizPassword:  env.ESKIZ_PASSWORD,
    callbackUrl:    env.SMS_CALLBACK_URL,
  },

  /** Email — Resend for verification/password reset */
  email: {
    resendApiKey: env.RESEND_API_KEY,
    fromAddress:  env.EMAIL_FROM ?? 'noreply@kiwi.uz',
  },

  /** App domain for email link validation */
  appDomain: env.APP_DOMAIN ?? 'kiwi.uz',

  /** Click Payment Gateway */
  click: {
    serviceId:      env.CLICK_SERVICE_ID ?? '',
    merchantId:     env.CLICK_MERCHANT_ID ?? '',
    secretKey:      env.CLICK_SECRET_KEY ?? '',
    merchantUserId: env.CLICK_MERCHANT_USER_ID ?? '',
  },

  /** Payme (Paycom) Payment Gateway */
  payme: {
    merchantId: env.PAYME_MERCHANT_ID ?? '',
    secretKey:  env.PAYME_SECRET_KEY ?? '',
  },

  /** VIP Telegram Group Chat IDs */
  groups: {
    rustili: env.TG_GROUP_RUSTILI,
    yhq:     env.TG_GROUP_YHQ,
  },

  sentry: {
    dsn: env.SENTRY_DSN,
  },

  /** Cloudflare R2 Storage (Image Pipeline) */
  r2: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: env.CLOUDFLARE_R2_BUCKET,
    publicUrl: env.CLOUDFLARE_PUBLIC_URL,
    isConfigured: Boolean(
      env.CLOUDFLARE_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      env.CLOUDFLARE_R2_BUCKET
    ),
  },

  /** Question Bank → PRIVATE R2 + Worker (phase 2 egress, fizika pilot).
   *  Account/credential'lar umumiy (config.r2), bucket ALOHIDA va PRIVATE. */
  qbank: {
    enabled: env.QBANK_R2_ENABLED === 'true',
    bucket: env.CLOUDFLARE_R2_QBANK_BUCKET,
    tokenSecret: env.CONTENT_TOKEN_SECRET,
    tokenTtlSeconds: Math.min(3600, Math.max(300, Number(env.CONTENT_TOKEN_TTL_SECONDS ?? '600'))),
    tokenDailyCap: Math.max(10, Number(env.CONTENT_TOKEN_DAILY_CAP ?? '60')),
    /** Credential'lar + bucket to'liqmi (token endpoint/bank publish uchun) */
    isConfigured: Boolean(
      env.CLOUDFLARE_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      env.CLOUDFLARE_R2_QBANK_BUCKET
    ),
  },
} as const

export type Config = typeof config
