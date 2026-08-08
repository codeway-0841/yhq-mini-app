/**
 * Parol hashing — Node built-in `crypto.scrypt` (tashqi dependency YO'Q).
 *
 * Format: "<salt_hex>:<hash_hex>" — bitta string'da saqlanadi (auth_identities.password_hash).
 * Taqqos `timingSafeEqual` — side-channel (timing) hujumlarga himoya.
 * scryptSync N=16384 (~10-20ms/hash) — register/login uchun yetarli, brute-force uchun qimmat.
 */

import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

const KEYLEN = 64

/** Parolni hash'laydi — "salt:hash" (hex) ko'rinishida qaytaradi. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

/** Parol saqlangan hash'ga mos keladimi (timing-safe). Format buzilgan bo'lsa false. */
export function verifyPassword(password: string, stored: string): boolean {
  const sep = stored.indexOf(':')
  if (sep <= 0) return false
  const salt = stored.slice(0, sep)
  const expectedHex = stored.slice(sep + 1)
  if (!/^[0-9a-f]+$/.test(salt) || !/^[0-9a-f]+$/.test(expectedHex)) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const computed = scryptSync(password, salt, KEYLEN)
  if (computed.length !== expected.length) return false
  return timingSafeEqual(computed, expected)
}
