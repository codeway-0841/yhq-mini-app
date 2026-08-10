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
  TEST_DATABASE_URL: z.string().min(1).optional(),

  /** Server */
  PORT:           z.string().regex(/^\d+$/).optional(),
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
  CRON_SECRET:    z.string().optional(),
  SENTRY_DSN:     z.string().optional(),

  /** SMS OTP — Eskiz.uz (O'zbekiston SMS gateway) */
  ESKIZ_EMAIL:    z.string().email().optional(),
  ESKIZ_PASSWORD: z.string().optional(),
  SMS_ENABLED:    z.enum(['true', 'false']).optional().default('false'),
  SMS_CALLBACK_URL: z.string().url().optional(),

  /** Auth sessiyalari — telefon+parol / TG Login Widget login'da yaratiladigan
   *  opaque token TTL (kun). Default 30. */
  SESSION_TTL_DAYS: z.string().regex(/^\d+$/).optional(),
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

/** Production app boot xavfsizligi: BOT_TOKEN'siz server ishga tushMASLIGI kerak
 *  (aks holda BUTUN API + WS authsiz qoladi — fail-open xavfi). */
export function assertProdConfig(): void {
  if (env.NODE_ENV === 'production' && !config.telegram.botToken) {
    throw new Error('FATAL: BOT_TOKEN environment variable is required in production')
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
    allowedOrigin:  env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    /** CORS/WS uchun ruxsat etilgan barcha origin'lar — ALLOWED_ORIGIN +
     *  Capacitor native WebView origin'lari (Android https://localhost yoki
     *  http://localhost, iOS capacitor://localhost). SDK konstantalari,
     *  secret emas — env'siz statik ro'yxat. */
    allowedOrigins: [
      env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
      'capacitor://localhost',
      'https://localhost',
      'http://localhost',
    ] as string[], // mutable — cors() `StaticOrigin` readonly array qabul qilmaydi
    /** ALLOWED_ORIGIN ANIQ berilganmi? WS origin himoyasi FAQAT shunda
     *  fail-closed — aks holda default qiymat hamma connection'ni yopardi. */
    allowedOriginExplicit: Boolean(env.ALLOWED_ORIGIN),
  },

  // Used to verify Telegram initData (HMAC-SHA256 with bot token).
  telegram: {
    botToken:       env.BOT_TOKEN,
    webhookSecret:  env.BOT_WEBHOOK_SECRET,
    botUsername:    env.BOT_USERNAME,
  },

  /** Deploy URL + har deployda o'zgaradigan cache-bust build id (?v=<sha>) */
  deploy: {
    appUrl:  env.APP_URL ?? 'https://yhq-mini-app.vercel.app',
    buildId: (env.VERCEL_GIT_COMMIT_SHA ?? 'v1').slice(0, 8),
  },

  /** AI Tutor (Gemini) — yo'q bo'lsa endpoint 503 qaytaradi */
  ai: {
    geminiApiKey: env.GEMINI_API_KEY,
  },

  /** Vercel Cron himoyasi — yo'q bo'lsa cron endpoint himoyasiz (faqat dev'da OK) */
  cron: {
    secret: env.CRON_SECRET,
  },

  /** Multi-provider auth — session sozlamalari */
  auth: {
    sessionTtlDays: Math.max(1, Number(env.SESSION_TTL_DAYS ?? '30')),
  },

  /** SMS OTP — disabled bo'lsa kod console'ga chiqadi (dev) */
  sms: {
    enabled:        env.SMS_ENABLED === 'true',
    eskizEmail:     env.ESKIZ_EMAIL,
    eskizPassword:  env.ESKIZ_PASSWORD,
    callbackUrl:    env.SMS_CALLBACK_URL,
  },

  sentry: {
    dsn: env.SENTRY_DSN,
  },
} as const

export type Config = typeof config
