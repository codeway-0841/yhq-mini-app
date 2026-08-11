/**
 * M10 + L6 regression: sessiya token'i va OTP DB'da xom saqlanmasligi.
 *
 * hashSessionToken — deterministik sha256 (resolve'da qayta hash'lab topish uchun).
 * hashOTP — OTP_PEPPER sozlanganda HMAC-SHA256 (DB dump'da 6 xonali kodni
 * 1M urinishda brute-force qilinishini to'xtatadi); pepper'siz plain sha256
 * fallback (dev muhit).
 *
 * config startup'da env parse qiladi — har test oldidan modul grafini
 * reset qilamiz (vi.resetModules) va dinamik import bilan yangi env'da o'qiymiz.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash, createHmac } from 'crypto'

const PEPPER = 'test-pepper-key-0123456789abcdef'

beforeEach(() => {
  vi.resetModules()
  // config zod parse uchun (unit muhitda .env bo'lmasligi mumkin)
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'
  delete process.env.OTP_PEPPER
})

describe('hashSessionToken', () => {
  it('sha256 hex, deterministik, xom tokendan farqli', async () => {
    const { hashSessionToken } = await import('../../../server/utils/token-hash')
    const raw = 'a'.repeat(64)
    const hash = hashSessionToken(raw)
    expect(hash).toBe(createHash('sha256').update(raw).digest('hex'))
    expect(hash).toHaveLength(64)
    expect(hash).not.toBe(raw)
    expect(hashSessionToken(raw)).toBe(hash)   // deterministik
    expect(hashSessionToken('b'.repeat(64))).not.toBe(hash)
  })
})

describe('hashOTP', () => {
  it('OTP_PEPPER yo\'q — plain sha256 fallback (dev)', async () => {
    const { hashOTP } = await import('../../../server/utils/sms')
    expect(hashOTP('123456')).toBe(createHash('sha256').update('123456').digest('hex'))
  })

  it('OTP_PEPPER bor — HMAC-SHA256 (pepper fallback\'dan farqli)', async () => {
    process.env.OTP_PEPPER = PEPPER
    const { hashOTP } = await import('../../../server/utils/sms')
    const hash = hashOTP('123456')
    expect(hash).toBe(createHmac('sha256', PEPPER).update('123456').digest('hex'))
    expect(hash).not.toBe(createHash('sha256').update('123456').digest('hex'))
  })

  it('bir xil pepper deterministik, boshqa pepper boshqa hash', async () => {
    process.env.OTP_PEPPER = PEPPER
    const first = (await import('../../../server/utils/sms')).hashOTP('654321')
    expect(first).toBe((await import('../../../server/utils/sms')).hashOTP('654321'))

    process.env.OTP_PEPPER = PEPPER + '-v2'
    vi.resetModules()
    process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'
    const rotated = (await import('../../../server/utils/sms')).hashOTP('654321')
    expect(rotated).not.toBe(first)
  })
})
