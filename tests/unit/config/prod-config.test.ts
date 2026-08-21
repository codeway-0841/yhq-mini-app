/**
 * assertProdConfig — production boot fail-fast tekshiruvlari (audit fix).
 * Dinamik import + modul reset orqali izolyatsiya: har case'da config
 * yangi env bilan qayta parse qilinadi.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const KEYS = [
  'NODE_ENV', 'BOT_TOKEN', 'BOT_WEBHOOK_SECRET', 'CRON_SECRET', 'OTP_PEPPER',
  'CLICK_SERVICE_ID', 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY',
  'DATABASE_URL',
] as const

const saved = new Map<string, string | undefined>()

describe('server/config assertProdConfig (audit fix)', () => {
  beforeEach(() => {
    for (const k of KEYS) saved.set(k, process.env[k])
    vi.resetModules()
  })
  afterEach(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    vi.resetModules()
  })

  async function boot(): Promise<() => void> {
    const mod = await import('../../../server/config')
    return mod.assertProdConfig
  }

  it('production: BOT_TOKEN, BOT_WEBHOOK_SECRET, CRON_SECRET, OTP_PEPPER yo\'q bo\'lsa boot qilmaydi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    delete process.env['BOT_TOKEN']
    delete process.env['BOT_WEBHOOK_SECRET']
    delete process.env['CRON_SECRET']
    delete process.env['OTP_PEPPER']
    const assert = await boot()
    expect(() => assert()).toThrowError(/BOT_TOKEN/)
    expect(() => assert()).toThrowError(/BOT_WEBHOOK_SECRET/)
    expect(() => assert()).toThrowError(/CRON_SECRET/)
    expect(() => assert()).toThrowError(/OTP_PEPPER/)
  })

  it('production: barcha secret\'lar bo\'lsa o\'tadi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_TOKEN'] = 'x'
    process.env['BOT_WEBHOOK_SECRET'] = 'x'
    process.env['CRON_SECRET'] = 'x'
    process.env['OTP_PEPPER'] = '0123456789abcdef'
    const assert = await boot()
    expect(() => assert()).not.toThrow()
  })

  it('production: Click sozlangan-u CLICK_SECRET_KEY yo\'q bo\'lsa boot qilmaydi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_TOKEN'] = 'x'
    process.env['BOT_WEBHOOK_SECRET'] = 'x'
    process.env['CRON_SECRET'] = 'x'
    process.env['OTP_PEPPER'] = '0123456789abcdef'
    process.env['CLICK_SERVICE_ID'] = '32876'
    delete process.env['CLICK_SECRET_KEY']
    const assert = await boot()
    expect(() => assert()).toThrowError(/CLICK_SECRET_KEY/)
  })

  it('non-production: secret\'lar yo\'q bo\'lsa ham o\'tadi (dev fail-fast yo\'q)', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    delete process.env['BOT_TOKEN']
    const assert = await boot()
    expect(() => assert()).not.toThrow()
  })
})

// config moduli env snapshot'ini import paytida oladi — reset shart (yuqorida chaqiriladi).
