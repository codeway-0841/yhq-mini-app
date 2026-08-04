/**
 * Centralized config — all env vars read and validated here.
 * Any missing required var throws at startup, not at first use.
 *
 * Usage:  import { config } from '../config'
 */

function require_env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function optional_env(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

/** Production app boot xavfsizligi: BOT_TOKEN'siz server ishga tushMASLIGI kerak
 *  (aks holda BUTUN API + WS authsiz qoladi — fail-open xavfi). */
export function assertProdConfig(): void {
  if (process.env['NODE_ENV'] === 'production' && !config.telegram.botToken) {
    throw new Error('FATAL: BOT_TOKEN environment variable is required in production')
  }
}

export const config = {
  db: {
    url: require_env('DATABASE_URL'),
  },

  server: {
    port:           Number(optional_env('PORT', '3001')),
    allowedOrigin:  optional_env('ALLOWED_ORIGIN', 'http://localhost:5173'),
  },

  // Used to verify Telegram initData (HMAC-SHA256 with bot token).
  // Production'da MAJBURIY — faqat SERVER/GIQLASH entry-pointlari boot'da assert qiladi
  // (server/index.ts, standalone.ts, api-entry/*). Module-level require qilsak
  // migrate/seed kabi scriptlar ham qotardi, shuning uchun bu yerda optional.
  telegram: {
    botToken: process.env['BOT_TOKEN'],
  },
} as const

export type Config = typeof config
