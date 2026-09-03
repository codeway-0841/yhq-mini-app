import { describe, expect, it } from 'vitest'
import {
  CONTENT_BANK_VERSION,
  parseContentBank,
  toAdminBulkImportPayload,
  toTopicSeedRows,
  type ContentBank,
} from '../../../shared/content-bank'

function validBank(): ContentBank {
  return {
    version: CONTENT_BANK_VERSION,
    subjectId: 'fizika',
    bankId: 'physics_db',
    bankName: 'Fizika savollar bazasi',
    topics: [
      { externalId: 'mechanics', slug: 'fizika-mechanics', nameUz: 'Mexanika', nameRu: 'Механика' },
    ],
    items: [
      {
        externalId: 'physics_mechanics_001',
        topicExternalId: 'mechanics',
        questionUz: 'Jism 5 m/s tezlik bilan 4 sekund harakatlandi. Masofa qancha?',
        questionRu: 'Тело двигалось со скоростью 5 м/с в течение 4 секунд. Какое расстояние?',
        optionsUz: { A1: '10 m', A2: '15 m', A3: '20 m', A4: '25 m' },
        optionsRu: { A1: '10 м', A2: '15 м', A3: '20 м', A4: '25 м' },
        correctAnswer: 'A3',
        explanationUz: 's = v × t = 5 × 4 = 20 m.',
        explanationRu: 's = v × t = 5 × 4 = 20 м.',
        difficulty: 'easy',
        source: '7-sinf fizika',
        image: null,
      },
    ],
  }
}

describe('content bank format', () => {
  it('validates a production content bank and exports admin payload', () => {
    const parsed = parseContentBank(validBank())

    expect(parsed.ok).toBe(true)
    expect(parsed.errors).toEqual([])
    expect(parsed.warnings).toEqual([])
    expect(parsed.data).toBeDefined()

    const topics = toTopicSeedRows(parsed.data!)
    expect(topics).toEqual([
      {
        externalId: 'mechanics',
        slug: 'fizika-mechanics',
        nameUz: 'Mexanika',
        nameRu: 'Механика',
        bankId: 'physics_db',
      },
    ])

    const payload = toAdminBulkImportPayload(parsed.data!, { mechanics: 42 })
    expect(payload).toEqual({
      subjectId: 'fizika',
      bankId: 'physics_db',
      items: [
        expect.objectContaining({
          questionUz: expect.stringContaining('5 m/s'),
          correctAnswer: 'A3',
          topicId: 42,
        }),
      ],
    })
  })

  it('rejects option-key drift and invalid correctAnswer', () => {
    const bank = validBank()
    bank.items[0] = {
      ...bank.items[0],
      optionsRu: { A1: '10 м', A2: '15 м', A4: '25 м' },
      correctAnswer: 'A3',
    }

    const parsed = parseContentBank(bank)

    expect(parsed.ok).toBe(false)
    expect(parsed.errors.join('\n')).toContain('optionsUz va optionsRu kalitlari bir xil')
    expect(parsed.errors.join('\n')).toContain('correctAnswer options ichidagi kalit')
  })

  it('rejects duplicate ids and unknown topic references', () => {
    const bank = validBank()
    bank.items.push({
      ...bank.items[0],
      topicExternalId: 'unknown-topic',
    })

    const parsed = parseContentBank(bank)

    expect(parsed.ok).toBe(false)
    expect(parsed.errors.join('\n')).toContain('Takror savol externalId')
    expect(parsed.errors.join('\n')).toContain('Noma’lum topicExternalId')
  })
})
