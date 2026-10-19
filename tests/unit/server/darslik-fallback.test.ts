import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import source from '../../../server/modules/darslik/source.json'
import { buildFallbackCheck } from '../../../server/modules/darslik/fallback-check'
import {
  DarslikCheckSchema,
  gradeDarslikCheck,
  publicDarslikCheck,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'

const topics = source as Record<string, { title: string; source: string }>

function answersFor(check: DarslikCheck): Record<string, string> {
  return Object.fromEntries(check.questions.map((question) => [
    question.id,
    question.kind === 'mcq' ? String(question.correctIndex) : question.answers[0],
  ]))
}

describe('darslik fallback check — AI mavjud bo‘lmaganda', () => {
  it('barcha 537 mavzu uchun yaroqli 2 test + 1 topshiriq yasaydi', () => {
    let built = 0
    for (const topic of Object.values(topics)) {
      const check = buildFallbackCheck(topic, topics)
      expect(check, topic.title).not.toBeNull()
      const parsed = DarslikCheckSchema.safeParse(check)
      expect(parsed.success, topic.title).toBe(true)
      const value = parsed.success ? parsed.data : null
      if (!value) continue

      expect(value.questions).toHaveLength(3)
      expect(value.questions.filter((question) => question.kind === 'mcq')).toHaveLength(2)
      expect(value.questions.filter((question) => question.kind === 'input')).toHaveLength(1)
      for (const question of value.questions) {
        if (question.kind === 'mcq') {
          expect(question.options).toHaveLength(4)
          expect(new Set(question.options).size).toBe(4)
          expect(question.correctIndex).toBeGreaterThanOrEqual(0)
          expect(question.correctIndex).toBeLessThan(4)
        } else {
          expect(question.answers.length).toBeGreaterThan(0)
        }
      }

      // Test o'z kaliti bilan albatta o'tadi.
      expect(gradeDarslikCheck(value, answersFor(value)).passed, topic.title).toBe(true)

      // Public payload javoblar/izohlarni oshkor qilmaydi.
      const publicValue = publicDarslikCheck(value)
      expect(JSON.stringify(publicValue)).not.toContain('correctIndex')
      expect(JSON.stringify(publicValue)).not.toContain('explanation')
      built++
    }
    expect(built).toBe(537)
  })

  it('deterministik — bir xil mavzu bir xil test beradi', () => {
    const topic = topics['1:1']
    const first = buildFallbackCheck(topic, topics)
    const second = buildFallbackCheck(topic, topics)
    expect(first).toEqual(second)
  })

  it('juda qisqa mavzu uchun ham ishlaydi', () => {
    const synthetic = { title: 'Проверочная тема', source: '# 1. Проверочная тема\n\nЭто короткая тема.' }
    const check = buildFallbackCheck(synthetic, { ...topics, '99:0': synthetic })
    expect(check).not.toBeNull()
    expect(check?.questions).toHaveLength(3)
    expect(DarslikCheckSchema.safeParse(check).success).toBe(true)
  })

  it('manba fayli bilan sinxron (537 mavzu)', () => {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'server/modules/darslik/source.json'), 'utf8')) as Record<string, unknown>
    expect(Object.keys(raw)).toHaveLength(537)
  })
})
