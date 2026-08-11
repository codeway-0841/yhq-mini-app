/**
 * Sessiya token hashing — M10.
 * `sessions.token` DB'da XOM ko'rinishda SAQLANMAYDI (DB dump = login o'g'irligi).
 * Faqat sha256 hash saqlanadi; client xom (opaque, 64-hex) token'ni Bearer'da yuboradi.
 * Token yuqori entropiyali (32 bayt CSPRNG) bo'lgani uchun sha256 yetarli —
 * scrypt/bcrypt kerak emas (parol emas, bashorat qilib bo'lmaydigan tasodif).
 */

import { createHash } from 'crypto'

/** Xom sessiya token'ning DB'dagi ko'rinishi (sha256 hex). */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
