import { useLocation } from 'react-router-dom'
import { config } from '../../shared/config'
import { resolveExamMode, type ExamPresetId } from '../../../shared/exam-presets'
import type { CreateTestSessionInput } from '../../../shared/test-session'
import ServerPracticePage from './ServerPracticePage'
import TestPage from './TestPage'
import type { ServerPracticeMode } from '../../shared/store/useServerTestSessionStore'

function topicSelector(value: unknown): CreateTestSessionInput['selector'] | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { type?: unknown; topicId?: unknown }
  if (candidate.type !== 'topic' || typeof candidate.topicId !== 'number') return null
  if (!Number.isInteger(candidate.topicId) || candidate.topicId <= 0) return null
  return { type: 'topic', topicId: candidate.topicId }
}

function ticketSelector(value: unknown): CreateTestSessionInput['selector'] | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { type?: unknown; ticketNumber?: unknown }
  if (candidate.type !== 'ticket' || typeof candidate.ticketNumber !== 'number') return null
  if (!Number.isInteger(candidate.ticketNumber) || candidate.ticketNumber <= 0) return null
  return { type: 'ticket', ticketNumber: candidate.ticketNumber }
}

function singleSelector(value: unknown): CreateTestSessionInput['selector'] | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { type?: unknown; launchToken?: unknown }
  if (candidate.type !== 'single' || typeof candidate.launchToken !== 'string') return null
  if (candidate.launchToken.length < 16) return null
  return { type: 'single', launchToken: candidate.launchToken }
}

function mistakesSelector(value: unknown): CreateTestSessionInput['selector'] | null {
  if (value === 'mistakes') return { type: 'mistakes' }
  if (!value || typeof value !== 'object') return null
  const candidate = value as { type?: unknown; topicId?: unknown }
  if (candidate.type !== 'mistakes') return null
  if (candidate.topicId !== undefined && (!Number.isInteger(candidate.topicId) || (candidate.topicId as number) <= 0)) {
    return null
  }
  return { type: 'mistakes', ...(candidate.topicId !== undefined ? { topicId: candidate.topicId as number } : {}) }
}

function serverPracticeProps(state: unknown): {
  mode: ServerPracticeMode
  selector?: CreateTestSessionInput['selector']
  title?: string
} | null {
  if (!state || typeof state !== 'object') return null
  const s = state as { mode?: unknown; title?: unknown; serverSelector?: unknown }
  const mode = typeof s.mode === 'string' ? s.mode : null
  const title = typeof s.title === 'string' ? s.title : undefined

  if (s.serverSelector === 'saved') return { mode: 'saved', selector: { type: 'saved' }, title }

  const mistakes = mistakesSelector(s.serverSelector)
  if (mistakes) return { mode: 'mistakes', selector: mistakes, title }

  const single = singleSelector(s.serverSelector)
  if (single) return { mode: 'single', selector: single, title }

  const topic = topicSelector(s.serverSelector)
  if (topic) return { mode: 'topic', selector: topic, title }

  const ticket = ticketSelector(s.serverSelector)
  if (ticket) return { mode: 'ticket', selector: ticket, title }

  if (mode === 'random20' || mode === 'random50' || mode === 'random100') {
    return { mode, title }
  }
  if (mode === 'mock') return { mode: 'mock', selector: { type: 'mock' }, title }

  const exam = resolveExamMode(mode)
  if (exam) {
    return { mode: 'exam', selector: { type: 'exam', presetId: exam.id as ExamPresetId }, title }
  }

  return null
}

export default function TestRoutePage() {
  const location = useLocation()
  const props = config.testSessionsV2Enabled ? serverPracticeProps(location.state) : null
  return props ? <ServerPracticePage {...props} /> : <TestPage />
}
