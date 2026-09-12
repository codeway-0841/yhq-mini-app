import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, RotateCcw, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type {
  CreateTestSessionInput,
  DeliveredTestQuestion,
  TestSessionResponse,
} from '../../../shared/test-session'
import { api, ApiError } from '../../shared/api'
import { Button } from '../../shared/components/ui/button'
import MathText from '../../shared/components/MathText'
import { goBack } from '../../shared/lib/navigation'
import { todayStr } from '../../shared/store/useDailyStore'
import { useAppStore } from '../../shared/store/useAppStore'
import {
  useServerTestSessionStore,
  type ServerPracticeMode,
  type ServerTestSnapshot,
} from '../../shared/store/useServerTestSessionStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import OptionButton from './OptionButton'
import QuestionStrip from './QuestionStrip'
import { formatImageSrc } from './hooks/useImagePreload'
import { useTimer } from './useTimer'
import { useSwipeNavigation } from '../../shared/hooks/useSwipeNavigation'

const bootInflight = new Map<string, Promise<TestSessionResponse>>()

function mergeQuestions(
  existing: DeliveredTestQuestion[], incoming: DeliveredTestQuestion[],
): DeliveredTestQuestion[] {
  const byPosition = new Map(existing.map((question) => [question.position, question]))
  for (const question of incoming) byPosition.set(question.position, question)
  return [...byPosition.values()].sort((a, b) => a.position - b.position)
}

function clientToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function firstAvailable(snapshot: ServerTestSnapshot): number {
  const available = new Set(snapshot.questions.map((question) => question.position))
  for (let position = 0; position < snapshot.total; position += 1) {
    if (snapshot.answers[position] === null && available.has(position)) return position
  }
  return Math.min(snapshot.current, snapshot.total - 1)
}

function hydrate(
  response: TestSessionResponse,
  existing: ServerTestSnapshot | null,
  subjectId: string,
  mode: ServerPracticeMode,
  selectorKey: string,
): ServerTestSnapshot {
  const total = response.session.total
  const answers = existing?.answers.length === total ? [...existing.answers] : Array(total).fill(null)
  const selected = existing?.selected.length === total ? [...existing.selected] : Array(total).fill(null)
  const correctOptions = existing?.correctOptions.length === total ? [...existing.correctOptions] : Array(total).fill(null)
  const pendingTokens = { ...(existing?.pendingTokens ?? {}) }
  for (const item of response.review) {
    answers[item.position] = item.correct ? 'correct' : 'wrong'
    selected[item.position] = item.selectedOptionId
    correctOptions[item.position] = item.correctOptionId
    delete pendingTokens[item.position]
  }
  const snapshot: ServerTestSnapshot = {
    sessionId: response.session.id,
    subjectId,
    mode,
    selectorKey,
    total,
    expiresAt: response.session.expiresAt,
    current: existing?.current ?? 0,
    questions: mergeQuestions(existing?.questions ?? [], response.questions),
    answers,
    selected,
    correctOptions,
    pendingTokens,
  }
  snapshot.current = firstAvailable(snapshot)
  return snapshot
}

function selectorForMode(mode: ServerPracticeMode): CreateTestSessionInput['selector'] {
  if (mode === 'saved') return { type: 'saved' }
  if (mode === 'mistakes') return { type: 'mistakes' }
  if (mode === 'mock') return { type: 'mock' }
  if (mode === 'marathon') return { type: 'marathon' }
  if (mode === 'topic') throw new Error('topic_selector_required')
  if (mode === 'ticket') throw new Error('ticket_selector_required')
  if (mode === 'lesson') throw new Error('lesson_selector_required')
  if (mode === 'module') throw new Error('module_selector_required')
  if (mode === 'exam') throw new Error('exam_selector_required')
  return {
    type: 'random',
    count: mode === 'random20' ? 20 : mode === 'random50' ? 50 : 100,
  }
}

function secondsUntil(expiresAt?: string): number {
  return expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : 0
}

interface ServerPracticePageProps {
  mode: ServerPracticeMode
  selector?: CreateTestSessionInput['selector']
  title?: string
}

