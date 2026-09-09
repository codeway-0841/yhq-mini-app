import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GOLDEN_FIXTURES } from '../../fixtures/math-print-golden.fixture'
import { parseMathSegments, renderKaTeXToString } from '../../../src/shared/components/MathText'

const ROOT = process.cwd()
// Test against v2 if available, otherwise canonical math-print.json
const V2_PATH = path.resolve(ROOT, 'content-banks/matematika/v2/math-print.json')
const CANONICAL_PATH = path.resolve(ROOT, 'content-banks/matematika/math-print.json')
const TARGET_PATH = fs.existsSync(V2_PATH) ? V2_PATH : CANONICAL_PATH

interface BankItem {
  externalId: string
  topicExternalId: string
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  correctAnswer: string
  source: string
  image: string | null
}

interface BankData {
  version: number
  subjectId: string
  bankId: string
  bankName: string
  topics: Array<{ externalId: string; nameUz: string; nameRu: string }>
  items: BankItem[]
}

describe('Matematika Test Print Bank & Golden Fixture Regression Suite', () => {
  it('loads bank and validates overall structure (368 topics, 11,040 questions)', () => {
    expect(fs.existsSync(TARGET_PATH)).toBe(true)
    const raw = fs.readFileSync(TARGET_PATH, 'utf8')
    const bank = JSON.parse(raw) as BankData

    expect(bank.bankId).toBe('math_db')
    expect(bank.subjectId).toBe('matematika')
    expect(bank.topics.length).toBe(368)
    expect(bank.items.length).toBe(11040)

    // Topic question count: exactly 30 per topic
    const counts = new Map<string, number>()
    for (const item of bank.items) {
      counts.set(item.topicExternalId, (counts.get(item.topicExternalId) ?? 0) + 1)
    }
    for (const topic of bank.topics) {
      expect(counts.get(topic.externalId)).toBe(30)
    }
  })

  it('validates options and answer keys for all 11,040 questions', () => {
    const raw = fs.readFileSync(TARGET_PATH, 'utf8')
    const bank = JSON.parse(raw) as BankData
    const validKeys = ['A1', 'A2', 'A3', 'A4']

    for (const item of bank.items) {
      const keysUz = Object.keys(item.optionsUz)
      expect(keysUz).toHaveLength(4)
      expect(validKeys.every(k => keysUz.includes(k))).toBe(true)
      expect(validKeys.includes(item.correctAnswer)).toBe(true)
      expect(item.optionsUz[item.correctAnswer]).toBeTruthy()

      // No raw option markers left in question text
      expect(item.questionUz).not.toMatch(/(?<![\w\\∩∪\(])[ABCD]\)\s*$/)
    }
  })

  // Test against each golden fixture
  for (const [externalId, expectation] of Object.entries(GOLDEN_FIXTURES)) {
    it(`regression check: ${externalId}`, () => {
      const raw = fs.readFileSync(TARGET_PATH, 'utf8')
      const bank = JSON.parse(raw) as BankData
      const item = bank.items.find(it => it.externalId === externalId)

      expect(item, `Item ${externalId} must exist in bank`).toBeDefined()
      if (!item) return

      // Check correctAnswer
      expect(item.correctAnswer).toBe(expectation.correctAnswer)

      // Check image
      if (expectation.hasImage) {
        expect(item.image).toBeTruthy()
        expect(item.image).toMatch(/^\/math-print/)
      } else {
        expect(item.image).toBeNull()
      }

      // Check forbidden patterns in question
      for (const forbidden of expectation.forbiddenInQuestion) {
        expect(item.questionUz, `Forbidden "${forbidden}" found in question of ${externalId}`).not.toContain(forbidden)
      }

      // Check required patterns in question
      for (const required of expectation.requiredInQuestion) {
        expect(item.questionUz, `Required "${required}" missing from question of ${externalId}`).toContain(required)
      }

      // Check forbidden patterns in options
      for (const [key, optVal] of Object.entries(item.optionsUz)) {
        for (const forbidden of expectation.forbiddenInOptions) {
          expect(optVal, `Forbidden "${forbidden}" found in option ${key} of ${externalId}`).not.toContain(forbidden)
        }
      }

      // Check expected options
      for (const [key, expectedVal] of Object.entries(expectation.expectedOptions)) {
        const actualVal = item.optionsUz[key]
        expect(actualVal, `Missing option ${key} in ${externalId}`).toBeDefined()
        if (typeof expectedVal === 'string') {
          expect(actualVal).toContain(expectedVal)
        } else if (expectedVal instanceof RegExp) {
          expect(actualVal).toMatch(expectedVal)
        }
      }

      // KaTeX validity: must render without errors
      const segments = parseMathSegments(item.questionUz)
      for (const seg of segments) {
        if (seg.type === 'math') {
          const html = renderKaTeXToString(seg.content, seg.displayMode)
          expect(html, `KaTeX rendering failed for formula in ${externalId}: "${seg.content}"`).not.toBeNull()
        }
      }
    })
  }
})
