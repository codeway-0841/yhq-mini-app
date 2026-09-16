import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, BarChart2, Bookmark, Check, ChevronLeft, RotateCcw, Square, Timer, Volume2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type {
  CreateTestSessionInput,
  DeliveredTestQuestion,
  TestSessionResponse,
} from '../../../shared/test-session'
import { api, ApiError } from '../../shared/api'
import { Button } from '../../shared/components/ui/button'
import { CoinIcon } from '../../shared/components/CoinIcon'
import { ConfirmDialog } from '../../shared/components/ui/dialog'
import ImageZoomModal from '../../shared/components/ImageZoomModal'
import MathText from '../../shared/components/MathText'
import { goBack } from '../../shared/lib/navigation'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { isSpeaking, speak, stopSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { todayStr } from '../../shared/store/useDailyStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import {
  useServerTestSessionStore,
  type ServerPracticeMode,
  type ServerTestSnapshot,
} from '../../shared/store/useServerTestSessionStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import OptionButton from './OptionButton'
import QuestionStrip from './QuestionStrip'
import ResultsModal from './ResultsModal'
import AiTutorModal from './components/AiTutorModal'
import ExamReviewModal, { type ExamReviewItem } from './components/ExamReviewModal'
import TestExplanation from './components/TestExplanation'
import TestHelperAvatar from './components/TestHelperAvatar'
import TestDrawingLayer from './components/TestDrawingLayer'
import TestCalculatorSheet from './components/TestCalculatorSheet'
import TestFormulasSheet from './components/TestFormulasSheet'
import { clearDrawingSession } from './components/drawing-model'
import { buildTopicBreakdown } from './topic-diagnosis'
import { buildV2Results, buildV2ReviewItems, v2Threshold } from './server-results'
import { formatImageSrc } from './hooks/useImagePreload'
import { useTimer, parseTimerLeft } from './useTimer'
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
  if (mode === 'adaptive') return { type: 'adaptive' }
  if (mode === 'topic') throw new Error('topic_selector_required')
  if (mode === 'ticket') throw new Error('ticket_selector_required')
  if (mode === 'lesson') throw new Error('lesson_selector_required')
  if (mode === 'module') throw new Error('module_selector_required')
  if (mode === 'exam') throw new Error('exam_selector_required')
  if (mode === 'single') throw new Error('single_selector_required')
  if (mode === 'random20') return { type: 'random', count: 20 }
  throw new Error(`unknown_random_mode:${mode satisfies never}`)
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
  const [showResults, setShowResults] = useState(() => Boolean(snapshot?.answers.every(Boolean)))
  const [showReview, setShowReview] = useState(false)
  const [coinPop, setCoinPop] = useState(0)
  const [earnedXpTotal, setEarnedXpTotal] = useState(0)
  const [earnedCoinsTotal, setEarnedCoinsTotal] = useState(0)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [drawingOpen, setDrawingOpen] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [formulasOpen, setFormulasOpen] = useState(false)
  const [drawingsVisible, setDrawingsVisible] = useState(true)
  const [scratchpadOpen, setScratchpadOpen] = useState(false)
  const [savedPositions, setSavedPositions] = useState<Set<number>>(new Set())
  const [showExplain, setShowExplain] = useState(false)
  const [showAiTutor, setShowAiTutor] = useState(false)
  const [dbExplanation, setDbExplanation] = useState<string | null>(null)
  const [loadingDbExplain, setLoadingDbExplain] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)
  const isRu = settings.language === 'ru'
  const storeTopics = useQuestionsStore((state) => state.topics)
  const speaking = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false)

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

  // Review'dagi mavzu nomlari + yakuniy tahlil uchun metadata (v2-safe:
  // loadTopics savol matni tortmaydi — faqat nomlar; yakunda lazy).
  useEffect(() => {
    if (!finished) return
    void useQuestionsStore.getState().loadTopics(subjectId).catch(() => {})
  }, [finished, subjectId])

  const sessionId = snapshot?.sessionId

  // Bookmark holati (server — sessiya proof orqali; master ID siz)
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    api.savedQuestionPositions(sessionId)
      .then((res) => { if (!cancelled) setSavedPositions(new Set(res.savedPositions)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [sessionId])

  const results = useMemo(() => (snapshot ? buildV2Results(snapshot) : []), [snapshot])

  const reviewItems = useMemo((): ExamReviewItem[] => {
    if (!snapshot) return []
    return buildV2ReviewItems(snapshot, (topicId) => {
      if (topicId == null) return undefined
      const topic = storeTopics.find((t) => t.id === topicId)
      return topic ? (settings.language === 'ru' ? topic.nameRu : topic.nameUz) : `#${topicId}`
    })
  }, [snapshot, storeTopics, settings.language])

  const topicBreakdown = useMemo(() => {
    if (!snapshot) return undefined
    return buildTopicBreakdown(
      snapshot.questions.map((q) => ({
        topicId: q.topic?.id ?? null,
        status: (snapshot.answers[q.position] === 'correct' ? 'correct'
          : snapshot.answers[q.position] === 'wrong' ? 'incorrect' : 'unanswered') as 'correct' | 'incorrect' | 'unanswered',
      })),
      storeTopics,
      settings.language,
      isRu ? 'Общие' : 'Umumiy',
    )
  }, [snapshot, storeTopics, settings.language, isRu])

  const goToResultQuestion = useCallback((index: number) => {
    if (!snapshot) return
    if (!snapshot.questions.some((item) => item.position === index)) return
    setShowResults(false)
    persist({ ...snapshot, current: index })
  }, [persist, snapshot])

  const wrongCount = useMemo(
    () => (snapshot ? snapshot.answers.filter((a) => a === 'wrong').length : 0),
    [snapshot],
  )
  const unansweredCount = useMemo(
    () => (snapshot ? snapshot.answers.filter((a) => a === null).length : 0),
    [snapshot],
  )

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
      // Legacy paritet: javobdan keyin KEYINGI savolga o'tadi (yetkazilgan
      // bo'lsa). firstAvailable faqat resume/zaxira uchun — aks holda strip'da
      // sakrab yurganda kutilmagan orqaga sakrash bo'lardi.
      const delivered = new Set(next.questions.map((item) => item.position))
      next.current = delivered.has(position + 1) ? position + 1 : firstAvailable(next)
      persist(next)
      if (response.attempt.correct) {
        haptics.success()
        playSound('success')
      } else {
        haptics.error()
        playSound('error')
      }
      if (response.attempt.coinsEarned > 0) setCoinPop((value) => value + 1)
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
        setEarnedXpTotal((value) => value + response.attempt.xpEarned)
        setEarnedCoinsTotal((value) => value + response.attempt.coinsEarned)
      }
      if (response.session.status === 'completed' || next.answers.every(Boolean)) {
        setFinished(true)
        setShowResults(true)
      }
      // Mock imtihon: 2-xato = darhol yakunlash (legacy paritet)
      if (mode === 'mock' && next.answers.filter((a) => a === 'wrong').length >= 2) {
        void api.finishTestSession(next.sessionId, 'completed').catch(() => undefined)
        setFinished(true)
        setShowResults(true)
      }
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
  }, [applySessionAnswer, isRu, mode, persist, question, snapshot, subjectId, submitting])

  const finish = useCallback(async () => {
    if (!snapshot) return
    await api.finishTestSession(snapshot.sessionId, 'completed').catch(() => undefined)
    setFinished(true)
    setShowResults(true)
  }, [snapshot])

  const handleTimeUp = useCallback(() => {
    if (!snapshot || finished) return
    void api.finishTestSession(snapshot.sessionId, 'completed').catch(() => undefined)
    setFinished(true)
    setShowResults(true)
  }, [finished, snapshot])

  const handleBack = useCallback(() => {
    if (!snapshot || finished) {
      goBack(navigate)
      return
    }
    if (snapshot.answers.filter(Boolean).length === 0) {
      goBack(navigate)
      return
    }
    setConfirmExit(true)
  }, [snapshot, finished, navigate])

  const handleFinishPress = useCallback(() => {
    if (!snapshot || finished) return
    if (snapshot.answers.filter((a) => a === null).length > 0) {
      setConfirmFinish(true)
      return
    }
    void finish()
  }, [snapshot, finished, finish])

  const toggleSave = useCallback(async () => {
    if (!snapshot || !question) return
    try {
      const res = await api.toggleSavedQuestion(snapshot.sessionId, {
        position: question.position,
        deliveryToken: question.deliveryToken,
        expiresAt: question.expiresAt,
      })
      setSavedPositions((prev) => {
        const next = new Set(prev)
        if (res.saved) next.add(question.position)
        else next.delete(question.position)
        return next
      })
    } catch {
      setError(isRu ? 'Не удалось сохранить. Повторите попытку.' : 'Saqlab bo‘lmadi. Qayta urinib ko‘ring.')
    }
  }, [snapshot, question, isRu])

  const openExplain = useCallback(() => {
    if (!snapshot || !question) return
    setShowExplain(true)
    setDbExplanation(null)
    if (snapshot.correctOptions[question.position] == null) return
    setLoadingDbExplain(true)
    api.getSessionExplanation(snapshot.sessionId, {
      position: question.position,
      deliveryToken: question.deliveryToken,
      expiresAt: question.expiresAt,
      language: settings.language,
    })
      .then((res) => setDbExplanation(res.text))
      .catch(() => setDbExplanation(null))
      .finally(() => setLoadingDbExplain(false))
  }, [snapshot, question, settings.language])

  // Savol almashtirilganda ovozli o'qishni to'xtatish (legacy paritet)
  useEffect(() => {
    stopSpeaking()
    return stopSpeaking
  }, [snapshot, settings.language])

  // Javoblar yo'qolmasin: reload/yopishda brauzer tasdig'i (legacy paritet)
  useEffect(() => {
    const answeredCount = snapshot?.answers.filter((a) => a !== null).length ?? 0
    if (answeredCount === 0 || finished) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [snapshot, finished])

  const initialSeconds = useMemo(() => secondsUntil(snapshot?.expiresAt), [snapshot?.expiresAt])
  const timer = useTimer(handleTimeUp, snapshot?.sessionId ?? 'loading', initialSeconds)
  const timerLeft = parseTimerLeft(timer)
  const timerTone = timerLeft <= 60 ? 'text-pdanger' : timerLeft <= 300 ? 'text-pwarning' : 'text-pfg'
  const timerIconTone = timerLeft <= 60 ? 'text-pdanger' : timerLeft <= 300 ? 'text-pwarning' : 'text-pmuted'

  const retryTest = useCallback(async () => {
    if (snapshot) {
      await api.finishTestSession(snapshot.sessionId, 'abandoned').catch(() => undefined)
      clearDrawingSession(snapshot.sessionId)
    }
    useServerTestSessionStore.getState().clear()
    setSnapshot(null)
    setFinished(false)
    setShowResults(false)
    setShowReview(false)
    setEarnedXpTotal(0)
    setEarnedCoinsTotal(0)
    setSavedPositions(new Set())
    setShowExplain(false)
    setShowAiTutor(false)
    setDbExplanation(null)
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
        setShowExplain(false)
        persist({ ...snapshot, current: next })
      }
    },
    onSwipeRight: () => {
      if (!snapshot || !canSwipeRight) return
      const prev = snapshot.current - 1
      if (snapshot.questions.some((item) => item.position === prev)) {
        setSlideDirection('right')
        setShowExplain(false)
        persist({ ...snapshot, current: prev })
      }
    },
    canSwipeLeft,
    canSwipeRight,
    enabled: settings.swipeToNavigate !== false && !finished && !loading && Boolean(snapshot)
      && !drawingOpen && !scratchpadOpen && !zoomed && !calculatorOpen && !formulasOpen && !showReview
      && !showExplain && !showAiTutor,
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
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => goBack(navigate)}><ChevronLeft size={17} />{isRu ? 'Назад' : 'Orqaga'}</Button>
          <Button variant="secondary" onClick={() => setShowResults(true)}><BarChart2 size={17} />{isRu ? 'Результаты' : 'Natijalar'}</Button>
          <Button onClick={() => void retryTest()}><RotateCcw size={17} />{isRu ? 'Ещё раз' : 'Qayta ishlash'}</Button>
        </div>
        {showResults && (
          <ResultsModal
            results={results}
            threshold={v2Threshold(mode)}
            hideVerdict={mode === 'exam'}
            topicBreakdown={topicBreakdown}
            earnedXp={earnedXpTotal}
            earnedCoins={earnedCoinsTotal}
            onRetry={() => void retryTest()}
            onFinish={() => { setShowResults(false); goBack(navigate) }}
            onGoToQuestion={goToResultQuestion}
            onOpenReview={() => setShowReview(true)}
          />
        )}
        {showReview && (
          <ExamReviewModal
            items={reviewItems}
            language={settings.language}
            onClose={() => setShowReview(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-var(--safe-top-body,0px))] flex-col bg-pcanvas">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] page-header pt-[var(--safe-top,0px)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
          <Button variant="secondary" size="icon" onClick={handleBack} aria-label={isRu ? 'Назад' : 'Orqaga'}><ChevronLeft /></Button>
          <div className="text-center">
            <p className="text-sm font-semibold text-pfg">
              {title ?? (mode === 'saved' || mode === 'mistakes'
                ? (mode === 'saved'
                    ? (isRu ? 'Сохранённые' : 'Saqlanganlar')
                    : (isRu ? 'Работа над ошибками' : 'Xatolarni tuzatish'))
                : (isRu ? `Практика · ${snapshot.total}` : `Mashq · ${snapshot.total}`))}
            </p>
            <p className="flex items-center justify-center gap-1 text-xs text-pmuted"><Timer size={12} className={timerIconTone} />
              <span className={timerLeft <= 60 ? 'animate-pulse' : undefined}>
                <span key={Math.floor(timerLeft / 60)} className={`inline-block font-semibold tabular-nums animate-swapRollIn ${timerTone}`}>{timer}</span>
              </span> · {answeredCount}/{snapshot.total}
              {mode === 'mock' && (
                <span className={wrongCount > 0 ? 'font-semibold text-pdanger' : undefined}> · {wrongCount}/2 {isRu ? 'ошибки' : 'xato'}</span>
              )}
            </p>
          </div>
          <Button variant="ghost" onClick={handleFinishPress}>{isRu ? 'Завершить' : 'Yakunlash'}</Button>
        </div>
      </header>

      {error && <div role="alert" className="mx-auto mt-3 flex max-w-2xl items-center gap-2 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-4 py-3 text-sm text-pdanger"><AlertTriangle size={16} />{error}</div>}
      {coinPop > 0 && (
        <div key={coinPop} className="coin-pop" aria-hidden>
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--p-gold-rgb)/0.18)] px-3 py-1.5 text-[13px] font-semibold tabular-nums text-pgold shadow-xs">
            <CoinIcon size={14} />
            +1
          </span>
        </div>
      )}
      <QuestionStrip
        total={snapshot.total}
        current={position}
        answers={snapshot.answers}
        onSelect={(next) => {
          if (snapshot.questions.some((item) => item.position === next)) {
            setSlideDirection(next > position ? 'left' : next < position ? 'right' : null)
            setShowExplain(false)
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
          <div className="mb-2 flex items-center gap-2">
            <p className="min-w-0 flex-1 text-xs font-medium text-pmuted">{position + 1} / {snapshot.total}</p>
            <Button
              variant="ghost" size="icon"
              onClick={() => {
                if (isSpeaking()) stopSpeaking()
                else speak(question.text, settings.language)
                playSound('click')
              }}
              aria-label={speaking ? (isRu ? 'Остановить' : 'Ovozni to‘xtatish') : (isRu ? 'Озвучить вопрос' : 'Savolni o‘qib berish')}
              aria-pressed={speaking}
              className={`flex-none ${speaking ? 'text-pprimary' : 'text-pmuted'}`}
            >
              {speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} strokeWidth={1.75} />}
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => void toggleSave()}
              aria-label={savedPositions.has(position) ? (isRu ? 'Убрать из сохранённых' : 'Saqlanganlardan olish') : (isRu ? 'Сохранить' : 'Saqlash')}
              aria-pressed={savedPositions.has(position)}
              className="flex-none"
            >
              <Bookmark fill={savedPositions.has(position) ? 'currentColor' : 'none'} className={savedPositions.has(position) ? 'text-pwarning' : ''} />
            </Button>
          </div>
          <MathText as="p" text={question.text} className="mb-5 text-left font-display text-[18px] font-semibold leading-relaxed text-pfg" />
          {question.media && (
            <img
              src={formatImageSrc(question.media)} alt=""
              onClick={() => setZoomed(formatImageSrc(question.media) ?? question.media)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoomed(formatImageSrc(question.media) ?? question.media) }}
              aria-label={isRu ? 'Увеличить' : 'Kattalashtirish'}
              className="mb-5 max-h-72 w-full cursor-zoom-in rounded-2xl bg-psurface object-contain"
            />
          )}
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

      {zoomed && (
        <ImageZoomModal src={zoomed} alt={isRu ? 'Изображение вопроса' : 'Savol rasmi'} onClose={() => setZoomed(null)} />
      )}
      {!finished && (
        <TestDrawingLayer
          open={drawingOpen}
          onOpenChange={setDrawingOpen}
          questionKey={`${snapshot.sessionId}:${position}`}
          sessionKey={snapshot.sessionId}
          language={settings.language}
          raised={selected !== null}
          visible={drawingsVisible}
          onVisibleChange={setDrawingsVisible}
          onOpenCalculator={() => setCalculatorOpen(true)}
          onOpenFormulas={() => setFormulasOpen(true)}
          scratchpadOpen={scratchpadOpen}
          onScratchpadOpenChange={setScratchpadOpen}
        />
      )}
      <TestCalculatorSheet
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        language={settings.language}
        disabledReason={(mode === 'exam' || mode === 'mock')
          ? (isRu ? 'В официальном режиме экзамена калькулятор запрещен.' : 'Rasmiy imtihon rejimida kalkulyatordan foydalanish taqiqlangan.')
          : null}
      />
      <TestFormulasSheet
        open={formulasOpen}
        onClose={() => setFormulasOpen(false)}
        language={settings.language}
        subjectId={subjectId}
      />
      {answer !== null && !drawingOpen && (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1.5rem+var(--safe-bottom,0px))] z-40 mx-auto flex max-w-2xl items-end justify-end">
          <Button
            variant="ghost" onClick={openExplain}
            aria-label={isRu ? 'Почему так?' : 'Nega shunday?'}
            aria-haspopup="dialog"
            className="pointer-events-auto relative h-16 w-16 shrink-0 rounded-full p-0 hover:bg-transparent"
          >
            <TestHelperAvatar />
            <span aria-hidden="true" className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-pcard text-sm font-bold text-pfg shadow-sm">?</span>
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmExit}
        title={isRu ? 'Выйти из теста?' : 'Testdan chiqilsinmi?'}
        description={isRu ? 'Отвеченные вопросы сохранены — тест можно продолжить позже.' : 'Berilgan javoblar saqlangan — testni keyin davom ettirish mumkin.'}
        confirmLabel={isRu ? 'Выйти' : 'Chiqish'}
        cancelLabel={isRu ? 'Остаться' : 'Qolish'}
        onClose={() => setConfirmExit(false)}
        onConfirm={() => { setConfirmExit(false); goBack(navigate) }}
      />
      <ConfirmDialog
        open={confirmFinish && !finished}
        title={isRu ? 'Завершить тест?' : 'Test yakunlansinmi?'}
        description={unansweredCount > 0
          ? (isRu ? `Осталось без ответа: ${unansweredCount}. Завершить сейчас?` : `${unansweredCount} ta savol javobsiz qoldi. Hozir yakunlansinmi?`)
          : (isRu ? 'Показать результаты.' : 'Natijalarni ko‘rish uchun yakunlang.')}
        confirmLabel={isRu ? 'Завершить' : 'Yakunlash'}
        cancelLabel={isRu ? 'Продолжить' : 'Davom etish'}
        onClose={() => setConfirmFinish(false)}
        onConfirm={() => { setConfirmFinish(false); void finish() }}
      />
      {showExplain && (
        <TestExplanation
          loading={loadingDbExplain}
          text={dbExplanation}
          language={settings.language}
          onClose={() => setShowExplain(false)}
          onOpenAi={() => { setShowExplain(false); setShowAiTutor(true) }}
        />
      )}
      {showAiTutor && (
        <AiTutorModal
          sessionRef={{
            sessionId: snapshot.sessionId,
            position: question.position,
            deliveryToken: question.deliveryToken,
            expiresAt: question.expiresAt,
          }}
          selectedOptionId={snapshot.selected[question.position] ?? null}
          isCorrect={snapshot.answers[question.position] === 'correct'}
          language={settings.language}
          onClose={() => setShowAiTutor(false)}
        />
      )}
    </div>
  )
}
