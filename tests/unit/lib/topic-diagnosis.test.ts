import { describe, it, expect } from 'vitest'
import { buildTopicBreakdown } from '../../../src/features/test/topic-diagnosis'

const TOPICS = [
  { id: 1, nameUz: 'Belgilar', nameRu: 'Знаки' },
  { id: 2, nameUz: 'Svetafor', nameRu: 'Светофор' },
]

const item = (topicId: number | null, status: 'correct' | 'incorrect' | 'unanswered') => ({ topicId, status })

describe('buildTopicBreakdown', () => {
  it('mavzular bo\'yicha guruhlash va foiz to\'g\'ri hisoblanadi', () => {
    const rows = buildTopicBreakdown([
      item(1, 'correct'), item(1, 'incorrect'), item(1, 'unanswered'),
      item(2, 'correct'), item(2, 'correct'),
    ], TOPICS, 'uz', 'Umumiy')

    const belgilar = rows.find((r) => r.topicId === 1)!
    expect(belgilar).toMatchObject({ name: 'Belgilar', correct: 1, total: 3, pct: 33 })
    const svetafor = rows.find((r) => r.topicId === 2)!
    expect(svetafor).toMatchObject({ correct: 2, total: 2, pct: 100 })
  })

  it('eng ZAIF mavzu birinchi (diagnoz uchun)', () => {
    const rows = buildTopicBreakdown([
      item(2, 'correct'), item(2, 'correct'),
      item(1, 'correct'), item(1, 'incorrect'),
    ], TOPICS, 'uz', 'Umumiy')
    expect(rows[0]!.topicId).toBe(1)
  })

  it('topicId null bo\'lsa generalLabel ostida guruhlanadi', () => {
    const rows = buildTopicBreakdown([item(null, 'incorrect')], TOPICS, 'uz', 'Umumiy')
    expect(rows[0]!.name).toBe('Umumiy')
  })

  it('RU tilda nameRu ishlatiladi', () => {
    const rows = buildTopicBreakdown([item(1, 'correct')], TOPICS, 'ru', 'Общие')
    expect(rows[0]!.name).toBe('Знаки')
  })

  it("noma'lum topicId — #id ko'rsatiladi (crash emas)", () => {
    const rows = buildTopicBreakdown([item(999, 'correct')], TOPICS, 'uz', 'Umumiy')
    expect(rows[0]!.name).toBe('#999')
  })
})
