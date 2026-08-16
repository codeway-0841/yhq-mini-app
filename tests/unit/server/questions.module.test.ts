import { describe, it, expect } from 'vitest'
import { getProvider } from '../../../server/providers'
import { DefaultQuestionBankProvider } from '../../../server/providers/default.provider'
import { RussianQuestionBankProvider } from '../../../server/providers/russian.provider'

describe('server/modules/questions & providers - REAL Module Tests', () => {
  it('getProvider returns default provider for traffic_rules_db', () => {
    const provider = getProvider('traffic_rules_db')
    expect(provider).toBeInstanceOf(DefaultQuestionBankProvider)
    expect((provider as any).sourceId).toBe('traffic_rules_db')
  })

  it('getProvider returns specialized provider for russian_db', () => {
    const provider = getProvider('russian_db')
    expect(provider).toBeInstanceOf(RussianQuestionBankProvider)
    expect((provider as any).sourceId).toBe('russian_db')
  })

  it('getProvider dynamically instantiates DefaultQuestionBankProvider for new data source IDs', () => {
    const provider = getProvider('fizika_db')
    expect(provider).toBeInstanceOf(DefaultQuestionBankProvider)
    expect((provider as any).sourceId).toBe('fizika_db')
  })
})
