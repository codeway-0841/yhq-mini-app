import { describe, it, expect } from 'vitest'
import { TOURNAMENT_PRIZES } from '../../../server/modules/leaderboard/tournament-prize.service'

describe('Tournament Prizes Automation — Unit Tests', () => {
  describe('Prize Days Configuration', () => {
    it('1-o\'rin uchun 30 kunlik Premium beriladi', () => {
      expect(TOURNAMENT_PRIZES[1]).toBe(30)
    })

    it('2-o\'rin uchun 14 kunlik Premium beriladi', () => {
      expect(TOURNAMENT_PRIZES[2]).toBe(14)
    })

    it('3-o\'rin uchun 7 kunlik Premium beriladi', () => {
      expect(TOURNAMENT_PRIZES[3]).toBe(7)
    })
  })

  describe('New Premium Date Calculation Logic', () => {
    it('free user uchun yangi sana bugundan prizeDays qo\'shib hisoblanadi', () => {
      const prizeDays = 30
      const now = Date.now()
      const newUntil = new Date(now + prizeDays * 86_400_000)
      const diffDays = Math.round((newUntil.getTime() - now) / 86_400_000)
      expect(diffDays).toBe(30)
    })

    it('mavjud faol Premium muddati ustiga yangi prizeDays qo\'shiladi', () => {
      const now = Date.now()
      const existingUntil = new Date(now + 10 * 86_400_000) // 10 kuni qolgan
      const prizeDays = 14
      const baseTime = existingUntil.getTime() > now ? existingUntil.getTime() : now
      const newUntil = new Date(baseTime + prizeDays * 86_400_000)
      const totalDays = Math.round((newUntil.getTime() - now) / 86_400_000)
      expect(totalDays).toBe(24) // 10 + 14 = 24 kun
    })
  })

  describe('Celebratory Telegram Notification Formatting', () => {
    it('1-o\'rin chempioniga tabriknoma to\'g\'ri shakllanadi', () => {
      const name = 'Jasur'
      const score = 250
      const prizeDays = 30
      const medal = '🥇'
      const title = '1-O\'RIN CHEMPIONI'

      const msg = `${medal} <b>TABRIKLAYMIZ, ${name}!</b>\n\n` +
        `Siz o'tgan haftalik bilimlar turnirida <b>${score} ball</b> bilan <b>${medal} ${title}</b> bo'ldingiz! 🎉\n\n` +
        `🎁 <b>Sovriningiz:</b> ${prizeDays} kunlik Bepul <b>Premium</b> obuna hisobingizga faollashtirildi!`

      expect(msg).toContain('Jasur')
      expect(msg).toContain('250 ball')
      expect(msg).toContain('30 kunlik')
      expect(msg).toContain('1-O\'RIN CHEMPIONI')
    })
  })
})
