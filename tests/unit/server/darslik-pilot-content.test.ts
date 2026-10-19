import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DARSLIK_LESSON_MAX_EXERCISES,
  DARSLIK_LESSON_MIN_EXERCISES,
  DarslikCheckSchema,
  gradeDarslikCheck,
  publicDarslikCheck,
  type DarslikAnswers,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'
import { block01Checks, BLOCK_01_CURATED_TOPIC_IDS } from '../../../server/modules/darslik/curated/block-01'
import source from '../../../server/modules/darslik/source.json'

const topics = source as Record<string, { title: string; source: string }>
const EXPECTED_TOPICS = Array.from({ length: 12 }, (_, index) => '1:' + index)

function answersFor(check: DarslikCheck): DarslikAnswers {
  return Object.fromEntries(check.questions.map(question => {
    switch (question.kind) {
      case 'mcq':
      case 'listening':
        return [question.id, String(question.correctIndex)]
      case 'input':
        return [question.id, question.answers[0]]
      case 'word_bank':
        return [question.id, question.answer]
      case 'match':
        return [question.id, question.pairs.map(pair => pair.right)]
    }
  }))
}

function stripStress(value: string): string {
  return value
    .replace(/\u0301/g, '')
    .replace(/[óò]/g, 'о')
    .replace(/[áà]/g, 'а')
    .replace(/[éè]/g, 'е')
    .replace(/[íì]/g, 'и')
    .replace(/[úù]/g, 'у')
    .toLocaleLowerCase('ru')
}

describe('1-blok pilot kontenti — qo‘lda tekshirilgan darslar', () => {
  it('aynan 1-blokning 12 mavzusini qamrab oladi', () => {
    expect(BLOCK_01_CURATED_TOPIC_IDS).toEqual(EXPECTED_TOPICS)
    for (const topicId of EXPECTED_TOPICS) expect(block01Checks[topicId], topicId).toBeTruthy()
  })

  it('har mavzuda 5–7 mashq, 4+ tur va kamida 1 tinglash bor', () => {
    for (const topicId of EXPECTED_TOPICS) {
      const parsed = DarslikCheckSchema.safeParse(block01Checks[topicId])
      expect(parsed.success, topicId).toBe(true)
      if (!parsed.success) continue
      const { questions } = parsed.data
      expect(questions.length, topicId).toBeGreaterThanOrEqual(DARSLIK_LESSON_MIN_EXERCISES)
      expect(questions.length, topicId).toBeLessThanOrEqual(DARSLIK_LESSON_MAX_EXERCISES)
      const kinds = new Set(questions.map(question => question.kind))
      expect(kinds.size, topicId).toBeGreaterThanOrEqual(4)
      expect(questions.filter(question => question.kind === 'listening').length, topicId).toBeGreaterThanOrEqual(1)
    }
  })

  it('har mashqning izohi va aniq javobi bor', () => {
    for (const topicId of EXPECTED_TOPICS) {
      const parsed = DarslikCheckSchema.safeParse(block01Checks[topicId])
      if (!parsed.success) continue
      for (const question of parsed.data.questions) {
        expect(question.prompt.length, topicId).toBeGreaterThan(5)
        expect(question.explanation.length, topicId).toBeGreaterThan(20)
      }
    }
  })

  it('javob kalitlari public payloadda ko‘rinmaydi', () => {
    for (const topicId of EXPECTED_TOPICS) {
      const parsed = DarslikCheckSchema.safeParse(block01Checks[topicId])
      if (!parsed.success) continue
      const publicCheck = publicDarslikCheck(parsed.data)
      const serialized = JSON.stringify(publicCheck)
      expect(serialized, topicId).not.toContain('correctIndex')
      expect(serialized, topicId).not.toContain('"explanation"')
      expect(serialized, topicId).not.toContain('"correctAnswer"')
      expect(serialized, topicId).not.toContain('"pairs"')
      expect(serialized, topicId).not.toContain('"answer"')
    }
  })

  it('har mavzu o‘z javob kaliti bilan pass bo‘ladi', () => {
    for (const topicId of EXPECTED_TOPICS) {
      const parsed = DarslikCheckSchema.safeParse(block01Checks[topicId])
      if (!parsed.success) continue
      const result = gradeDarslikCheck(parsed.data, answersFor(parsed.data))
      expect(result.passed, topicId).toBe(true)
      expect(result.correct, topicId).toBe(parsed.data.questions.length)
      expect(result.accuracy, topicId).toBe(100)
    }
  })

  it('tinglash audio matni darslik manbasida mavjud', () => {
    for (const topicId of EXPECTED_TOPICS) {
      const parsed = DarslikCheckSchema.safeParse(block01Checks[topicId])
      if (!parsed.success) continue
      const topicSource = stripStress(topics[topicId]?.source ?? '')
      for (const question of parsed.data.questions) {
        if (question.kind !== 'listening') continue
        expect(topicSource, topicId + ' / ' + question.audioText).toContain(stripStress(question.audioText))
      }
    }
  })

  it('curated kontent AI generatoriga bog‘lanmagan', () => {
    const file = readFileSync(resolve(process.cwd(), 'server/modules/darslik/curated/block-01.ts'), 'utf8')
    expect(file).not.toContain('callMetaJson')
    expect(file).not.toContain('meta-generator')
  })
})
