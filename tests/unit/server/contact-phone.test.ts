/**
 * extractOwnContactPhone — Mini App requestContact fast-path'ining
 * xavfsizlik chegarasi: FAQAT o'z kontakti (user_id === from.id) qabul
 * qilinadi, format E.164'ga normalize qilinadi.
 */
import { describe, it, expect } from 'vitest'
import { extractOwnContactPhone } from '../../../server/modules/users/contact-phone'

describe('extractOwnContactPhone', () => {
  it("o'z kontakti (user_id === fromId) → E.164 '+' bilan", () => {
    // Telegram odatda '+'siz yuboradi
    expect(extractOwnContactPhone({ user_id: 123, phone_number: '998901234567' }, 123))
      .toBe('+998901234567')
  })

  it("'+' va bo'shliqlar/vergullar bo'lsa ham normalize qiladi", () => {
    expect(extractOwnContactPhone({ user_id: 7, phone_number: '+998 90 123 45 67' }, 7))
      .toBe('+998901234567')
  })

  it('begona kontakt forward qilinsa (user_id !== fromId) → null', () => {
    expect(extractOwnContactPhone({ user_id: 999, phone_number: '998901234567' }, 123))
      .toBeNull()
  })

  it("user_id yo'q (Telegram'siz telefon-kontakt) → null", () => {
    expect(extractOwnContactPhone({ phone_number: '998901234567' }, 123)).toBeNull()
  })

  it('contact yoki fromId undefined → null', () => {
    expect(extractOwnContactPhone(undefined, 123)).toBeNull()
    expect(extractOwnContactPhone({ user_id: 123, phone_number: '998901234567' }, undefined))
      .toBeNull()
  })

  it("juda qisqa/nolar bilan boshlanuvchi raqam → null (E.164 emas)", () => {
    expect(extractOwnContactPhone({ user_id: 1, phone_number: '12345' }, 1)).toBeNull()
    expect(extractOwnContactPhone({ user_id: 1, phone_number: '0123456789' }, 1)).toBeNull()
    expect(extractOwnContactPhone({ user_id: 1, phone_number: '' }, 1)).toBeNull()
  })
})
