/**
 * Duel / xona kodi validatsiyasi — SERVERDAGI haqiqiy regex ustidan.
 * (Kod bilan juftlash oqimining o'zi tests/integration/ws/octagon-social.test.ts'da.)
 */
import { describe, it, expect } from 'vitest'
import { DUEL_CODE_RE } from '../../../server/octagon'

describe('DUEL_CODE_RE', () => {
  it('6-8 xonali raqamli PIN kodlarni qabul qiladi', () => {
    expect(DUEL_CODE_RE.test('749210')).toBe(true)
    expect(DUEL_CODE_RE.test('12345678')).toBe(true)
  })

  it('4 xonali PIN qabul qilinmaydi (M-9: brute-force oldini olish)', () => {
    expect(DUEL_CODE_RE.test('1234')).toBe(false)
    expect(DUEL_CODE_RE.test('12')).toBe(false)
  })

  it('duel- va room- prefiksli kodlarni qabul qiladi (registrdan qat\'i nazar)', () => {
    expect(DUEL_CODE_RE.test('duel-749210')).toBe(true)
    expect(DUEL_CODE_RE.test('duel-x9y8z7w6')).toBe(true)
    expect(DUEL_CODE_RE.test('room-battle1')).toBe(true)
    expect(DUEL_CODE_RE.test('ROOM-BATTLE1')).toBe(true)
  })

  it('prefiksiz harf-raqam kod 6-12 belgigacha ruxsat etiladi', () => {
    expect(DUEL_CODE_RE.test('abc12')).toBe(false)           // 5 belgi — qisqa
    expect(DUEL_CODE_RE.test('abc123')).toBe(true)
    expect(DUEL_CODE_RE.test('abcdefghijkl')).toBe(true)
    expect(DUEL_CODE_RE.test('abcdefghijklm')).toBe(false)   // 13 belgi
  })

  it('prefiksli kod tanasi 6-16 belgi bilan cheklangan', () => {
    expect(DUEL_CODE_RE.test('duel-abc12')).toBe(false)                 // tana 5 belgi
    expect(DUEL_CODE_RE.test('duel-abcdefghijklmnop')).toBe(true)       // tana 16 belgi
    expect(DUEL_CODE_RE.test('duel-abcdefghijklmnopq')).toBe(false)     // tana 17 belgi
  })

  it('xavfli yoki noto\'g\'ri formatdagi kodlarni rad etadi', () => {
    expect(DUEL_CODE_RE.test('duel-<script>')).toBe(false)
    expect(DUEL_CODE_RE.test('room 1234')).toBe(false)
    expect(DUEL_CODE_RE.test('@@##$$')).toBe(false)
    expect(DUEL_CODE_RE.test('pin_1234567890123456789')).toBe(false)
    expect(DUEL_CODE_RE.test('')).toBe(false)
  })

  it('global/sticky flag yo\'q — takroriy test() natijasi o\'zgarmaydi', () => {
    // /g bo'lganda lastIndex saqlanib qolib ikkinchi test() false qaytarardi
    expect(DUEL_CODE_RE.test('duel-749210')).toBe(true)
    expect(DUEL_CODE_RE.test('duel-749210')).toBe(true)
  })
})
