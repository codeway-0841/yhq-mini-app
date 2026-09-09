import type { CreateTestSessionInput } from './test-session'

export type TestAccessDecision = {
  premiumRequired: boolean
  reason: 'free' | 'premium_mode' | 'premium_ticket'
}

const FREE_TICKET_COUNT = 3
export const FREE_TOPIC_QUESTION_COUNT = 10
export const YHQ_TICKET_QUESTION_COUNT = 20
export const DEFAULT_TICKET_QUESTION_COUNT = 30

export function isEffectivePremium(input: {
  tariff?: 'free' | 'premium' | null
  premiumUntil?: string | Date | null
}, now: Date = new Date()): boolean {
  if (input.tariff === 'premium') return true
  if (!input.premiumUntil) return false
  const expires = input.premiumUntil instanceof Date
    ? input.premiumUntil
    : new Date(input.premiumUntil)
  return Number.isFinite(expires.getTime()) && expires > now
}

export function decideTestAccess(selector: CreateTestSessionInput['selector']): TestAccessDecision {
  if (selector.type === 'random') {
    return selector.count === 20
      ? { premiumRequired: false, reason: 'free' }
      : { premiumRequired: true, reason: 'premium_mode' }
  }
  if (selector.type === 'ticket') {
    return isTicketPremium(selector.ticketNumber)
      ? { premiumRequired: true, reason: 'premium_ticket' }
      : { premiumRequired: false, reason: 'free' }
  }
  if (selector.type === 'exam' || selector.type === 'mock') {
    return { premiumRequired: true, reason: 'premium_mode' }
  }
  return { premiumRequired: false, reason: 'free' }
}

export function isPremiumTest(selector: CreateTestSessionInput['selector']): boolean {
  return decideTestAccess(selector).premiumRequired
}

export function isTicketPremium(ticketNumber: number): boolean {
  return Number.isInteger(ticketNumber) && ticketNumber > FREE_TICKET_COUNT
}

export function ticketQuestionCount(subjectId: string): number {
  return subjectId === 'yhq' ? YHQ_TICKET_QUESTION_COUNT : DEFAULT_TICKET_QUESTION_COUNT
}

export function isTestModePremium(modeId: string): boolean {
  return modeId === 'random50'
    || modeId === 'random100'
    || modeId === 'mock'
    || modeId === 'marathon'
    || modeId.startsWith('exam:')
}
