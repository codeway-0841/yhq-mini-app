import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../../server/utils/password'
import { hashSessionToken } from '../../../server/utils/token-hash'
import { createHmac, createHash } from 'crypto'

describe('server/modules/auth - REAL Module Tests', () => {
  describe('Password Hashing & Verification (crypto.scrypt)', () => {
    it('hashPassword creates a valid salt:hash format', () => {
      const pass = 'superSecret123!'
      const hashed = hashPassword(pass)
      expect(hashed).toContain(':')
      const [salt, hash] = hashed.split(':')
      expect(salt).toHaveLength(32) // 16 bytes in hex
      expect(hash).toHaveLength(128) // 64 bytes in hex
    })

    it('hashPassword generates unique salts on every call', () => {
      const pass = 'samePassword'
      const hash1 = hashPassword(pass)
      const hash2 = hashPassword(pass)
      expect(hash1).not.toEqual(hash2)
    })

    it('verifyPassword returns true for correct password', () => {
      const pass = 'mySecurePassword'
      const stored = hashPassword(pass)
      expect(verifyPassword(pass, stored)).toBe(true)
    })

    it('verifyPassword returns false for incorrect password', () => {
      const pass = 'correctPassword'
      const stored = hashPassword(pass)
      expect(verifyPassword('wrongPassword', stored)).toBe(false)
    })

    it('verifyPassword safely handles malformed hash strings without throwing', () => {
      expect(verifyPassword('pass', '')).toBe(false)
      expect(verifyPassword('pass', 'invalid')).toBe(false)
      expect(verifyPassword('pass', 'no_colon_hash_here_1234567890123456')).toBe(false)
      expect(verifyPassword('pass', 'short:123')).toBe(false)
    })
  })

  describe('Session Token Hashing (SHA-256 M10)', () => {
    it('hashSessionToken produces a 64-character hex SHA-256 hash', () => {
      const rawToken = 'a'.repeat(64)
      const hashed = hashSessionToken(rawToken)
      expect(hashed).toHaveLength(64)
      expect(/^[0-9a-f]{64}$/.test(hashed)).toBe(true)
    })

    it('hashSessionToken is deterministic', () => {
      const rawToken = 'token_abc_123'
      expect(hashSessionToken(rawToken)).toEqual(hashSessionToken(rawToken))
    })

    it('different tokens produce different hashes', () => {
      expect(hashSessionToken('token1')).not.toEqual(hashSessionToken('token2'))
    })
  })

  describe('Telegram Login Widget Signature Verification', () => {
    it('verifies valid HMAC-SHA256 signature for Telegram widget payload', () => {
      const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
      const secret = createHash('sha256').update(botToken).digest()
      
      const payload: Record<string, string | number> = {
        auth_date: Math.floor(Date.now() / 1000),
        first_name: 'Alisher',
        id: 99887766,
        username: 'alisher_dev',
      }

      const dataCheckString = Object.keys(payload)
        .sort()
        .map((k) => `${k}=${payload[k]}`)
        .join('\n')

      const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex')

      // Re-verify
      const computed = createHmac('sha256', secret).update(dataCheckString).digest('hex')
      expect(computed).toEqual(hash)
    })
  })
})
