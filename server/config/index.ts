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

export const config = {
  db: {
    url: require_env('DATABASE_URL'),
  },

  server: {
    port:           Number(optional_env('PORT', '3001')),
    allowedOrigin:  optional_env('ALLOWED_ORIGIN', 'http://localhost:5173'),
  },

  // Used to verify Telegram initData (HMAC-SHA256 with bot token)
  // Required in production; optional in dev (validation will be skipped when absent)
  telegram: {
    botToken: process.env['BOT_TOKEN'],
  },
} as const

export type Config = typeof config
