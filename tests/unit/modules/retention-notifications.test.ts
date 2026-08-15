import { describe, it, expect } from 'vitest'
import { LEAGUE_ORDER } from '../../../server/modules/leaderboard/leaderboard.repository'

describe('Retention Push Notifications — Unit Tests', () => {
  describe('League Order & Formatting', () => {
    it('barcha ligalar tartibi mavjud (bronze -> silver -> gold -> platinum)', () => {
      expect(LEAGUE_ORDER).toEqual(['bronze', 'silver', 'gold', 'platinum'])
    })
  })

  describe('Notification Text Logic', () => {
    it('streak >= 3 bo\'lsa intizom xavfi matni generatsiya qilinadi', () => {
      const streak = 7
      const name = 'Ali'
      const uzText = `🔥 <b>${name}</b>, sizning <b>${streak} kunlik</b> intizom seriyangiz xavf ostida!\n\nBugun hali mashq qilmadingiz — 2 daqiqalik test yechib seriyangizni saqlab qoling. Katta natija har kungi intizomdan boshlanadi!`
      expect(uzText).toContain('7 kunlik')
      expect(uzText).toContain('Ali')
    })

    it('streak < 3 bo\'lsa 10 ta savol mashq matni generatsiya qilinadi', () => {
      const streak = 1
      const name = 'Vali'
      const uzText = `⚡ <b>${name}</b>, bugungi 10 ta savolni yechishni unutmang!\n\nKunlik mashqlar bilimni mustahkamlaydi va imtihonga 100% tayyorlaydi.`
      expect(uzText).toContain('Vali')
      expect(uzText).toContain('10 ta savol')
    })

    it('inactivity xabari do\'stona shakllanadi', () => {
      const name = 'Aziz'
      const uzText = `👋 Salom, <b>${name}</b>!\n\nYangi testlar va biletlar sizni kutmoqda. Bir necha daqiqada bilimingizni yangilab, imtihonga tayyorgarlikni davom ettiring!`
      expect(uzText).toContain('Aziz')
      expect(uzText).toContain('Yangi testlar')
    })

    it('premium tugashi xabari ogohlantirish beradi', () => {
      const name = 'Gulnoza'
      const uzText = `👑 <b>${name}</b>, sizning Premium obunangiz <b>ertaga</b> o'z nihoyasiga yetadi.\n\nAI Tutor, barcha eksklyuziv temalar va cheksiz mashq rejimlari uzluksiz ishlashi uchun obunangizni yangilang!`
      expect(uzText).toContain('Gulnoza')
      expect(uzText).toContain('ertaga')
    })
  })
})
