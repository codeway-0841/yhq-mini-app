import { useMemo, useEffect, useRef } from 'react'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { makeSessionKey, isResumable } from '../../../shared/lib/test-session'
import { resolveExamMode } from '../../../../shared/exam-presets'
import type { Question } from '../../../shared/api'

interface UseTestSessionParams {
  mode: string | null
  questionIds?: number[]
  questions: Question[]
  subjectId: string
  stateTitle?: string
  answers: (string | null)[]
  current: number
  isFinished: boolean
  locationKey: string
  selectedHistory: (string | null)[]
  correctOpts: (string | null)[]
  cheatViolations?: number
}

export function useTestSession(params: UseTestSessionParams) {
  const {
    mode,
    questionIds,
    questions,
    subjectId,
    stateTitle,
    answers,
    current,
    isFinished,
    locationKey,
    selectedHistory,
    correctOpts,
    cheatViolations,
  } = params

  const examPreset = resolveExamMode(mode)
  const sessionKey = makeSessionKey(mode, questionIds)
  const startedAtRef = useRef<number | null>(null)

  // ── Resumable session — activeQuestions computation ──
  const activeQuestions = useMemo(() => {
    // RESUME: saqlangan sessiya savollarining ASL tartibi qayta yig'iladi
    // (yangi shuffle EMAS — javoblar indeks bo'yicha bog'langan)
    const snap = useTestSessionStore.getState().session
    if (isResumable(snap, sessionKey, subjectId) && snap.questionIds.length) {
      const byId = new Map(questions.map((x) => [x.id, x]))
      const restored = snap.questionIds.map((qid) => byId.get(qid)).filter((x) => !!x)
      if (restored.length) return restored as typeof questions
    }
    if (questionIds?.length) {
      const idSet = new Set(questionIds)
      return questions.filter((q) => idSet.has(q.id))
    }
    const shuffled = () => [...questions].sort(() => Math.random() - 0.5)
    // Rasmiy imtihon preset'i (milliy-sertifikat 45, attestatsiya 50)
    if (examPreset) return shuffled().slice(0, Math.min(examPreset.questionCount, questions.length))
    switch (mode) {
      case 'marathon':  return shuffled()
      case 'exam':      return shuffled().slice(0, Math.min(40, questions.length))
      case 'mock':      return shuffled().slice(0, Math.min(20, questions.length)) // Mock imtihon — bilet formatida
      case 'random50':  return shuffled().slice(0, Math.min(50, questions.length))
      case 'random100': return shuffled().slice(0, Math.min(100, questions.length))
      case 'random20':  return shuffled().slice(0, Math.min(20, questions.length))
      case 'tricky':   return shuffled().slice(0, Math.min(30, questions.length))
      case 'numeric': {
        const numeric = questions.filter((q) => /\d/.test(q.text))
        return numeric.length > 0 ? numeric : questions
      }
      default:         return questions
    }
  }, [questionIds, mode, questions, locationKey, sessionKey, subjectId, examPreset])

  // ── Session save — snapshot persistence ──
  useEffect(() => {
    if (!activeQuestions.length) return
    const store = useTestSessionStore.getState()
    const existing = store.session
    if (startedAtRef.current == null) {
      startedAtRef.current = isResumable(existing, sessionKey, subjectId) ? existing.startedAt : Date.now()
    }
    store.save({
      key:             sessionKey,
      subjectId,
      mode,
      title:           stateTitle,
      questionIds:     activeQuestions.map((x) => x.id),
      current,
      answers,
      selected:        selectedHistory,
      correctOptions:  correctOpts,
      cheatViolations,
      startedAt:       startedAtRef.current,
      finished:        isFinished,
    })
  }, [activeQuestions, current, answers, selectedHistory, correctOpts, cheatViolations, isFinished, sessionKey, subjectId, mode, stateTitle])

  return {
    activeQuestions,
    sessionKey,
  }
}
