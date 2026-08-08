/**
 * Auth forma validatsiyasi — SOF funksiyalar (UI'siz, unit test qilinadigan).
 * Server bilan sinxron: `server/modules/auth/auth.service.ts`
 * PhoneE164Schema = /^\+998\d{9}$/, PasswordSchema min 8.
 */
import { ApiError } from '../../shared/api'

/** E.164 +998 (faqat O'zbekiston raqamlari) */
export const PHONE_RE = /^\+998\d{9}$/

export const PASSWORD_MIN = 8

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value)
}

export function isValidPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN && value.length <= 72
}

/**
 * Istalgan kiritilgan matndan +998 E.164 qiymat hosil qiladi:
 * faqat raqamlar saqlanadi, "+998" prefiksi bir marta, 9 ta raqamga clamp.
 * Masalan: "+998 (90) 123-45-67" → "+998901234567"; "9012" → "+9989012".
 */
export function toE164(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('998')) digits = digits.slice(3)
  return `+998${digits.slice(0, 9)}`
}

/** UI i18n kalitlari (auth bo'limi) — LoginPage xato mapping'i */
export type AuthErrorKey =
  | 'authPhoneTaken'
  | 'authInvalidCreds'
  | 'authInvalidWidget'
  | 'authRateLimited'
  | 'authGenericError'

/** Server xato kodini Locale kalitga o'giradi (ApiError) */
export function authErrorKey(err: unknown): AuthErrorKey {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'authRateLimited'
    if (err.code === 'phone_taken') return 'authPhoneTaken'
    if (err.code === 'invalid_credentials') return 'authInvalidCreds'
    if (err.code === 'invalid_widget_signature') return 'authInvalidWidget'
  }
  return 'authGenericError'
}
