/**
 * Telefon normalizatsiya — YAGONA MANBA.
 *
 * Canonical format: E.164 (`+998XXXXXXXXX`) — auth_identities.provider_uid
 * va users.phone HAR DOIM shu formatda saqlanadi. Telegram contact API
 * raqamni `+` SIZ yuboradi (`998XXXXXXXXX`); ilova oqimlari esa `+998...`
 * yuboradi — ikkalasini bir xil ko'rinishga keltirmasdan identity lookup
 * qilsak BIR raqamdan ikki akkaunt hosil bo'ladi (audit C3).
 */

/** Istalgan kirish (`+998...`, `998...`, bo'shliq/tirelar bilan) → `+998...` */
export function normalizePhone(phone: string): string {
  return `+${phone.replace(/\D/g, '')}`
}
