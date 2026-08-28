/**
 * Telegram contact xabaridan VERIFIED telefon ajratish (Mini App requestContact
 * fast-path — SMS'siz telefon ulash, 2026-08-28).
 *
 * Nega bu ishonchli: Mini App `requestContact()`da user rozi bo'lgach, Telegram
 * O'ZI bot chat'iga `contact` xabarini yuboradi ("the bot will receive the
 * phone details" — rasmiy docs) va `contact.user_id === message.from.id`
 * bo'lishi Telegram tomonidan kafolatlanadi (o'z raqami). Bu client-side
 * `responseUnsafe`dan FARQ QILADI — u imzosiz va soxtalashtirilishi mumkin
 * (shuning uchun client'dan kelgan raqamga SMS OTP talab qilinadi — H-2).
 *
 * Sof funksiya — DB'siz, unit-test qilinadi.
 */

/** Bot API Contact obyektining bizga kerakli qismi. */
export interface TgContactLike {
  user_id?:      number
  phone_number?: string
}

/**
 * O'Z kontakti bo'lsa — E.164 normalize qilingan raqam, aks holda null.
 * - user_id !== fromId → forward qilingan begona kontakt (ishonchsiz) → null
 * - user_id yo'q (Telegram'siz kontakt) → null
 * - Format: faqat raqamlar + leading '+' (PhoneSchema regex'i bilan bir xil)
 */
export function extractOwnContactPhone(
  contact: TgContactLike | undefined,
  fromId: number | undefined,
): string | null {
  if (!contact || fromId === undefined) return null
  if (contact.user_id === undefined || contact.user_id !== fromId) return null
  const digits = (contact.phone_number ?? '').replace(/[^\d]/g, '')
  const e164 = `+${digits}`
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null
}
