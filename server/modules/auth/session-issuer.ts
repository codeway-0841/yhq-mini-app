/**
 * Sessiya chiqarish (issue) — UMUMIY qatlam (auth.service ↔ users.service
 * import cycle'siz, otp.ts pattern'iga o'xshash).
 *
 * initData→Bearer exchange (v2): Telegram initData FAQAT bootstrap credential
 * (har launch'da fresh) — davomiy so'rovlar shu opaque token bilan yuradi
 * (`sessions` jadvali, 30 kun TTL, DB'da sha256). Xom token FAQAT client'ga
 * qaytariladi; DB'ga hash repository qatlamida yoziladi (M10 invariant).
 */
import { randomBytes } from 'crypto'
import { config } from '../../config'
import { authRepository, type AuthProvider } from './auth.repository'

export function newSessionToken(): string {
  return randomBytes(32).toString('hex')   // 64-hex opaque
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + config.auth.sessionTtlDays * 86_400_000)
}

/** Yangi sessiya yaratib XOM tokenni qaytaradi (client localStorage'da saqlaydi). */
export async function issueSession(userId: string, provider: AuthProvider): Promise<string> {
  const token = newSessionToken()
  await authRepository.createSession({ token, userId, provider, expiresAt: sessionExpiry() })
  return token
}
