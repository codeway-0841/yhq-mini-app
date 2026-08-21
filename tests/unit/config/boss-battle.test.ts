/**
 * Boss Battle (shared/boss-battle.ts) — config integrity + period logikasi.
 *
 * Nega: roster rotatsiyasi DETERMINISTIK (period indeksi) bo'lishi shart —
 * admin yaratadigan narsa emas, desync bo'lsa DB'dagi boss_id bilan UI
 * nomi/HP farq qiladi. HP/mukofot balansi iqtisod byudjeti bilan chegarada.
 */
import { describe, it, expect } from 'vitest'
import {
  BOSS_ROSTER, BOSS_DAMAGE_PER_CORRECT, BOSS_REWARDS,
  bossPeriodKey, bossPeriodEndDate, bossForPeriod, getBossDef,
} from '../../../shared/boss-battle'

describe('config/boss-battle — data integrity', () => {
  it("roster: kamida 3 boss, id'lar unikal, UZ+RU nom + emoji", () => {
    expect(BOSS_ROSTER.length).toBeGreaterThanOrEqual(3)
    const ids = BOSS_ROSTER.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of BOSS_ROSTER) {
      expect(b.name.uz.trim()).not.toBe('')
      expect(b.name.ru.trim()).not.toBe('')
      expect(b.emoji.trim()).not.toBe('')
      expect(b.hp).toBeGreaterThan(0)
    }
  })

  it('iquitod byudjeti: damage musbat; ishtirok chegarasi va mukofotlar oqilona', () => {
    expect(BOSS_DAMAGE_PER_CORRECT).toBeGreaterThan(0)
    expect(BOSS_REWARDS.participationMinDamage).toBeGreaterThanOrEqual(BOSS_DAMAGE_PER_CORRECT)
    expect(BOSS_REWARDS.participationCoins).toBeGreaterThan(0)
    expect(BOSS_REWARDS.participationCoins).toBeLessThanOrEqual(100)  // ~3 kunlik mintdan katta emas
    expect(BOSS_REWARDS.topCoins.length).toBe(3)
    expect(BOSS_REWARDS.topCoins[0]).toBeGreaterThan(BOSS_REWARDS.topCoins[2])
    // HP yetarlicha katta bo'lsin (bitta faol o'quvchi yenga olmasin):
    for (const b of BOSS_ROSTER) {
      expect(b.hp).toBeGreaterThanOrEqual(BOSS_DAMAGE_PER_CORRECT * 1000)  // ≥1000 to'g'ri javob
    }
  })

  it('bossPeriodKey: dushanba kaliti (Tashkent), chegaralar', () => {
    // 2026-08-21 = juma; shu hafta dushanbasi = 2026-08-17
    expect(bossPeriodKey(new Date('2026-08-21T12:00:00Z'))).toBe('2026-08-17')
    // Dushanba o'zi
    expect(bossPeriodKey(new Date('2026-08-17T12:00:00Z'))).toBe('2026-08-17')
    // Yakshanba ham shu haftaga kiradi (keyingi dushanba emas)
    expect(bossPeriodKey(new Date('2026-08-23T12:00:00Z'))).toBe('2026-08-17')
    // Keyingi dushanba — yangi period
    expect(bossPeriodKey(new Date('2026-08-24T12:00:00Z'))).toBe('2026-08-24')
  })

  it('bossPeriodEndDate: period + 7 kun', () => {
    expect(bossPeriodEndDate('2026-08-17').toISOString().slice(0, 10)).toBe('2026-08-24')
  })

  it("bossForPeriod: deterministik, roster doirasida, qo'shni haftalar (odatda) farq", () => {
    const a = bossForPeriod('2026-08-17')
    const b = bossForPeriod('2026-08-17')      // deterministik
    const c = bossForPeriod('2026-08-24')
    expect(a).toBe(b)
    expect(BOSS_ROSTER.map((x) => x.id)).toContain(a.id)
    expect(BOSS_ROSTER.map((x) => x.id)).toContain(c.id)
    // 4 hafta ketma-ket — roster aylanadi, har qanday period valid qaytadi
    for (const pk of ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07']) {
      expect(getBossDef(bossForPeriod(pk).id)).not.toBeNull()
    }
  })
})
