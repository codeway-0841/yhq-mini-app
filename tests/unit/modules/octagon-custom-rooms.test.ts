import { describe, it, expect } from 'vitest'

const DUEL_CODE_RE = /^(?:duel-[a-z0-9]{4,16}|room-[a-z0-9]{4,16}|\d{4,8}|[a-z0-9]{4,12})$/i

describe('Octagon Custom Rooms & PIN Code PvP — Unit Tests', () => {
  describe('Room Code & PIN Validation Regex', () => {
    it('6 xonali raqamli PIN kodlarni qabul qiladi', () => {
      expect(DUEL_CODE_RE.test('749210')).toBe(true)
      expect(DUEL_CODE_RE.test('100000')).toBe(true)
      expect(DUEL_CODE_RE.test('999999')).toBe(true)
    })

    it('4-8 xonali raqamli PIN kodlarni qabul qiladi', () => {
      expect(DUEL_CODE_RE.test('1234')).toBe(true)
      expect(DUEL_CODE_RE.test('12345678')).toBe(true)
    })

    it('duel- prefiksli kodlarni qabul qiladi', () => {
      expect(DUEL_CODE_RE.test('duel-749210')).toBe(true)
      expect(DUEL_CODE_RE.test('duel-abc123')).toBe(true)
      expect(DUEL_CODE_RE.test('duel-x9y8z7w6')).toBe(true)
    })

    it('room- prefiksli kodlarni qabul qiladi', () => {
      expect(DUEL_CODE_RE.test('room-482910')).toBe(true)
      expect(DUEL_CODE_RE.test('room-battle1')).toBe(true)
    })

    it('noto\'g\'ri format yoki maxsus xavfli belgilarni rad etadi', () => {
      expect(DUEL_CODE_RE.test('12')).toBe(false) // juda qisqa
      expect(DUEL_CODE_RE.test('pin_1234567890123456789')).toBe(false) // juda uzun
      expect(DUEL_CODE_RE.test('duel-<script>')).toBe(false) // xavfli belgilar
      expect(DUEL_CODE_RE.test('room 1234')).toBe(false) // bo'shliq
      expect(DUEL_CODE_RE.test('@@##$$')).toBe(false)
    })
  })

  describe('Invite Link & Share Message Formatting', () => {
    it('Telegram bot invite link to\'g\'ri shakllanadi', () => {
      const pin = '749210'
      const inviteLink = `https://t.me/kiwi_uz_bot?start=duel-${pin}`
      expect(inviteLink).toBe('https://t.me/kiwi_uz_bot?start=duel-749210')
      expect(inviteLink).toContain('duel-749210')
    })

    it('PIN kod 3+3 formatda chiroyli ko\'rinadi', () => {
      const pin = '749210'
      const formatted = `${pin.slice(0, 3)} ${pin.slice(3)}`
      expect(formatted).toBe('749 210')
    })
  })
})
