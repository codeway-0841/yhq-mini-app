import { describe, expect, it } from 'vitest'
import {
  FREE_LESSON,
  FREE_TOPIC_QUESTION_COUNT,
  decideTestAccess,
  isEffectivePremium,
  isPremiumTest,
  isTestModePremium,
  isTicketPremium,
  ticketQuestionCount,
} from '../../../shared/test-access'

describe('shared/test-access — free vs premium policy', () => {
  it('keeps the public test selector policy in one shared place', () => {
    expect(isPremiumTest({ type: 'random', count: 20 })).toBe(false)
    expect(isPremiumTest({ type: 'topic', topicId: 1 })).toBe(false)
    expect(isPremiumTest({ type: 'ticket', ticketNumber: 1 })).toBe(false)
    expect(isPremiumTest({ type: 'lesson', ...FREE_LESSON })).toBe(false)
    expect(isPremiumTest({ type: 'saved' })).toBe(false)
    expect(isPremiumTest({ type: 'mistakes' })).toBe(false)

    expect(isPremiumTest({ type: 'random', count: 50 })).toBe(true)
    expect(isPremiumTest({ type: 'random', count: 100 })).toBe(true)
    expect(isPremiumTest({ type: 'ticket', ticketNumber: 4 })).toBe(true)
    expect(isPremiumTest({ type: 'lesson', moduleId: FREE_LESSON.moduleId, lessonIndex: FREE_LESSON.lessonIndex + 1 })).toBe(true)
    expect(isPremiumTest({ type: 'module', moduleId: FREE_LESSON.moduleId })).toBe(true)
    expect(isPremiumTest({ type: 'mock' })).toBe(true)
    expect(isPremiumTest({ type: 'marathon' })).toBe(true)
    expect(isPremiumTest({ type: 'exam', presetId: 'attestatsiya' })).toBe(true)
  })

  it('treats lifetime tariff or active premium_until as effective premium', () => {
    const now = new Date('2026-09-09T10:00:00.000Z')
    expect(isEffectivePremium({ tariff: 'premium', premiumUntil: null }, now)).toBe(true)
    expect(isEffectivePremium({ tariff: 'free', premiumUntil: '2026-09-10T10:00:00.000Z' }, now)).toBe(true)
    expect(isEffectivePremium({ tariff: 'free', premiumUntil: '2026-09-08T10:00:00.000Z' }, now)).toBe(false)
    expect(isEffectivePremium({ tariff: 'free', premiumUntil: 'not-a-date' }, now)).toBe(false)
  })

  it('matches frontend mode IDs and ticket preview limits', () => {
    expect(isTestModePremium('random20')).toBe(false)
    expect(isTestModePremium('random50')).toBe(true)
    expect(isTestModePremium('random100')).toBe(true)
    expect(isTestModePremium('mock')).toBe(true)
    expect(isTestModePremium('marathon')).toBe(true)
    expect(isTestModePremium('exam:milliy-sertifikat')).toBe(true)

    expect(isTicketPremium(1)).toBe(false)
    expect(isTicketPremium(3)).toBe(false)
    expect(isTicketPremium(4)).toBe(true)

    expect(FREE_TOPIC_QUESTION_COUNT).toBe(10)
    expect(ticketQuestionCount('yhq')).toBe(20)
    expect(ticketQuestionCount('matematika')).toBe(30)
  })

  it('returns a stable reason for paid modes', () => {
    expect(decideTestAccess({ type: 'random', count: 100 })).toEqual({
      premiumRequired: true,
      reason: 'premium_mode',
    })
  })
})
