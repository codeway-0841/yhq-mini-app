/**
 * assertProdConfig — production boot fail-fast tekshiruvlari (audit fix).
 * Dinamik import + modul reset orqali izolyatsiya: har case'da config
 * yangi env bilan qayta parse qilinadi.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const KEYS = [
  'NODE_ENV', 'BOT_TOKEN', 'BOT_WEBHOOK_SECRET', 'CRON_SECRET', 'OTP_PEPPER',
  'CLICK_SERVICE_ID', 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY',
  'DATABASE_URL', 'ALLOWED_ORIGIN',
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

  it('production: BOT_TOKEN, CRON_SECRET, OTP_PEPPER yo\'q bo\'lsa boot qilmaydi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    delete process.env['BOT_TOKEN']
    delete process.env['CRON_SECRET']
    delete process.env['OTP_PEPPER']
    const assert = await boot()
    expect(() => assert()).toThrowError(/BOT_TOKEN/)
    expect(() => assert()).toThrowError(/CRON_SECRET/)
    expect(() => assert()).toThrowError(/OTP_PEPPER/)
  })

  it('production: barcha secret\'lar bo\'lsa o\'tadi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_TOKEN'] = 'x'
    process.env['CRON_SECRET'] = 'x'
    process.env['OTP_PEPPER'] = '0123456789abcdef'
    process.env['ALLOWED_ORIGIN'] = 'https://app.example.com'
    const assert = await boot()
    expect(() => assert()).not.toThrow()
  })

  it('production: Click sozlangan-u CLICK_SECRET_KEY yo\'q bo\'lsa boot qilmaydi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_TOKEN'] = 'x'
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

  it('production: BOT_WEBHOOK_SECRET assertProdConfig()ga TA\'SIR QILMAYDI (Render WS server uni ishlatmaydi — incident fix)', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_TOKEN'] = 'x'
    process.env['CRON_SECRET'] = 'x'
    process.env['OTP_PEPPER'] = '0123456789abcdef'
    process.env['ALLOWED_ORIGIN'] = 'https://app.example.com'
    delete process.env['BOT_WEBHOOK_SECRET']
    const assert = await boot()
    expect(() => assert()).not.toThrow()
  })

  it('production: ALLOWED_ORIGIN yo\'q bo\'lsa boot qilmaydi (audit A3 — WS origin fail-open himoyasi)', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_TOKEN'] = 'x'
    process.env['CRON_SECRET'] = 'x'
    process.env['OTP_PEPPER'] = '0123456789abcdef'
    delete process.env['ALLOWED_ORIGIN']
    const assert = await boot()
    expect(() => assert()).toThrowError(/ALLOWED_ORIGIN/)
  })
})

describe('server/config assertBotWebhookConfig (bot.ts entry — alohida)', () => {
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

  async function bootWebhook(): Promise<() => void> {
    const mod = await import('../../../server/config')
    return mod.assertBotWebhookConfig
  }

  it('production: BOT_WEBHOOK_SECRET yo\'q bo\'lsa boot qilmaydi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    delete process.env['BOT_WEBHOOK_SECRET']
    const assert = await bootWebhook()
    expect(() => assert()).toThrowError(/BOT_WEBHOOK_SECRET/)
  })

  it('production: BOT_WEBHOOK_SECRET bo\'lsa o\'tadi', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    process.env['BOT_WEBHOOK_SECRET'] = 'x'
    const assert = await bootWebhook()
    expect(() => assert()).not.toThrow()
  })

  it('non-production: yo\'q bo\'lsa ham o\'tadi', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    delete process.env['BOT_WEBHOOK_SECRET']
    const assert = await bootWebhook()
    expect(() => assert()).not.toThrow()
  })
})

describe("server/config ALLOWED_ORIGIN ro'yxati (domen ko'chirish)", () => {
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

  async function bootConfig() {
    process.env['DATABASE_URL'] = 'postgresql://u:p@h/db'
    const mod = await import('../../../server/config')
    return mod.config
  }

  it("vergulli ro'yxat: har ikkala domen ham ruxsat etiladi", async () => {
    process.env['ALLOWED_ORIGIN'] = 'https://kivvi.uz,https://yhq-mini-app.vercel.app'
    const config = await bootConfig()
    expect(config.server.allowedOrigins).toContain('https://kivvi.uz')
    expect(config.server.allowedOrigins).toContain('https://yhq-mini-app.vercel.app')
    // Capacitor origin'lari saqlanadi
    expect(config.server.allowedOrigins).toContain('capacitor://localhost')
  })

  it("birlamchi origin = ro'yxatdagi birinchisi", async () => {
    process.env['ALLOWED_ORIGIN'] = 'https://kivvi.uz,https://yhq-mini-app.vercel.app'
    const config = await bootConfig()
    expect(config.server.allowedOrigin).toBe('https://kivvi.uz')
  })

  it("bo'sh joy va oxirgi slash tozalanadi", async () => {
    process.env['ALLOWED_ORIGIN'] = ' https://kivvi.uz/ , https://www.kivvi.uz// '
    const config = await bootConfig()
    expect(config.server.allowedOrigins).toContain('https://kivvi.uz')
    expect(config.server.allowedOrigins).toContain('https://www.kivvi.uz')
  })

  it('bitta origin (eski format) ishlashda davom etadi', async () => {
    process.env['ALLOWED_ORIGIN'] = 'https://kivvi.uz'
    const config = await bootConfig()
    expect(config.server.allowedOrigin).toBe('https://kivvi.uz')
    expect(config.server.allowedOriginExplicit).toBe(true)
  })

  it("faqat vergul/bo'sh joy = berilmagan deb hisoblanadi (WS fail-open emas)", async () => {
    process.env['ALLOWED_ORIGIN'] = ' , , '
    const config = await bootConfig()
    expect(config.server.allowedOriginExplicit).toBe(false)
    expect(config.server.allowedOrigin).toBe('http://localhost:5173')
  })

  it("bo'sh TEST_DATABASE_URL yoki OTP_PEPPER config parsing'ni sindirmaydi (ID 18)", async () => {
    process.env['TEST_DATABASE_URL'] = ''
    process.env['OTP_PEPPER'] = ''
    const config = await bootConfig()
    expect(config.auth.otpPepper).toBeUndefined()
  })
})

// config moduli env snapshot'ini import paytida oladi — reset shart (yuqorida chaqiriladi).
