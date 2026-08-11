/**
 * normalizePhone — C3 regression himoyasi.
 *
 * Bot contact login oqimi telefonni `+` SIZ yuborardi va digits-only
 * identity yaratardi; qolgan oqimlar E.164 (`+998...`) saqlaydi.
 * Bitta raqamdan ikki akkaunt hosil bo'lmasligi uchun canonical format
 * FAQAT shu utils orqali hosil bo'ladi.
 */
import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../../../server/utils/phone'

describe('normalizePhone', () => {
  it("Telegram contact formatini ('998901234567') E.164 ga keltiradi", () => {
    expect(normalizePhone('998901234567')).toBe('+998901234567')
  })

  it("allaqachon E.164 bo'lgan raqam o'zgarmaydi", () => {
    expect(normalizePhone('+998901234567')).toBe('+998901234567')
  })

  it('bo\'shliq/tire/qavslarni tozalaydi', () => {
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567')
  })

  it('idempotent — ikki marta qo\'llash natijani o\'zgartirmaydi', () => {
    const once = normalizePhone('998901234567')
    expect(normalizePhone(once)).toBe(once)
  })

  it('ikki turli kirish bir xil canonical natija beradi (merge himoyasi)', () => {
    expect(normalizePhone('998901234567')).toBe(normalizePhone('+998901234567'))
  })
})