export default function ServerPracticePage({ mode, selector: selectorProp, title }: ServerPracticePageProps) {
  const navigate = useNavigate()
  const subjectId = useSubjectStore((state) => state.subjectId)
  const settings = useAppStore((state) => state.settings)
  const userId = useAppStore((state) => state.user?.id)
  const applySessionAnswer = useAppStore((state) => state.applySessionAnswerMutation)
  const persisted = useServerTestSessionStore((state) => state.snapshot)
  const selector = useMemo(() => selectorProp ?? selectorForMode(mode), [mode, selectorProp])
  const selectorKey = useMemo(() => JSON.stringify(selector), [selector])
  const [snapshot, setSnapshot] = useState<ServerTestSnapshot | null>(() =>
    persisted?.subjectId === subjectId && persisted.mode === mode
      && persisted.selectorKey === selectorKey ? persisted : null,
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionInvalid, setSessionInvalid] = useState(false)
  const [finished, setFinished] = useState(() => Boolean(snapshot?.answers.every(Boolean)))
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)
  const isRu = settings.language === 'ru'

  const persist = useCallback((next: ServerTestSnapshot) => {
    setSnapshot(next)
    useServerTestSessionStore.getState().save(next)
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true
    const saved = useServerTestSessionStore.getState().snapshot
    const reusable = saved?.subjectId === subjectId && saved.mode === mode
      && saved.selectorKey === selectorKey ? saved : null
    if (reusable?.answers.every(Boolean)) {
      setSnapshot(reusable)
      setFinished(true)
      setLoading(false)
      return
    }

    const key = reusable ? `resume:${reusable.sessionId}` : `create:${userId}:${subjectId}:${mode}`
    let hydrateFrom = reusable
    let request = bootInflight.get(key)
    if (!request) {
      request = reusable
        ? api.resumeTestSession(reusable.sessionId)
        : api.createTestSession({ subjectId, selector, language: settings.language })
      bootInflight.set(key, request)
      void request.finally(() => bootInflight.delete(key)).catch(() => undefined)
    }
    void request
      .catch(async (cause) => {
        if (!active) throw cause
        if (reusable && cause instanceof ApiError && [404, 409, 410].includes(cause.status)) {
          useServerTestSessionStore.getState().clear()
          hydrateFrom = null
          return api.createTestSession({ subjectId, selector, language: settings.language })
        }
        throw cause
      })
      .then((response) => {
        if (!active) return
        const next = hydrate(response, hydrateFrom, subjectId, mode, selectorKey)
        persist(next)
        setFinished(next.answers.every(Boolean))
        setError(null)
      })
      .catch((cause) => {
        if (!active) return
        if (cause instanceof ApiError && cause.code === 'premium_required') {
          navigate('/premium', { replace: true })
          return
        }
        setError(isRu ? 'Тест не загрузился. Повторите попытку.' : 'Test yuklanmadi. Qayta urinib ko‘ring.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [isRu, mode, navigate, persist, selector, selectorKey, settings.language, subjectId, userId])

  const question = useMemo(() =>
    snapshot?.questions.find((item) => item.position === snapshot.current),
  [snapshot])

  const submit = useCallback(async (optionId: string) => {
    if (!snapshot || !question || submitting || snapshot.answers[question.position] !== null) return
    const position = question.position
    const token = snapshot.pendingTokens[position] ?? clientToken()
    const optimistic: ServerTestSnapshot = {
      ...snapshot,
      selected: snapshot.selected.map((value, index) => index === position ? optionId : value),
      pendingTokens: { ...snapshot.pendingTokens, [position]: token },
    }
    persist(optimistic)
    setSubmitting(true)
    setError(null)
    try {
      const response = await api.submitTestSessionAnswer(snapshot.sessionId, {
        position,
        deliveryToken: question.deliveryToken,
        expiresAt: question.expiresAt,
        selectedOptionId: optionId,
        clientToken: token,
      })
      const answers = [...optimistic.answers]
      const selected = [...optimistic.selected]
      const correctOptions = [...optimistic.correctOptions]
      answers[position] = response.attempt.correct ? 'correct' : 'wrong'
      selected[position] = optionId
      correctOptions[position] = response.attempt.correctOptionId
      const pendingTokens = { ...optimistic.pendingTokens }
      delete pendingTokens[position]
      const next: ServerTestSnapshot = {
        ...optimistic,
        total: response.session.total,
        questions: mergeQuestions(optimistic.questions, response.append),
        answers,
        selected,
        correctOptions,
        pendingTokens,
      }
      next.current = firstAvailable(next)
      persist(next)
      if (!response.attempt.duplicate) {
        applySessionAnswer({
          correct: response.attempt.correct,
          subjectId,
          date: todayStr(),
          dailyStreak: response.attempt.dailyStreak,
          coinSaved: response.attempt.coinSaved,
          coinBalance: response.attempt.coinBalance,
          xp: response.attempt.xp,
        })
      }
      if (response.session.status === 'completed' || next.answers.every(Boolean)) setFinished(true)
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'test_session_bank_changed') {
        setSessionInvalid(true)
        setError(isRu
          ? 'База вопросов обновилась. Начните новый тест.'
          : 'Savollar bazasi yangilandi. Yangi test boshlang.')
      } else {
        setError(isRu
          ? 'Ответ не подтверждён. Нажмите «Повторить» — токен останется тем же.'
          : 'Javob tasdiqlanmadi. “Qayta yuborish”ni bosing — token o‘zgarmaydi.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [applySessionAnswer, isRu, persist, question, snapshot, subjectId, submitting])

  const finish = useCallback(async () => {
    if (!snapshot) return
    await api.finishTestSession(snapshot.sessionId, 'completed').catch(() => undefined)
    setFinished(true)
  }, [snapshot])

  const handleTimeUp = useCallback(() => {
    if (!snapshot || finished) return
    void api.finishTestSession(snapshot.sessionId, 'completed').catch(() => undefined)
    setFinished(true)
  }, [finished, snapshot])

  const initialSeconds = useMemo(() => secondsUntil(snapshot?.expiresAt), [snapshot?.expiresAt])
  const timer = useTimer(handleTimeUp, snapshot?.sessionId ?? 'loading', initialSeconds)

  const retryTest = useCallback(async () => {
    if (snapshot) await api.finishTestSession(snapshot.sessionId, 'abandoned').catch(() => undefined)
    useServerTestSessionStore.getState().clear()
    setSnapshot(null)
    setFinished(false)
    setSessionInvalid(false)
    setError(null)
    setLoading(true)
    const response = await api.createTestSession({
      subjectId, selector, language: settings.language,
    })
    const next = hydrate(response, null, subjectId, mode, selectorKey)
    persist(next)
    setLoading(false)
  }, [mode, persist, selector, selectorKey, settings.language, snapshot, subjectId])

  const canSwipeLeft = snapshot ? snapshot.current < snapshot.total - 1 : false
  const canSwipeRight = snapshot ? snapshot.current > 0 : false

  const { touchHandlers, dragOffset, isSwiping } = useSwipeNavigation({
    onSwipeLeft: () => {
      if (!snapshot || !canSwipeLeft) return
      const next = snapshot.current + 1
      if (snapshot.questions.some((item) => item.position === next)) {
        setSlideDirection('left')
        persist({ ...snapshot, current: next })
      }
    },
    onSwipeRight: () => {
      if (!snapshot || !canSwipeRight) return
      const prev = snapshot.current - 1
      if (snapshot.questions.some((item) => item.position === prev)) {
        setSlideDirection('right')
        persist({ ...snapshot, current: prev })
      }
    },
    canSwipeLeft,
    canSwipeRight,
    enabled: settings.swipeToNavigate !== false && !finished && !loading && Boolean(snapshot),
  })

  if (loading || !snapshot || !question) {
    return (
      <div className="flex min-h-[70svh] flex-col items-center justify-center gap-3 px-6 text-center text-pmuted">
        {error ? <AlertTriangle className="text-pdanger" /> : <div className="size-9 animate-spin rounded-full border-2 border-pprimary border-t-transparent" />}
        <p className="text-sm font-semibold">{error ?? (isRu ? 'Загрузка теста…' : 'Test yuklanmoqda…')}</p>
        {error && <Button onClick={() => window.location.reload()}>{isRu ? 'Повторить' : 'Qayta urinish'}</Button>}
      </div>
    )
  }

  const position = question.position
  const selected = snapshot.selected[position]
  const correctOption = snapshot.correctOptions[position]
  const answer = snapshot.answers[position]
  const answeredCount = snapshot.answers.filter(Boolean).length
  const correctCount = snapshot.answers.filter((item) => item === 'correct').length

  const optionState = (optionId: string): 'correct' | 'wrong' | 'pending' | 'default' => {
    if (correctOption) {
      if (optionId === correctOption) return 'correct'
      if (optionId === selected) return 'wrong'
    }
    if (selected === optionId && answer === null) return 'pending'
    return 'default'
  }

  if (finished) {
    return (
      <div className="mx-auto flex min-h-[75svh] max-w-lg flex-col items-center justify-center gap-5 px-5 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-pwash text-pprimary"><Check size={30} /></div>
        <div>
          <h1 className="font-display text-2xl font-bold text-pfg">{isRu ? 'Тест завершён' : 'Test yakunlandi'}</h1>
          <p className="mt-2 text-pmuted">{correctCount} / {snapshot.total} {isRu ? 'правильных ответов' : 'to‘g‘ri javob'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => goBack(navigate)}><ChevronLeft size={17} />{isRu ? 'Назад' : 'Orqaga'}</Button>
          <Button onClick={() => void retryTest()}><RotateCcw size={17} />{isRu ? 'Ещё раз' : 'Qayta ishlash'}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100svh] flex-col bg-pcanvas">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] border-b border-pline bg-pcanvas pt-[var(--safe-top,0px)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
          <Button variant="secondary" size="icon" onClick={() => goBack(navigate)} aria-label={isRu ? 'Назад' : 'Orqaga'}><ChevronLeft /></Button>
          <div className="text-center">
            <p className="text-sm font-semibold text-pfg">
              {title ?? (mode === 'saved' || mode === 'mistakes'
                ? (mode === 'saved'
                    ? (isRu ? 'Сохранённые' : 'Saqlanganlar')
                    : (isRu ? 'Работа над ошибками' : 'Xatolarni tuzatish'))
                : (isRu ? `Практика · ${snapshot.total}` : `Mashq · ${snapshot.total}`))}
            </p>
            <p className="flex items-center justify-center gap-1 text-xs text-pmuted"><Timer size={12} />{timer} · {answeredCount}/{snapshot.total}</p>
          </div>
          <Button variant="ghost" onClick={() => void finish()}>{isRu ? 'Завершить' : 'Yakunlash'}</Button>
        </div>
      </header>

      {error && <div role="alert" className="mx-auto mt-3 flex max-w-2xl items-center gap-2 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-4 py-3 text-sm text-pdanger"><AlertTriangle size={16} />{error}</div>}
      <QuestionStrip
        total={snapshot.total}
        current={position}
        answers={snapshot.answers}
        onSelect={(next) => {
          if (snapshot.questions.some((item) => item.position === next)) {
            setSlideDirection(next > position ? 'left' : next < position ? 'right' : null)
            persist({ ...snapshot, current: next })
          }
        }}
      />

      <main
        className="flex-1 px-4 pb-28 pt-4 touch-pan-y overflow-x-hidden"
        {...touchHandlers}
      >
        <div
          key={position}
          style={isSwiping ? { transform: `translate3d(${dragOffset}px, 0, 0)`, transition: 'none' } : undefined}
          className={`mx-auto max-w-2xl ${
            !settings?.noAnimation && !isSwiping
              ? (slideDirection === 'left' ? 'animate-slide-in-right' : slideDirection === 'right' ? 'animate-slide-in-left' : '')
              : ''
          }`}
        >
          <p className="mb-2 text-xs font-medium text-pmuted">{position + 1} / {snapshot.total}</p>
          <MathText as="p" text={question.text} className="mb-5 text-left font-display text-[18px] font-semibold leading-relaxed text-pfg" />
          {question.media && <img src={formatImageSrc(question.media)} alt="" className="mb-5 max-h-72 w-full rounded-2xl bg-psurface object-contain" />}
          {question.options.map((option, index) => (
            <OptionButton
              key={`${position}:${option.id}`}
              option={option}
              indexLabel={String.fromCharCode(65 + index)}
              state={optionState(option.id)}
              onSelect={() => void submit(option.id)}
              answered={selected !== null || submitting}
            />
          ))}
          {error && sessionInvalid && (
            <Button block onClick={() => void retryTest()} disabled={submitting}>
              <RotateCcw size={17} />{isRu ? 'Новый тест' : 'Yangi test'}
            </Button>
          )}
          {error && !sessionInvalid && selected && answer === null && (
            <Button block onClick={() => void submit(selected)} disabled={submitting}>
              <RotateCcw size={17} />{isRu ? 'Повторить отправку' : 'Qayta yuborish'}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
