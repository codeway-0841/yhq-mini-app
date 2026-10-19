import { describe, expect, it } from 'vitest'
import {
  DarslikRegenerationInputError,
  DarslikTopicNotFoundError,
  resolveDarslikRegenerationTopics,
} from '../../../server/modules/darslik/regenerate'

describe('resolveDarslikRegenerationTopics — admin/CLI regeneratsiya tanlovi', () => {
  it('blockId bo‘yicha blokning barcha mavzularini beradi', () => {
    const topics = resolveDarslikRegenerationTopics({ blockId: 1 })
    expect(topics).toHaveLength(12)
    expect(topics[0]).toBe('1:0')
    expect(topics[11]).toBe('1:11')
    expect(topics.every(topicId => topicId.startsWith('1:'))).toBe(true)
  })

  it('takroriy topicIdlarni dedupe qiladi', () => {
    expect(resolveDarslikRegenerationTopics({ topicIds: ['1:0', '1:0', '1:1'] }))
      .toEqual(['1:0', '1:1'])
  })

  it('topicIds va blockId birga bo‘lsa rad etadi', () => {
    expect(() => resolveDarslikRegenerationTopics({ topicIds: ['1:0'], blockId: 1 }))
      .toThrow(DarslikRegenerationInputError)
  })

  it('bo‘sh tanlovni rad etadi', () => {
    expect(() => resolveDarslikRegenerationTopics({})).toThrow(DarslikRegenerationInputError)
    expect(() => resolveDarslikRegenerationTopics({ topicIds: [] })).toThrow(DarslikRegenerationInputError)
  })

  it('noma’lum mavzuni aniq xato bilan qaytaradi', () => {
    expect(() => resolveDarslikRegenerationTopics({ topicIds: ['1:0', '99:0'] }))
      .toThrow(DarslikTopicNotFoundError)
    try {
      resolveDarslikRegenerationTopics({ topicIds: ['99:0'] })
    } catch (error) {
      expect(error).toBeInstanceOf(DarslikTopicNotFoundError)
      expect((error as DarslikTopicNotFoundError).topicIds).toEqual(['99:0'])
    }
  })
})
