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
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /** Server */
  PORT:           z.string().regex(/^\d+$/).optional(),
  ALLOWED_ORIGIN: z.string().optional(),

  /** Telegram Bot — production'da MAJBURIY (pastda assertProdConfig).
   *  Module-level require qilsak migrate/seed scriptlar ham qotardi,
   *  shuning uchun shu yerda optional. */
  BOT_TOKEN:           z.string().optional(),
  BOT_WEBHOOK_SECRET:  z.string().optional(),

  /** Deploy */
  APP_URL:                z.string().url().optional(),
  VERCEL_GIT_COMMIT_SHA:  z.string().optional(),

  /** Integratsiyalar (optional — yo'q bo'lsa feature o'chiq) */
  GEMINI_API_KEY: z.string().optional(),
  CRON_SECRET:    z.string().optional(),
  SENTRY_DSN:     z.string().optional(),
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
  get env(): string { return process.env['NODE_ENV'] ?? 'development' },
  get isProd(): boolean { return process.env['NODE_ENV'] === 'production' },

  db: {
    url: env.DATABASE_URL,
  },

  server: {
    port:           Number(env.PORT ?? '3001'),
    allowedOrigin:  env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
  },

  // Used to verify Telegram initData (HMAC-SHA256 with bot token).
  telegram: {
    botToken:       env.BOT_TOKEN,
    webhookSecret:  env.BOT_WEBHOOK_SECRET,
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

  sentry: {
    dsn: env.SENTRY_DSN,
  },
} as const

export type Config = typeof config
