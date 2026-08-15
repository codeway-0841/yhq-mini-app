import { describe, it, expect } from 'vitest'
import { t } from '../../../src/shared/i18n'
import { buildTopicBreakdown } from '../../../src/features/test/topic-diagnosis'

describe('Exam Review & Diagnostic Breakdown System', () => {
  it('has complete UZ and RU i18n keys for Exam Review', () => {
    expect(t('uz', 'examReviewBtn')).toBe('Xatolarni tahlil qilish')
    expect(t('ru', 'examReviewBtn')).toBe('Разбор ошибок')

    expect(t('uz', 'examReviewTitle')).toBe('Imtihon tahlili')
    expect(t('ru', 'examReviewTitle')).toBe('Разбор экзамена')

    expect(t('uz', 'yourAnswer')).toBe('Sizning javobingiz')
    expect(t('ru', 'yourAnswer')).toBe('Ваш ответ')

    expect(t('uz', 'correctAnswerLabel')).toBe("To'g'ri javob")
    expect(t('ru', 'correctAnswerLabel')).toBe('Правильный ответ')

    expect(t('uz', 'filterOnlyMistakes')).toBe('Faqat xatolar')
    expect(t('ru', 'filterOnlyMistakes')).toBe('Только ошибки')

    expect(t('uz', 'filterAllQuestions')).toBe('Barcha savollar')
    expect(t('ru', 'filterAllQuestions')).toBe('Все вопросы')
  })

  it('correctly calculates topic breakdown and sorts the weakest topic first', () => {
    const mockTopics = [
      { id: 1, nameUz: 'Chorrahalar', nameRu: 'Перекрестки' },
      { id: 2, nameUz: 'Tezlik', nameRu: 'Скорость' },
      { id: 3, nameUz: 'Belgilar', nameRu: 'Знаки' },
    ]

    const items: { topicId: number | null; status: 'correct' | 'incorrect' | 'unanswered' }[] = [
      // Topic 1: 1/2 correct (50%)
      { topicId: 1, status: 'correct' },
      { topicId: 1, status: 'incorrect' },
      // Topic 2: 0/2 correct (0%) -> Weakest
      { topicId: 2, status: 'incorrect' },
      { topicId: 2, status: 'unanswered' },
      // Topic 3: 2/2 correct (100%) -> Best
      { topicId: 3, status: 'correct' },
      { topicId: 3, status: 'correct' },
    ]

    const breakdown = buildTopicBreakdown(items, mockTopics, 'uz', 'Umumiy')

    expect(breakdown).toHaveLength(3)
    // Weakest topic first
    expect(breakdown[0].topicId).toBe(2)
    expect(breakdown[0].name).toBe('Tezlik')
    expect(breakdown[0].pct).toBe(0)

    // Middle topic
    expect(breakdown[1].topicId).toBe(1)
    expect(breakdown[1].name).toBe('Chorrahalar')
    expect(breakdown[1].pct).toBe(50)

    // Best topic last
    expect(breakdown[2].topicId).toBe(3)
    expect(breakdown[2].name).toBe('Belgilar')
    expect(breakdown[2].pct).toBe(100)
  })
})
