import { describe, expect, it } from 'vitest'
import {
  CURATED_BRILLIANT_LESSONS,
  buildBrilliantLessonFromMarkdown,
  findAuthorPortrait,
} from '../../../src/features/darslik-rusadabiyot/literature-brilliant-data'

describe('Rus adabiyoti — Brilliant formatidagi darslar', () => {
  it('muallif portretlarini matndan to‘g‘ri topadi', () => {
    expect(findAuthorPortrait('Александр Сергеевич Пушкин')?.name).toBe('Пушкин')
    expect(findAuthorPortrait('Михаил Юрьевич Лермонтов')?.name).toBe('Лермонтов')
    expect(findAuthorPortrait('Лев Николаевич Толстой')?.name).toBe('Толстой')
    expect(findAuthorPortrait('Неизвестный текст')).toBeNull()
  })

  it('tayyorlangan darslarda barcha slayd turlari (intro, visual, quiz, trap) mavjud', () => {
    const lesson = CURATED_BRILLIANT_LESSONS['1:1']
    expect(lesson).toBeDefined()
    expect(lesson.slides.length).toBeGreaterThanOrEqual(4)

    const types = lesson.slides.map((s) => s.type)
    expect(types).toContain('intro')
    expect(types).toContain('visual')
    expect(types).toContain('quiz')
    expect(types).toContain('trap')
  })

  it('quiz slaydlarida savol, kamida 3 ta variant va to‘g‘ri indeks bor', () => {
    const lesson = CURATED_BRILLIANT_LESSONS['1:1']
    const quizzes = lesson.slides.filter((s) => s.type === 'quiz')
    expect(quizzes.length).toBeGreaterThan(0)

    for (const q of quizzes) {
      if (q.type === 'quiz') {
        expect(q.question.length).toBeGreaterThan(10)
        expect(q.options.length).toBeGreaterThanOrEqual(3)
        expect(q.correctIndex).toBeGreaterThanOrEqual(0)
        expect(q.correctIndex).toBeLessThan(q.options.length)
        expect(q.explanation.length).toBeGreaterThan(10)
      }
    }
  })

  it('markdown manbasidan dinamik Brilliant dars yasay oladi', async () => {
    const dynamicLesson = await buildBrilliantLessonFromMarkdown(1, 0, 'Сначала разберёмся в терминах')
    expect(dynamicLesson).toBeDefined()
    expect(dynamicLesson.blockId).toBe(1)
    expect(dynamicLesson.slides.length).toBeGreaterThanOrEqual(3)
    expect(dynamicLesson.slides[0].type).toBe('intro')
  })
})
