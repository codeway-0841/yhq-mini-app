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
