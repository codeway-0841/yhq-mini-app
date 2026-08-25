/**
 * Kunlik vazifalar konfigi (shared/daily-tasks.ts) — data integrity.
 * Vazifalar iqtisod tebranishini oshirmasligi va aggregated metric sof
 * bo'lishi kerak (recordAnswer'dan tashqori da'volar mumkin emas).
 */
import { describe, it, expect } from 'vitest'
import { DAILY_TASKS, getDailyTask } from '../../../shared/daily-tasks'
import { COINS_DAILY_ANSWER_CAP } from '../../../shared/xp'

describe('config/daily-tasks — data integrity', () => {
  it("barcha id'lar unikal", () => {
    const ids = DAILY_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('metric faqat daily_records ustunlaridan (answered|correct|fixed)', () => {
    for (const t of DAILY_TASKS) {
      expect(['answered', 'correct', 'fixed']).toContain(t.metric)
    }
  })

  it('target/reward musbat butun; reward yumshoq cap (iqtisod portlamasligi uchun)', () => {
    for (const t of DAILY_TASKS) {
      expect(Number.isInteger(t.target) && t.target > 0).toBe(true)
      expect(Number.isInteger(t.reward) && t.reward > 0).toBe(true)
      // Yumshoq cap: bitta vazifa kunlik javob shiftining YARMIDAN oshmasin —
      // javob mint'i asosiy manba bo'lib qolishi kerak.
      expect(t.reward).toBeLessThanOrEqual(COINS_DAILY_ANSWER_CAP / 2)
    }
    // Kunlik total mukofot cap'i: vazifalar javob mint'idan katta bo'lmasligi
    // shart. Chegara konstantaga BOG'LANGAN — iqtisod miqyosi o'zgarganda bu
    // test qo'lda yangilanishi shart emas (avval 50 deb qattiq yozilgandi va
    // 2× ko'chirishda eskirib qolgandi).
    const totalReward = DAILY_TASKS.reduce((s, t) => s + t.reward, 0)
    expect(totalReward).toBeLessThanOrEqual(COINS_DAILY_ANSWER_CAP)
  })

  it('i18n label to‘liq (uz/ru)', () => {
    for (const t of DAILY_TASKS) {
      expect(t.label.uz.trim()).not.toBe('')
      expect(t.label.ru.trim()).not.toBe('')
    }
  })

  it('kamida 3 vazifa (retention uchun har kunlik sabab)', () => {
    expect(DAILY_TASKS.length).toBeGreaterThanOrEqual(3)
  })

  it('getDailyTask: nomaʼlum → null', () => {
    expect(getDailyTask('???')).toBeNull()
    expect(getDailyTask(DAILY_TASKS[0].id)?.id).toBe(DAILY_TASKS[0].id)
  })
})
