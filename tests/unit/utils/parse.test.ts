import { describe, it, expect } from 'vitest'
import { parseUserId, parseLimit, parseReferralParam } from '../../../server/utils/parse'

describe('parseUserId utility', () => {
  it('Telegram numeric string ID larni qabul qiladi', () => {
    expect(parseUserId('123456789')).toBe('123456789')
    expect(parseUserId('  9876543210123456789  ')).toBe('9876543210123456789')
  })

  it('Telefon akkaunt p_<digits> formatini qabul qiladi', () => {
    expect(parseUserId('p_998901234567')).toBe('p_998901234567')
    expect(parseUserId('p_123456789')).toBe('p_123456789')
  })

  it('Email akkaunt e_<32hex> formatini qabul qiladi (BUG-AUTH-01 fix)', () => {
    const emailId = 'e_' + 'a'.repeat(32)
    expect(parseUserId(emailId)).toBe(emailId)
    const mixedHex = 'e_0123456789abcdef0123456789abcdef'
    expect(parseUserId(mixedHex)).toBe(mixedHex)
  })

  it('Noto\'g\'ri yoki xavfli formatlarni rad etadi (null qaytaradi)', () => {
    expect(parseUserId('')).toBeNull()
    expect(parseUserId(null)).toBeNull()
    expect(parseUserId(undefined)).toBeNull()
    expect(parseUserId('../etc/passwd')).toBeNull()
    expect(parseUserId('user_123')).toBeNull()
    expect(parseUserId('e_short')).toBeNull()
    expect(parseUserId('p_short')).toBeNull()
    expect(parseUserId("123; DROP TABLE users;--")).toBeNull()
  })
})

describe('parseReferralParam (bot ?start=ref_<id>)', () => {
  it('TG raqam id qabul qiladi', () => {
    expect(parseReferralParam('ref_123456789')).toBe('123456789')
  })

  it('p_ (telefon) va e_ (email) referrer id QABUL QILADI (audit: eskisi tashlab yuborardi)', () => {
    expect(parseReferralParam('ref_p_998901234567')).toBe('p_998901234567')
    expect(parseReferralParam('ref_e_0123456789abcdef0123456789abcdef')).toBe('e_0123456789abcdef0123456789abcdef')
  })

  it('noto\'g\'ri ref param\'larni rad etadi', () => {
    expect(parseReferralParam('ref_user_123')).toBeNull()
    expect(parseReferralParam('ref_')).toBeNull()
    expect(parseReferralParam('duel-abc123')).toBeNull()
    expect(parseReferralParam(null)).toBeNull()
    expect(parseReferralParam(undefined)).toBeNull()
    expect(parseReferralParam('ref_p_short')).toBeNull()
  })
})

describe('parseLimit utility', () => {
  it('default va clamp limitlarni to\'g\'ri hisoblaydi', () => {
    expect(parseLimit('10', 20, 50)).toBe(10)
    expect(parseLimit(undefined, 20, 50)).toBe(20)
    expect(parseLimit('100', 20, 50)).toBe(50)
    expect(parseLimit('-5', 20, 50)).toBe(20)
    expect(parseLimit('invalid', 20, 50)).toBe(20)
  })
})
