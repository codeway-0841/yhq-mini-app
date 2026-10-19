import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import outline from '../../../src/content/darslik-rustili/outline.json'
import {
  DARSLIK_CHECK_VERSION,
  DARSLIK_TOPIC_IDS,
  DarslikAnswersSchema,
  DarslikCheckSchema,
  canOpenDarslikTopic,
  darslikTopicId,
  gradeDarslikCheck,
  normalizeDarslikAnswer,
  publicDarslikCheck,
  splitDarslikSections,
} from '../../../shared/darslik-mastery'
import { firstTopicCheck } from '../../../server/modules/darslik/first-topic'

const blocks = Object.keys(outline).map(Number)
const blockSource = (block: number) =>
  readFileSync(resolve(process.cwd(), `src/content/darslik-rustili/block-${String(block).padStart(2, '0')}.md`), 'utf8')

describe('darslik mastery — ketma-ket ochilish', () => {
  it('537 mavzu id’si outline tartibida', () => {
    expect(DARSLIK_TOPIC_IDS).toHaveLength(537)
    expect(DARSLIK_TOPIC_IDS[0]).toBe('1:0')
    expect(DARSLIK_TOPIC_IDS.at(-1)).toBe('15:16')
  })

  it('birinchi mavzu ochiq, keyingilari oldingilarisiz yopiq', () => {
    expect(canOpenDarslikTopic('1:0', [])).toBe(true)
    expect(canOpenDarslikTopic('1:1', [])).toBe(false)
    expect(canOpenDarslikTopic('1:1', ['1:0'])).toBe(true)
    expect(canOpenDarslikTopic('1:2', ['1:0'])).toBe(false)
    expect(canOpenDarslikTopic('1:2', ['1:0', '1:1'])).toBe(true)
  })

  it('bloklar orasida ham barcha oldingi mavzular talab qilinadi', () => {
    const firstBlock = outline['1']
    const allFirst = firstBlock.map((_, index) => darslikTopicId(1, index))
    expect(canOpenDarslikTopic('2:0', allFirst)).toBe(true)

    const withoutLast = allFirst.slice(0, -1)
    expect(canOpenDarslikTopic('2:0', withoutLast)).toBe(false)
    expect(canOpenDarslikTopic('3:0', allFirst)).toBe(false)
    expect(canOpenDarslikTopic('99:0', allFirst)).toBe(false)
  })
})

