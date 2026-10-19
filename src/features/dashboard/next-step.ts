import { makeSessionKey, type TestSessionSnapshot } from '../../shared/lib/test-session'

/** Recreate the original route key, not the shuffled snapshot order. */
export function resumeRouteState(session: TestSessionSnapshot | null, subjectId: string) {
  if (!session || session.finished || session.subjectId !== subjectId || !session.questionIds.length) return null
  const questionIds = session.key.startsWith('ids:')
    ? session.key.slice(4).split(',').map(Number)
    : undefined
  if (questionIds?.some((id) => !Number.isInteger(id) || id <= 0)) return null
  if (makeSessionKey(session.mode, questionIds) !== session.key) return null
  return { mode: session.mode, questionIds, title: session.title }
}

export type DailyPlanKind = 'resume' | 'mistakes' | 'review' | 'topic' | 'completed' | 'explore'

export interface DailyPlanDecision {
  kind: DailyPlanKind
  itemCount: number
  estimatedMinutes: number
}

/**
 * Dashboarddagi yagona primary action prioriteti.
 * Tugallanmagan ish yo'qolmaydi; keyin ochiq xato, muddatli takrorlash va
 * yangi mavzu keladi. Sonlar UI uchun ataylab kichik sessiyaga bounded.
 */
export function selectDailyPlan(input: {
  remainingSessionItems: number
  unresolvedMistakes: number
  dueReviews: number
  hasCurrentTopic: boolean
  allTopicsComplete: boolean
}): DailyPlanDecision {
  const remaining = Math.max(0, input.remainingSessionItems)
  const mistakes = Math.max(0, input.unresolvedMistakes)
  const due = Math.max(0, input.dueReviews)
  if (remaining > 0) {
    const itemCount = Math.min(20, remaining)
    return { kind: 'resume', itemCount, estimatedMinutes: Math.max(3, Math.ceil(itemCount * 0.8)) }
  }
  if (mistakes > 0) {
    const itemCount = Math.min(10, mistakes)
    return { kind: 'mistakes', itemCount, estimatedMinutes: Math.max(3, Math.ceil(itemCount * 1.2)) }
  }
  if (due > 0) {
    const itemCount = Math.min(15, due)
    return { kind: 'review', itemCount, estimatedMinutes: Math.max(3, Math.ceil(itemCount * 0.8)) }
  }
  if (input.hasCurrentTopic) return { kind: 'topic', itemCount: 10, estimatedMinutes: 10 }
  if (input.allTopicsComplete) return { kind: 'completed', itemCount: 10, estimatedMinutes: 8 }
  return { kind: 'explore', itemCount: 10, estimatedMinutes: 10 }
}
