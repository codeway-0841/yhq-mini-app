import { describe, expect, it } from 'vitest'
import {
  DARSLIK_LESSON_MAX_EXERCISES,
  DARSLIK_LESSON_MIN_EXERCISES,
  DarslikCheckSchema,
  darslikLessonXp,
  gradeDarslikCheck,
  gradeDarslikExercise,
  isDarslikPublicAnswerComplete,
  publicDarslikCheck,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'
import { firstTopicCheck } from '../../../server/modules/darslik/first-topic'

const lesson: DarslikCheck = {
  format: 'lesson',
  questions: [
    {
      id: 'q1', kind: 'mcq', prompt: 'Что мы произносим и слышим?',
      options: ['Буквы', 'Звуки', 'Знаки', 'Слоги'], correctIndex: 1,
      explanation: 'Звуки мы произносим и слышим.',
    },
    {
      id: 'q2', kind: 'input', prompt: 'Сколько звуков в слове «дом»?',
      answers: ['3'], explanation: 'В слове «дом» три звука.',
    },
    {
      id: 'q3', kind: 'word_bank', prompt: 'Собери правило.',
      tokens: ['Буквы', 'мы', 'видим', 'и', 'пишем', 'слышим'],
      answer: ['Буквы', 'мы', 'видим', 'и', 'пишем'],
      explanation: 'Буквы мы видим и пишем.',
    },
    {
      id: 'q4', kind: 'match', prompt: 'Сопоставь слово и число звуков.',
      pairs: [
        { left: 'дом', right: '3 звука' },
        { left: 'ёлка', right: '5 звуков' },
        { left: 'юла', right: '4 звука' },
      ],
      explanation: 'Дом — 3, ёлка — 5, юла — 4.',
    },
    {
      id: 'q5', kind: 'listening', prompt: 'Слушай слово. Сколько звуков?',
      audioText: 'ёлка', options: ['3', '4', '5', '6'], correctIndex: 2,
      explanation: 'В слове «ёлка» пять звуков.',
    },
  ],
}

const correctAnswers = {
  q1: '1',
  q2: '3',
  q3: ['Буквы', 'мы', 'видим', 'и', 'пишем'],
  q4: ['3 звука', '5 звуков', '4 звука'],
  q5: '2',
}

describe('darslik v2 — mashq sxemasi', () => {
  it('5–7 mashqli, 4+ turdagi darsni qabul qiladi', () => {
    const parsed = DarslikCheckSchema.safeParse(lesson)
    expect(parsed.success).toBe(true)
    expect(lesson.questions).toHaveLength(DARSLIK_LESSON_MIN_EXERCISES)
    expect(DARSLIK_LESSON_MAX_EXERCISES).toBe(7)
  })

  it('5 tadan kam mashqni rad etadi', () => {
    const parsed = DarslikCheckSchema.safeParse({
      format: 'lesson',
      questions: lesson.questions.slice(0, 4),
    })
    expect(parsed.success).toBe(false)
  })

  it('4 xildan kam turni rad etadi', () => {
    const questions = [
      lesson.questions[0],
      { ...lesson.questions[0], id: 'q2' },
      lesson.questions[2],
      { ...lesson.questions[2], id: 'q4' },
      lesson.questions[4],
    ]
    expect(DarslikCheckSchema.safeParse({ format: 'lesson', questions }).success).toBe(false)
  })

  it('tinglash mashqisiz darsni rad etadi', () => {
    const questions = [
      ...lesson.questions.slice(0, 4),
      { ...lesson.questions[0], id: 'q5' },
    ]
    expect(DarslikCheckSchema.safeParse({ format: 'lesson', questions }).success).toBe(false)
  })

  it('takroriy ID, variant va juftlikni rad etadi', () => {
    const duplicateId = { format: 'lesson', questions: [lesson.questions[0], ...lesson.questions.slice(0, 4)] }
    expect(DarslikCheckSchema.safeParse(duplicateId).success).toBe(false)

    const duplicateOptions = {
      format: 'lesson',
      questions: [
        { ...lesson.questions[0], options: ['А', 'А', 'Б', 'В'] },
        ...lesson.questions.slice(1),
      ],
    }
    expect(DarslikCheckSchema.safeParse(duplicateOptions).success).toBe(false)

    const duplicatePairs = {
      format: 'lesson',
      questions: lesson.questions.map(question => question.id === 'q4'
        ? { ...question, pairs: [{ left: 'а', right: '1' }, { left: 'б', right: '1' }, { left: 'в', right: '2' }] }
        : question),
    }
    expect(DarslikCheckSchema.safeParse(duplicatePairs).success).toBe(false)
  })

  it('tinglash javobi audio matnining o‘zi bo‘lishini rad etadi', () => {
    const parsed = DarslikCheckSchema.safeParse({
      format: 'lesson',
      questions: lesson.questions.map(question => question.id === 'q5'
        ? { ...question, options: ['ёлка', '4', '5', '6'] }
        : question),
    })
    expect(parsed.success).toBe(false)
  })

  it('word bank javobi tokenlar ichidan bo‘lishini talab qiladi', () => {
    const parsed = DarslikCheckSchema.safeParse({
      format: 'lesson',
      questions: lesson.questions.map(question => question.id === 'q3'
        ? { ...question, answer: ['Буквы', 'которых', 'нет'] }
        : question),
    })
    expect(parsed.success).toBe(false)
  })

  it('v1 legacy sxemasi ham parse bo‘ladi', () => {
    const parsed = DarslikCheckSchema.safeParse(firstTopicCheck)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect('format' in parsed.data ? parsed.data.format : 'legacy').toBe('legacy')
  })
})

describe('darslik v2 — public payload', () => {
  it('javob kalitlari va izohlarni oshkor qilmaydi', () => {
    const publicCheck = publicDarslikCheck(lesson)
    expect(publicCheck.format).toBe('lesson')
    const serialized = JSON.stringify(publicCheck)
    expect(serialized).not.toContain('correctIndex')
    expect(serialized).not.toContain('"explanation"')
    expect(serialized).not.toContain('"correctAnswer"')
    expect(serialized).not.toContain('"pairs"')
    expect(serialized).not.toContain('"answer"')

    const wordBank = publicCheck.questions.find(question => question.kind === 'word_bank')
    expect(wordBank).toHaveProperty('tokens')
    const match = publicCheck.questions.find(question => question.kind === 'match')
    expect(match).toHaveProperty('left')
    expect(match).toHaveProperty('right')
  })

  it('match o‘ng ustuni alohida tartibda keladi', () => {
    const match = publicDarslikCheck(lesson).questions.find(question => question.kind === 'match')
    if (match?.kind !== 'match') throw new Error('match missing')
    expect([...match.left]).toEqual(['дом', 'ёлка', 'юла'])
    expect([...match.right].sort()).toEqual(['3 звука', '4 звука', '5 звуков'].sort())
    expect(match.right).not.toEqual(['3 звука', '5 звуков', '4 звука'])
  })
})

describe('darslik v2 — baholash', () => {
  it('har bir turni to‘g‘ri va xato baholaydi', () => {
    for (const question of lesson.questions) {
      if (!('explanation' in question)) continue
      const correct = question.kind === 'mcq' || question.kind === 'listening'
        ? String(question.correctIndex)
        : question.kind === 'input'
          ? question.answers[0]
          : question.kind === 'word_bank'
            ? question.answer
            : question.pairs.map(pair => pair.right)
      expect(gradeDarslikExercise(question, correct).correct, question.id).toBe(true)
      expect(gradeDarslikExercise(question, question.kind === 'input' ? 'нет' : ['нет']).correct, question.id).toBe(false)
    }
  })

  it('yozma javob registr va probelga bardoshli', () => {
    expect(gradeDarslikExercise(lesson.questions[1], ' 3 ').correct).toBe(true)
    expect(gradeDarslikExercise(lesson.questions[1], '3').correct).toBe(true)
    expect(gradeDarslikExercise(lesson.questions[1], '4').correct).toBe(false)
  })

  it('word bank tartibini tekshiradi', () => {
    const question = lesson.questions[2]
    expect(gradeDarslikExercise(question, ['Буквы', 'мы', 'видим', 'и', 'пишем']).correct).toBe(true)
    expect(gradeDarslikExercise(question, ['мы', 'Буквы', 'видим', 'и', 'пишем']).correct).toBe(false)
    expect(gradeDarslikExercise(question, 'Буквы мы видим и пишем').correct).toBe(true)
  })

  it('match juftliklarini chap ustun tartibida tekshiradi', () => {
    const question = lesson.questions[3]
    expect(gradeDarslikExercise(question, ['3 звука', '5 звуков', '4 звука']).correct).toBe(true)
    expect(gradeDarslikExercise(question, ['5 звуков', '3 звука', '4 звука']).correct).toBe(false)
  })

  it('to‘liq dars natijasi va aniqlikni qaytaradi', () => {
    const passed = gradeDarslikCheck(lesson, correctAnswers)
    expect(passed.passed).toBe(true)
    expect(passed.correct).toBe(5)
    expect(passed.accuracy).toBe(100)
    expect(passed.feedback.every(item => item.correctAnswer)).toBe(true)

    const failed = gradeDarslikCheck(lesson, { ...correctAnswers, q2: '4' })
    expect(failed.passed).toBe(false)
    expect(failed.correct).toBe(4)
    expect(failed.accuracy).toBe(80)
    expect(failed.feedback.find(item => item.id === 'q2')?.correctAnswer).toBe('3')
  })

  it('javob to‘liqligini har bir tur bo‘yicha aniqlaydi', () => {
    const publicCheck = publicDarslikCheck(lesson)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[0], '1')).toBe(true)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[0], '')).toBe(false)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[1], '3')).toBe(true)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[2], [])).toBe(false)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[2], ['Буквы'])).toBe(true)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[3], ['3 звука', ''])).toBe(false)
    expect(isDarslikPublicAnswerComplete(publicCheck.questions[3], ['3 звука', '5 звуков', '4 звука'])).toBe(true)
  })

  it('XP faqat to‘liq passda maksimal bo‘ladi', () => {
    expect(darslikLessonXp(5, 5)).toBe(10 + 10 + 10)
    expect(darslikLessonXp(4, 5)).toBe(10 + 8)
    expect(darslikLessonXp(0, 0)).toBe(0)
  })
})
