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
  const salt = sep > 0 ? stored.slice(0, sep) : ''
  const expectedHex = sep > 0 ? stored.slice(sep + 1) : ''
  // Malformed hashes ALWAYS run scrypt to hide format validation timing.
  // Use constant dummy salt (not randomBytes) so timing is deterministic.
  const DUMMY_SALT = '0'.repeat(32)
  const saltValid = /^[0-9a-f]{32}$/.test(salt)
  const saltHex = saltValid ? salt : DUMMY_SALT
  // Hash must be exactly 128 hex chars (64 bytes from scrypt KEYLEN)
  const expectedValid = /^[0-9a-f]{128}$/.test(expectedHex)
  const expected = expectedValid ? Buffer.from(expectedHex, 'hex') : Buffer.alloc(KEYLEN)

  const computed = scryptSync(password, saltHex, KEYLEN)

  // Only compare after scrypt completes, so timing reveals nothing about format
  if (sep <= 0 || !saltValid || !expectedValid || computed.length !== expected.length) return false
  return timingSafeEqual(computed, expected)
}
