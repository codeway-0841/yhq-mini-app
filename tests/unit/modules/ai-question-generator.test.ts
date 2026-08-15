import { describe, it, expect } from 'vitest'
import { GenerateQuestionsInputSchema } from '../../../server/modules/admin/ai-question-generator.service'

describe('AI Question Generator Schema & Service — Unit Tests', () => {
  it('custom_text rejimi uchun to\'g\'ri schema validatsiyadan o\'tadi', () => {
    const validData = {
      mode: 'custom_text',
      subjectId: 'yhq',
      promptText: 'Chorrahada harakatlanish qoidalariga ko\'ra transport vositalari o\'ng tomondan kelayotganga yo\'l berishi shart.',
      count: 5,
      difficulty: 'medium',
      language: 'both',
    }

    const result = GenerateQuestionsInputSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.count).toBe(5)
      expect(result.data.mode).toBe('custom_text')
    }
  })

  it('topic rejimi uchun mavzu matni qabul qilinadi', () => {
    const validTopic = {
      mode: 'topic',
      subjectId: 'fizika',
      promptText: 'Nyutonning dinamika qonunlari',
      count: 10,
      difficulty: 'hard',
      language: 'uz',
    }

    const result = GenerateQuestionsInputSchema.safeParse(validTopic)
    expect(result.success).toBe(true)
  })

  it('bo\'sh matn kiritilsa validatsiya xatosi qaytadi', () => {
    const invalidData = {
      mode: 'custom_text',
      subjectId: 'yhq',
      promptText: '  ',
      count: 5,
    }

    const result = GenerateQuestionsInputSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  it('savollar soni 30 tadan oshsa xato qaytadi', () => {
    const invalidCount = {
      mode: 'topic',
      subjectId: 'yhq',
      promptText: 'Yo\'l belgilari',
      count: 100,
    }

    const result = GenerateQuestionsInputSchema.safeParse(invalidCount)
    expect(result.success).toBe(false)
  })
})
