/**
 * Unit tests for persist-level PII minimization (P1-1: account isolation).
 * Persist qilinadigan user obyektida telefon raqam bo'lmasligi shart —
 * localStorage shared qurilmada uzoq yotadi.
 * Run with: npx vitest tests/unit/store/app-store-persist.test.ts
 */

import { describe, it, expect } from 'vitest'
import { stripUserPii } from '../../../src/store/useAppStore'
import type { ApiUser } from '../../../src/lib/api'

const fullUser: ApiUser = {
  id:        '123456789',
  firstName: 'Anvar',
  lastName:  'Karimov',
  username:  'anvar_k',
  photoUrl:  'https://t.me/i/userpic/320/abc.jpg',
  phone:     '+998901234567',
  tariff:    'premium',
  isAdmin:   false,
}

describe('stripUserPii (persist PII minimizatsiyasi)', () => {
  it('null userda null qaytaradi', () => {
    expect(stripUserPii(null)).toBeNull()
  })

  it('telefon raqam persist versiyadan olib tashlanadi', () => {
    const p = stripUserPii(fullUser)
    expect(p?.phone).toBeUndefined()
  })

  it('warm-start UI uchun zarur maydonlar saqlanadi', () => {
    const p = stripUserPii(fullUser)!
    expect(p.id).toBe(fullUser.id)
    expect(p.firstName).toBe(fullUser.firstName)
    expect(p.lastName).toBe(fullUser.lastName)
    expect(p.username).toBe(fullUser.username)
    expect(p.photoUrl).toBe(fullUser.photoUrl)
    expect(p.tariff).toBe(fullUser.tariff)
  })

  it('kiruvchi obyektni o\'zgartirmaydi (immutability)', () => {
    const copy = { ...fullUser }
    stripUserPii(fullUser)
    expect(fullUser).toEqual(copy)
  })

  it('telefon allaqachon yo\'q bo\'lsa ham xavfsiz ishlaydi', () => {
    const noPhone = { ...fullUser, phone: undefined }
    const p = stripUserPii(noPhone)!
    expect(p.phone).toBeUndefined()
    expect(p.id).toBe(fullUser.id)
  })
})
