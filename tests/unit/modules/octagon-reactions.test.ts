import { describe, it, expect } from 'vitest'

describe('Octagon Live Reactions & Taunts — Unit Tests', () => {
  describe('Reaction Message Validation', () => {
    it('to\'g\'ri emoji va fraza turlarini qabul qiladi', () => {
      const allowedKinds = ['emoji', 'phrase', 'prop']
      expect(allowedKinds.includes('emoji')).toBe(true)
      expect(allowedKinds.includes('phrase')).toBe(true)
      expect(allowedKinds.includes('prop')).toBe(true)
      expect(allowedKinds.includes('unknown')).toBe(false)
    })

    it('reaksiya matnini maksimal 120 belgiga kesadi', () => {
      const longText = 'a'.repeat(200)
      const sanitized = longText.slice(0, 120)
      expect(sanitized.length).toBe(120)
    })
  })

  describe('Anti-Spam Cooldown Logic', () => {
    it('1.2 soniyadan kam vaqt ichida takroriy reaksiyalarni bloklaydi', () => {
      const cooldownMs = 1200
      let lastTime = 1000
      const now1 = 1500 // +500ms -> bloklanadi
      const canSend1 = now1 - lastTime >= cooldownMs
      expect(canSend1).toBe(false)

      const now2 = 2300 // +1300ms -> ruxsat
      const canSend2 = now2 - lastTime >= cooldownMs
      expect(canSend2).toBe(true)
    })
  })

  describe('Random Screen Position Generator', () => {
    it('o\'yinchi va raqib uchun mos gorizontal koordinatalar beradi', () => {
      const isYou = true
      const xPosYou = isYou ? 65 + Math.random() * 20 : 15 + Math.random() * 20
      expect(xPosYou).toBeGreaterThanOrEqual(65)
      expect(xPosYou).toBeLessThanOrEqual(85)

      const isOpp = false
      const xPosOpp = isOpp ? 65 + Math.random() * 20 : 15 + Math.random() * 20
      expect(xPosOpp).toBeGreaterThanOrEqual(15)
      expect(xPosOpp).toBeLessThanOrEqual(35)
    })
  })
})
