import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Xavfsiz launch token (search / Top-10 → `single` sessiya).
 *
 * Delivery proof'dan farqi: bu yerda server questionId'ni OLDINDAN bilmaydi —
 * token uni O'ZI tashiydi, shuning uchun HMAC emas AES-256-GCM ishlatiladi:
 *  - questionId client uchun o'qib bo'lmaydigan (shifrlangan) ko'rinishda;
 *  - GCM auth tag butunlikni ta'minlaydi (qo'shimcha MAC kerak emas);
 *  - AAD = userId|subjectId — token faqat o'sha user va o'sha fan uchun
 *    yaroqli (boshqa user/subject bilan decrypt AUTH_FAIL);
 *  - expiry token ichida ochiq (epoch sekund) — server bazaga so'ramasdan
 *    muddatni tekshiradi.
 *
 * Format: `lt1.<expiresEpochSec>.<b64url iv>.<b64url ciphertext+tag>`
 */

const VERSION = 'lt1'

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`${secret}\nlaunch-token-key`).digest()
}

export interface LaunchTokenClaims {
  userId: string
  subjectId: string
  questionId: number
  /** Unix epoch SEKUND (token ichida shu format saqlanadi). */
  expiresAt: number
}

export function createLaunchToken(secret: string, claims: LaunchTokenClaims): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  cipher.setAAD(Buffer.from(`${claims.userId}\n${claims.subjectId}`))
  const ciphertext = Buffer.concat([
    cipher.update(String(claims.questionId), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [VERSION, String(claims.expiresAt), iv.toString('base64url'), Buffer.concat([ciphertext, tag]).toString('base64url')].join('.')
}

export interface VerifiedLaunchToken {
  questionId: number
  expiresAt: number
}

/** Standart issuance: 15 daqiqalik TTL + ISO expiresAt (API javobi uchun). */
export const LAUNCH_TOKEN_TTL_SECONDS = 15 * 60

export function issueLaunchToken(
  secret: string,
  claims: { userId: string; subjectId: string; questionId: number },
  ttlSeconds: number = LAUNCH_TOKEN_TTL_SECONDS,
): { launchToken: string; expiresAt: string } {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
  return {
    launchToken: createLaunchToken(secret, { ...claims, expiresAt }),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
}

/** Muddati o'tgan, buzilgan yoki begona user/subject tokeni → null (403). */
export function verifyLaunchToken(
  secret: string,
  scope: { userId: string; subjectId: string },
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifiedLaunchToken | null {
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  const expiresAt = Number(parts[1])
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds) return null
  try {
    const iv = Buffer.from(parts[2]!, 'base64url')
    const payload = Buffer.from(parts[3]!, 'base64url')
    if (iv.length !== 12 || payload.length <= 16) return null
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv)
    decipher.setAAD(Buffer.from(`${scope.userId}\n${scope.subjectId}`))
    decipher.setAuthTag(payload.subarray(payload.length - 16))
    const plaintext = Buffer.concat([
      decipher.update(payload.subarray(0, payload.length - 16)),
      decipher.final(),
    ]).toString('utf8')
    const questionId = Number(plaintext)
    if (!Number.isInteger(questionId) || questionId <= 0) return null
    return { questionId, expiresAt }
  } catch {
    return null
  }
}