describe('darslik mastery — savol sxemasi va baholash', () => {
  it('check versiyasi v2, eski v1 sxemasi ham parse bo‘ladi', () => {
    expect(DARSLIK_CHECK_VERSION).toBe(2)
    expect(DarslikCheckSchema.safeParse(firstTopicCheck).success).toBe(true)
  })

  it('birinchi mavzu testi sxemaga mos', () => {
    expect(DarslikCheckSchema.safeParse(firstTopicCheck).success).toBe(true)
    expect(firstTopicCheck.questions).toHaveLength(3)
    expect(firstTopicCheck.questions.filter((question) => question.kind === 'mcq')).toHaveLength(2)
    expect(firstTopicCheck.questions.filter((question) => question.kind === 'input')).toHaveLength(1)
  })

  it('noto‘g‘ri tuzilgan testlarni rad etadi', () => {
    const allMcq = {
      questions: [
        { id: 'a', kind: 'mcq', prompt: 'A?', options: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'A.' },
        { id: 'b', kind: 'mcq', prompt: 'B?', options: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'B.' },
        { id: 'c', kind: 'mcq', prompt: 'C?', options: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'C.' },
      ],
    }
    expect(DarslikCheckSchema.safeParse(allMcq).success).toBe(false)

    const duplicateOptions = {
      questions: [
        { id: 'a', kind: 'mcq', prompt: 'A?', options: ['1', '1', '3', '4'], correctIndex: 0, explanation: 'A.' },
        { id: 'b', kind: 'mcq', prompt: 'B?', options: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'B.' },
        { id: 'c', kind: 'input', prompt: 'C?', answers: ['1'], explanation: 'C.' },
      ],
    }
    expect(DarslikCheckSchema.safeParse(duplicateOptions).success).toBe(false)
  })

  it('publich javobda kalitlar va izohlar bo‘lmaydi', () => {
    const publicCheck = publicDarslikCheck(firstTopicCheck)
    for (const question of publicCheck.questions) {
      expect(question).not.toHaveProperty('correctIndex')
      expect(question).not.toHaveProperty('answers')
      expect(question).not.toHaveProperty('explanation')
    }
  })

  it('to‘g‘ri javoblar testdan o‘tadi, bitta xato — o‘tmaydi', () => {
    const answers = { sound: '1', horse: '2', count: '3' }
    const passed = gradeDarslikCheck(firstTopicCheck, answers)
    expect(passed.passed).toBe(true)
    expect(passed.correct).toBe(3)
    expect(passed.feedback.every((item) => item.correct)).toBe(true)

    const failed = gradeDarslikCheck(firstTopicCheck, { ...answers, count: '4' })
    expect(failed.passed).toBe(false)
    expect(failed.correct).toBe(2)
    expect(failed.feedback.find((item) => item.id === 'count')?.correct).toBe(false)
  })

  it('yozma javob registr, probel va bosh harflarga bardoshli', () => {
    expect(normalizeDarslikAnswer('  ДОМ ')).toBe('дом')
    const result = gradeDarslikCheck(firstTopicCheck, { sound: '1', horse: '2', count: ' 3 ' })
    expect(result.passed).toBe(true)
    expect(DarslikAnswersSchema.safeParse({ sound: '1', horse: '2', count: '3' }).success).toBe(true)
    // Sxema faqat shaklni tekshiradi; to'liqlikni endpoint /submit'da tekshiradi.
    expect(DarslikAnswersSchema.safeParse({ sound: '1' }).success).toBe(true)
    expect(DarslikAnswersSchema.safeParse({}).success).toBe(false)
  })
})

describe('darslik mastery — manba bo‘linishi', () => {
  it('har bir blok mavzulari outline bilan aynan mos', () => {
    for (const block of blocks) {
      const sections = splitDarslikSections(blockSource(block))
      expect(sections).toHaveLength(outline[String(block) as keyof typeof outline].length)
    }
  })

  it('oxirgi mavzu blok xulosasi va mini-testni o‘z ichiga olmaydi', () => {
    const sections = splitDarslikSections(blockSource(1))
    expect(sections).toHaveLength(12)
    const last = sections[11]
    expect(last.startsWith('# 12.')).toBe(true)
    expect(last).not.toContain('ЧТО НУЖНО ЗАПОМНИТЬ')
    expect(last).not.toContain('Мини-тест')
  })

  it('server source.json barcha mavzularni va toza manbani saqlaydi', () => {
    const source = JSON.parse(readFileSync(resolve(process.cwd(), 'server/modules/darslik/source.json'), 'utf8')) as Record<string, { title: string; source: string }>
    expect(Object.keys(source)).toHaveLength(537)
    expect(source['1:0'].title).toBe('ЗВУКИ И БУКВЫ')
    expect(source['1:0'].source).toContain('**Звук** — это то, что мы произносим и слышим.')
    expect(source['1:0'].source).not.toContain('Мини-тест')

    // Eksport qayta yasalganda fayl bilan ajralib ketmasligi uchun har bir
    // mavzu manbasi shared splitter natijasi bilan aynan bir xil.
    for (const block of blocks) {
      const sections = splitDarslikSections(blockSource(block))
      sections.forEach((section, index) => {
        expect(section.length).toBeGreaterThan(20)
        expect(source[darslikTopicId(block, index)].source).toBe(section)
      })
    }
  })
})
