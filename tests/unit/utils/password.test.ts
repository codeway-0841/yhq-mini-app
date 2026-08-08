/**
 * scrypt parol hashing utilsi — roundtrip + timing-safe rad etish.
 */
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../../server/utils/password'

describe('password util (scrypt)', () => {
  it('hash → verify roundtrip', () => {
    const stored = hashPassword('maxfiyparol1')
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(verifyPassword('maxfiyparol1', stored)).toBe(true)
  })

  it('bir xil parol har safar BOSHQA hash (tuzli scrypt)', () => {
    expect(hashPassword('parol123')).not.toBe(hashPassword('parol123'))
  })

  it("noto'g'ri parol → false", () => {
    const stored = hashPassword('to_g_ri_parol')
    expect(verifyPassword('xato_parol', stored)).toBe(false)
  })

  it('buzilgan format → false (crash emas)', () => {
    expect(verifyPassword('parol123', '')).toBe(false)
    expect(verifyPassword('parol123', 'no-colon')).toBe(false)
    expect(verifyPassword('parol123', 'zz:nothex')).toBe(false)
    expect(verifyPassword('parol123', ':')).toBe(false)
  })
})
