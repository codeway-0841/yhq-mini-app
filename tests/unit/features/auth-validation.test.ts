/**
 * Auth forma validatsiyasi (sof funksiyalar) — LoginPage / LinkAccountSection
 * UI'si ularga tayanadi; xatolik mapping'i server kodlari bilan sinxron.
 * Run with: npx vitest tests/unit/features/auth-validation.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  isValidPhone, isValidPassword, toE164, authErrorKey,
} from '../../../src/features/auth/validation'
import { ApiError } from '../../../src/shared/api'

describe('toE164 — +998 normalizatsiya', () => {
  it('raqam-only kiritma +998 prefiksi oladi', () => {
    expect(toE164('901234567')).toBe('+998901234567')
  })

  it("formatlangan kiritmadan faqat raqamlar saqlanadi", () => {
    expect(toE164('+998 (90) 123-45-67')).toBe('+998901234567')
  })

  it("998 prefiksi ikki marta yozilmaydi", () => {
    expect(toE164('998901234567')).toBe('+998901234567')
  })

  it("9 raqamdan ortig'i kesiladi (clamp)", () => {
    expect(toE164('90123456789')).toBe('+998901234567')
  })

  it("boshqa davlat kodi (998 emas) — dastlabki 9 raqam +998 ostiga o'tkaziladi", () => {
    // UI doim +998 prefiksi bilan ko'rsatadi — foydalanuvchi faqat 9 raqam kiritadi
    expect(toE164('7901234567')).toBe('+998790123456')
  })
})

describe('isValidPhone — E.164 regex', () => {
  it('to\'g\'ri format — true', () => {
    expect(isValidPhone('+998901234567')).toBe(true)
  })
  it('9 raqamdan kam — false', () => {
    expect(isValidPhone('+99890123456')).toBe(false)
  })
  it('+998 siz — false', () => {
    expect(isValidPhone('901234567')).toBe(false)
  })
})

describe('isValidPassword — server PasswordSchema bilan sinxron', () => {
  it('8 belgi — minimal OK', () => {
    expect(isValidPassword('12345678')).toBe(true)
  })
  it('7 belgi — kam', () => {
    expect(isValidPassword('1234567')).toBe(false)
  })
  it('72 dan ortiq — ruxsat yo\'q (bcrypt chegarasi)', () => {
    expect(isValidPassword('x'.repeat(73))).toBe(false)
  })
})

describe('authErrorKey — server xato kodlari mapping\'i', () => {
  it('phone_taken → authPhoneTaken', () => {
    expect(authErrorKey(new ApiError(409, 'x', 'phone_taken'))).toBe('authPhoneTaken')
  })
  it('invalid_credentials → authInvalidCreds', () => {
    expect(authErrorKey(new ApiError(401, 'x', 'invalid_credentials'))).toBe('authInvalidCreds')
  })
  it('invalid_widget_signature → authInvalidWidget', () => {
    expect(authErrorKey(new ApiError(401, 'x', 'invalid_widget_signature'))).toBe('authInvalidWidget')
  })
  it('429 rate limit → authRateLimited (kodidan qat\'i nazar)', () => {
    expect(authErrorKey(new ApiError(429, 'x', 'rate_limited'))).toBe('authRateLimited')
  })
  it("noma'lum server xatosi → authGenericError", () => {
    expect(authErrorKey(new ApiError(500, 'x', 'internal'))).toBe('authGenericError')
  })
  it('network xatosi (ApiError emas) → authGenericError', () => {
    expect(authErrorKey(new TypeError('fetch failed'))).toBe('authGenericError')
  })
})
