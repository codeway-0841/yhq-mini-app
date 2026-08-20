/**
 * Kunlik vazifalar konfigi (shared/daily-tasks.ts) — data integrity.
 * Vazifalar iqtisod tebranishini oshirmasligi va aggregated metric sof
 * bo'lishi kerak (recordAnswer'dan tashqori da'volar mumkin emas).
 */
import { describe, it, expect } from 'vitest'
import { DAILY_TASKS, getDailyTask } from '../../../shared/daily-tasks'

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
      // Yumshoq cap: bitta vazifa 25c'dan oshmasin (kunlik ~40c vazifalardan —
      // javob mint'i (~80c) asosiy manba bo'lib qoladi)
      expect(t.reward).toBeLessThanOrEqual(25)
    }
    // Kunlik total mukofot cap'i: vazifalar javob mint'idan katta bo'lmasligi shart
    const totalReward = DAILY_TASKS.reduce((s, t) => s + t.reward, 0)
    expect(totalReward).toBeLessThanOrEqual(50)
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
