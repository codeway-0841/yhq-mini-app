import { useMemo, useEffect, useRef } from 'react'
import { useTestSessionStore } from '../../../shared/store/useTestSessionStore'
import { makeSessionKey, isResumable } from '../../../shared/lib/test-session'
import { shuffleArray } from '../../../shared/lib/seeded'
import { resolveExamMode } from '../../../../shared/exam-presets'
import type { Question } from '../../../shared/api'

export interface UseTestSessionSaveParams {
  sessionKey:       string
  subjectId:        string
  mode:             string | null
  stateTitle?:      string
  activeQuestions:  Question[]
  current:          number
  answers?:         (string | null)[]
  selectedHistory?: (string | null)[]
  correctOpts?:     (string | null)[]
  cheatViolations?: number
  isFinished:       boolean
  locationKey:      string
  enabled?:         boolean
}

/**
 * Snapshot persistence hook: har javob yoki holat o'zgarganda
 * useTestSessionStore ga saqlaydi.
 */
export function useTestSessionSave(params: UseTestSessionSaveParams) {
  const {
    sessionKey,
    subjectId,
    mode,
    stateTitle,
    activeQuestions,
    current,
    answers,
    selectedHistory,
    correctOpts,
    cheatViolations,
    isFinished,
    locationKey,
    enabled = true,
  } = params

  const startedAtRef = useRef<number | null>(null)

  // Retry startedAt reset (audit HIGH-1)
  useEffect(() => {
    startedAtRef.current = null
  }, [locationKey])

  useEffect(() => {
    if (!enabled) return
    if (
      answers === undefined ||
      selectedHistory === undefined ||
      correctOpts === undefined
    ) {
      return
    }
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
  }, [enabled, activeQuestions, current, answers, selectedHistory, correctOpts, cheatViolations, isFinished, sessionKey, subjectId, mode, stateTitle])
}

interface UseTestSessionParams {
  mode:             string | null
  questionIds?:     number[]
  questions:        Question[]
  subjectId:        string
  stateTitle?:      string
  answers?:         (string | null)[]
  current?:         number
  isFinished?:      boolean
  locationKey:      string
  selectedHistory?: (string | null)[]
  correctOpts?:     (string | null)[]
  cheatViolations?: number
  shuffleOptions?:  boolean
}

export function useTestSession(params: UseTestSessionParams) {
  const {
    mode,
    questionIds,
    questions,
    subjectId,
    stateTitle,
    answers,
    current = 0,
    isFinished = false,
    locationKey,
    selectedHistory,
    correctOpts,
    cheatViolations,
    shuffleOptions = false,
  } = params

  const examPreset = resolveExamMode(mode)
  const sessionKey = makeSessionKey(mode, questionIds)

  // ── Resumable session — activeQuestions computation ──
  const activeQuestions = useMemo(() => {
    let result: Question[]
    const snap = useTestSessionStore.getState().session
    if (isResumable(snap, sessionKey, subjectId) && snap.questionIds.length) {
      const byId = new Map(questions.map((x) => [x.id, x]))
      const restored = snap.questionIds.map((qid) => byId.get(qid)).filter((x) => !!x)
      if (restored.length) {
        result = restored as typeof questions
      } else {
        result = questions
      }
    } else if (questionIds?.length) {
      const idSet = new Set(questionIds)
      result = questions.filter((q) => idSet.has(q.id))
    } else {
      const shuffled = () => [...questions].sort(() => Math.random() - 0.5)
      if (examPreset) {
        result = shuffled().slice(0, Math.min(examPreset.questionCount, questions.length))
      } else {
        switch (mode) {
          case 'marathon':  result = shuffled(); break
          case 'exam':      result = shuffled().slice(0, Math.min(40, questions.length)); break
          case 'mock':      result = shuffled().slice(0, Math.min(20, questions.length)); break
          case 'random50':  result = shuffled().slice(0, Math.min(50, questions.length)); break
          case 'random100': result = shuffled().slice(0, Math.min(100, questions.length)); break
          case 'random20':  result = shuffled().slice(0, Math.min(20, questions.length)); break
          case 'tricky':   result = shuffled().slice(0, Math.min(30, questions.length)); break
          case 'numeric': {
            const numeric = questions.filter((q) => /\d/.test(q.text))
            result = numeric.length > 0 ? numeric : questions
            break
          }
          default:         result = questions
        }
      }
    }

    if (!shuffleOptions) return result
    return result.map((q) => ({
      ...q,
      options: shuffleArray(q.options),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- locationKey QASDDAN: yangi aralashtirish trigger'i
  }, [questionIds, mode, questions, locationKey, sessionKey, subjectId, examPreset, shuffleOptions])

  // Backward compatibility: hook har doim unconditional chaqiriladi,
  // guard mantiqi hook ichidagi effect'da bajariladi (Rules of Hooks).
  useTestSessionSave({
    sessionKey,
    subjectId,
    mode,
    stateTitle,
    activeQuestions,
    current,
    answers,
    selectedHistory,
    correctOpts,
    cheatViolations,
    isFinished,
    locationKey,
    enabled: answers !== undefined && selectedHistory !== undefined && correctOpts !== undefined,
  })

  return {
    activeQuestions,
    sessionKey,
  }
}
