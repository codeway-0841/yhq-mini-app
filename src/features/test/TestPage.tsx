import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Bookmark, Share2, Flag, BarChart2, Info, X, Volume2, ZoomIn, ChevronLeft, Timer, AlertTriangle, Sparkles, Check } from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import SettingsIcon from '../../shared/components/SettingsIcon'
import QuestionsLoadError from '../../shared/components/QuestionsLoadError'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { resolveExamMode } from '../../../shared/exam-presets'
import { buildTopicBreakdown } from './topic-diagnosis'
import { useTestSessionStore } from '../../shared/store/useTestSessionStore'
import { isResumable, remainingSeconds, clampIndex } from '../../shared/lib/test-session'
import { useAnswerTimer } from '../../shared/hooks/useAnswerTimer'
import { useAppStore } from '../../shared/store/useAppStore'
import { api } from '../../shared/api'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { speak, stopSpeaking } from '../../shared/lib/speech'
import { shareUrl } from '../../platform/telegram'
import { useT } from '../../shared/i18n'
import { useTimer } from './useTimer'
import QuestionStrip from './QuestionStrip'
import OptionButton from './OptionButton'
import { type QuestionResult } from './ResultsModal'
import { type ExamReviewItem } from './components/ExamReviewModal'
import { MODULE_TOPICS } from '../../content/modules'
import { lessons } from '../../content/lessons'
import lessonMap from '../../content/lessonMap.yhq.json'
import { useTestSession } from './hooks/useTestSession'
import { useAntiCheat } from './hooks/useAntiCheat'
import { useImagePreload, formatImageSrc } from './hooks/useImagePreload'
import { useTestAnswerFlow } from './hooks/useTestAnswerFlow'
import TestModals from './components/TestModals'

export default function TestPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const settings       = useAppStore((s) => s.settings)
  const submitAnswer   = useAppStore((s) => s.submitAnswer)
  const toggleSaved    = useAppStore((s) => s.toggleSaved)
  const savedQuestions = useAppStore((s) => s.savedQuestions)
  const tt             = useT(settings.language)

  const questions        = useQuestionsStore((s) => s.questions)
  const storeTopics      = useQuestionsStore((s) => s.topics)
  const questionsLoading = useQuestionsStore((s) => s.loading)
  const questionsLoaded  = useQuestionsStore((s) => s.loaded)
  const questionsError   = useQuestionsStore((s) => s.error)

  const mode           = (location.state?.mode as string | undefined) ?? null
  const examPreset     = resolveExamMode(mode)
  const isOfficialExam = Boolean(examPreset) || mode === 'exam'

  const subjectId  = useSubjectStore((s) => s.subjectId)
  const stateTitle = location.state?.title as string | undefined

  useEffect(() => {
    if (!questionsLoaded && !questionsLoading && !questionsError) {
      void useQuestionsStore.getState().load(settings?.language || 'uz', subjectId)
    }
  }, [questionsLoaded, questionsLoading, questionsError, settings?.language, subjectId])

  // Serverless cold-start ping (har 4 daqiqada keep-alive)
  useEffect(() => api.startKeepAlive(), [])

  const [current, setCurrent]           = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showResults, setShowResults]   = useState(false)
  const [isFinished, setIsFinished]     = useState(false)
  const [showReview, setShowReview]     = useState(false)
  const [toast, setToast]               = useState<string | null>(null)
  const [zoomed, setZoomed]             = useState(false)
  const [confirmExit, setConfirmExit]   = useState(false)
  const [showExplain, setShowExplain]   = useState(false)
  const [dbExplanation, setDbExplanation]     = useState<string | null>(null)
  const [loadingDbExplain, setLoadingDbExplain] = useState(false)
  const [showAiTutor, setShowAiTutor]   = useState(false)

  const handleToast = useCallback((msgKey: string) => {
    setToast(tt(msgKey as any))
    setTimeout(() => setToast(null), 3000)
  }, [tt])

  // ── Anti-Cheat Hook ──
  const handleDisqualify = useCallback(() => {
    markAllUnanswered()
    setIsFinished(true)
    setShowResults(true)
  }, [])

  const {
    cheatViolations,
    activeStrike,
    disqualifiedByCheat,
    dismissStrike,
    resetViolations,
  } = useAntiCheat({
    isOfficialExam,
    isFinished,
    onDisqualify: handleDisqualify,
  })

  // ── useTestSession Hook ──
  const { activeQuestions, sessionKey } = useTestSession({
    mode,
    questionIds: location.state?.questionIds as number[] | undefined,
    questions,
    subjectId,
    stateTitle,
    answers: [],
    current,
    isFinished,
    locationKey: location.key,
    selectedHistory: [],
    correctOpts: [],
    cheatViolations,
    shuffleOptions: settings?.shuffleOptions,
  })

  const startIndex = Math.min(
    Math.max(0, (Number(id) || 1) - 1),
    Math.max(0, activeQuestions.length - 1)
  )

  const q = activeQuestions[current]
  const answerTimer = useAnswerTimer(q?.id)

  const goTo = useCallback((i: number) => {
    cancelAutoNext()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    if (i >= 0 && i < activeQuestions.length) {
      setCurrent(i)
      setShowExplain(false)
      setShowAiTutor(false)
    }
  }, [activeQuestions.length])

  // ── useTestAnswerFlow Hook ──
  const {
    answers,
    selectedHistory,
    correctOpts,
    submitting: _submitting,
    coinPop,
    selected,
    getOptionState,
    handleSelect,
    cancelAutoNext,
    restoreState,
    markAllUnanswered,
  } = useTestAnswerFlow({
    activeQuestions,
    current,
    settings,
    submitAnswer,
    answerTimer,
    goTo,
    onToast: handleToast,
  })

  // ── Image Preload Hook ──
  useImagePreload(activeQuestions, current)

  useEffect(() => {
    setDbExplanation(null)
    setLoadingDbExplain(false)
  }, [q?.id])

  const handleOpenExplain = useCallback(() => {
    setShowExplain(true)
    if (q?.id && !dbExplanation) {
      setLoadingDbExplain(true)
      api.getExplanation(q.id, settings.language)
        .then((res) => {
          if (res.text) setDbExplanation(res.text)
        })
        .catch(() => {})
        .finally(() => setLoadingDbExplain(false))
    }
  }, [q?.id, dbExplanation, settings.language])

  const explanation = useMemo(() => {
    if (!q?.topicId) return null
    const topic = storeTopics.find((t) => t.id === q.topicId)
    if (!topic) return null
    const entry = Object.entries(MODULE_TOPICS).find(([, slugs]) => slugs.includes(topic.slug))
    if (!entry) return null
    const modId = Number(entry[0])
    const map = lessonMap as Record<string, number[]>
    let targetLessonIdx = 0
    for (const [key, qids] of Object.entries(map)) {
      if (key.startsWith(`${modId}:`) && qids.includes(q.id)) {
        const parts = key.split(':')
        targetLessonIdx = Number(parts[1] ?? 0)
        break
      }
    }
    const lesson = lessons[modId]?.[targetLessonIdx] ?? lessons[modId]?.[0]
    return lesson ? { modId, lesson } : null
  }, [q?.id, q?.topicId, storeTopics])

  const handleTimeUp = useCallback(() => {
    markAllUnanswered()
    setIsFinished(true)
    setShowResults(true)
  }, [markAllUnanswered])

  const totalSeconds =
    examPreset            ? examPreset.durationMinutes * 60 :
    mode === 'marathon'    ? 300 * 60 :
    mode === 'exam'        ? 30 * 60 :
    mode === 'mock'        ? 25 * 60 :
    mode === 'random100'   ? 120 * 60 :
    mode === 'random20'    ? 30 * 60 : 25 * 60

  const initialSeconds = useMemo(() => {
    const snap = useTestSessionStore.getState().session
    return isResumable(snap, sessionKey, subjectId)
      ? remainingSeconds(snap.startedAt, totalSeconds)
      : totalSeconds
  }, [location.key, sessionKey, subjectId, totalSeconds])

  const timer = useTimer(handleTimeUp, location.key, initialSeconds)

  // Sessiyani restore qilish
  useEffect(() => {
    const snap = useTestSessionStore.getState().session
    const r = isResumable(snap, sessionKey, subjectId) ? snap : null
    const len = activeQuestions.length
    setCurrent(r ? clampIndex(r.current, len) : startIndex)
    restoreState(
      r && r.answers.length === len ? [...r.answers] : Array(len).fill(null),
      r && r.selected.length === len ? [...r.selected] : Array(len).fill(null),
      r && r.correctOptions?.length === len ? [...r.correctOptions] : Array(len).fill(null)
    )
    resetViolations(r?.cheatViolations ?? 0)
    setShowResults(false)
    setIsFinished(false)
    setToast(null)
    if (r && len > 0 && r.answers.some((a) => a !== null)) {
      setToast(tt('sessionResumed'))
      setTimeout(() => setToast(null), 3000)
    }
  }, [location.key, startIndex, activeQuestions.length, sessionKey, subjectId])

  const buildResults = useCallback((): QuestionResult[] =>
    activeQuestions.map((q, i) => ({
      questionId: q.id,
      status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : answers[i] === 'pending' ? 'pending' : 'unanswered') as QuestionResult['status'],
    })),
    [activeQuestions, answers]
  )

  const buildReviewItems = useCallback((): ExamReviewItem[] =>
    activeQuestions.map((q, i) => {
      const topic = storeTopics.find((t) => t.id === q.topicId)
      return {
        question: q,
        index: i,
        status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : answers[i] === 'pending' ? 'pending' : 'unanswered') as ExamReviewItem['status'],
        selectedOptionId: selectedHistory[i] ?? null,
        correctOptionId: correctOpts[i] ?? null,
        topicName: topic ? (settings.language === 'ru' ? topic.nameRu : topic.nameUz) : undefined,
      }
    }),
    [activeQuestions, answers, selectedHistory, correctOpts, storeTopics, settings.language],
  )

  const topicBreakdown = useMemo(() =>
    buildTopicBreakdown(
      activeQuestions.map((q, i) => ({
        topicId: q.topicId,
        status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : 'unanswered') as 'correct' | 'incorrect' | 'unanswered',
      })),
      storeTopics,
      settings.language,
      tt('topicGeneral'),
    ),
    [activeQuestions, answers, storeTopics, settings.language]
  )

  // Mock imtihon: 2+ xato bo'lsa darhol yakunlash
  const wrongCount = answers.filter((a) => a === 'wrong').length
  useEffect(() => {
    if (mode !== 'mock' || isFinished || wrongCount < 2) return
    setIsFinished(true)
    setShowResults(true)
  }, [mode, wrongCount, isFinished])

  const handleYakunlash = useCallback(() => {
    const unansweredIdx = answers.map((a, i) => (a === null || a === 'unanswered' ? i : -1)).filter((i) => i >= 0)
    if (unansweredIdx.length > 0) {
      setCurrent(unansweredIdx[0])
      setToast(`${unansweredIdx.length} ${tt('unansweredCount')}`)
      setTimeout(() => setToast(null), 3000)
    } else {
      setIsFinished(true)
      setShowResults(true)
    }
  }, [answers, tt])

  const handleRetry = useCallback(() => {
    if (activeQuestions.length === 0) return
    useTestSessionStore.getState().clear()
    navigate('/test/1', { replace: true, state: location.state })
  }, [navigate, activeQuestions.length, location.state])

  const handleFinishFromModal = useCallback(() => { setShowResults(false); goBack(navigate) }, [navigate])
  const handleGoToQuestion    = useCallback((i: number) => { setShowResults(false); setCurrent(i) }, [])

  useEffect(() => { stopSpeaking() }, [current])

  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBack = useCallback(() => {
    const answered = answers.filter((a) => a !== null && a !== 'unanswered').length
    if (isFinished || answered === 0 || confirmExit) {
      goBack(navigate)
      return
    }
    setConfirmExit(true)
    setToast(tt('exitConfirm'))
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => { setConfirmExit(false); setToast(null) }, 8000)
  }, [answers, isFinished, confirmExit, navigate, tt])

  useEffect(() => {
    const answeredCount = answers.filter((a) => a !== null && a !== 'unanswered').length
    if (answeredCount === 0 || isFinished) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [answers, isFinished])

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  if (!q) {
    if (questionsError && !questionsLoaded) {
      return <QuestionsLoadError error={questionsError} lang={settings?.language || 'uz'} />
    }
    if (questionsLoading || !questionsLoaded) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-pmuted gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-pprimary border-t-transparent animate-spin" />
          <p className="text-sm font-semibold">{tt('loadingDots')}</p>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-pmuted">{tt('notFoundQ')}</div>
    )
  }

  const isSaved     = savedQuestions.includes(questionKey(subjectId, q.id))
  const isLast      = activeQuestions.length > 0 && current === activeQuestions.length - 1
  const allAnswered =
    answers.length > 0 &&
    answers.length === activeQuestions.length &&
    answers.every((a) => a !== null && a !== 'unanswered')
  const topicLabel  = (() => {
    if (location.state?.title) return location.state.title
    const topic = storeTopics.find(t => t.id === q.topicId)
    return topic ? (settings?.language === 'ru' ? topic.nameRu : topic.nameUz) : ''
  })()

  return (
    <div className="flex flex-col bg-pcanvas">
      <div className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-pcanvas border-b border-pline">
        <div className="relative flex items-center justify-between px-3 min-[380px]:px-4 py-2.5">
          <div className="flex items-center gap-1 min-[380px]:gap-2">
            <button onClick={handleBack} aria-label={confirmExit ? tt('cancelExit') : tt('backWord')}
              className={`grid size-8 min-[380px]:size-9 place-items-center rounded-xl bg-psurface transition-colors duration-150 ease-out active:scale-[0.98] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${confirmExit ? 'text-pdanger' : 'text-pmuted'}`}>
              {confirmExit
                ? <X size={17} strokeWidth={1.75} />
                : <ChevronLeft size={18} strokeWidth={1.75} />}
            </button>
            <button onClick={() => toggleSaved(q.id)}
              aria-label={isSaved ? tt('removeSaved') : tt('saveBtn')}
              className={`bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1.5 px-2.5 min-[380px]:px-3 py-2 rounded-xl text-[13px] font-semibold shadow-xs ${isSaved ? 'text-pwarning' : ''}`}>
              <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
              <span className="hidden sm:inline">{tt('saveBtn')}</span>
            </button>
            <button
              onClick={() => shareUrl('https://t.me/kiwi_uz_bot', 'YHQ imtihoniga tayyorlaning!')}
              aria-label={tt('shareApp')}
              className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1.5 px-2.5 min-[380px]:px-3 py-2 rounded-xl text-[13px] font-semibold shadow-xs">
              <Share2 size={16} />
              <span className="hidden sm:inline">{tt('shareApp')}</span>
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-psurface px-2.5 min-[380px]:px-3 py-1.5 sm:absolute sm:left-1/2 sm:-translate-x-1/2 shadow-xs" role="timer" aria-live="off" aria-label={`${tt('timeRemaining')}: ${timer}`}>
            <Timer size={14} strokeWidth={1.75} className="flex-shrink-0 text-psubtle" aria-hidden="true" />
            <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-pfg">{timer}</span>
          </div>

          {mode === 'mock' && (
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl shadow-xs ${
              wrongCount > 0 ? 'bg-pdanger/10 text-pdanger' : 'bg-psurface text-psubtle'
            }`}>
              <X size={12} strokeWidth={2} aria-hidden="true" />
              <span className="text-[12px] font-semibold tabular-nums">{wrongCount}/2</span>
            </div>
          )}

          <div className="flex items-center gap-1 min-[380px]:gap-2">
            {isFinished && (
              <button onClick={() => setShowResults(true)} aria-label="Natijalar"
                className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 size-8 min-[380px]:size-9 rounded-xl flex items-center justify-center shadow-xs">
                <BarChart2 size={17} />
              </button>
            )}
            <button onClick={() => setShowSettings(true)} aria-label="Sozlamalar"
              className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 size-8 min-[380px]:size-9 rounded-xl flex items-center justify-center shadow-xs">
              <SettingsIcon className="size-[17px]" />
            </button>
            <button
              onClick={() => { setIsFinished(true); setShowResults(true) }}
              aria-label="Testni yakunlash"
              className="bg-psurface text-pfg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 size-8 min-[380px]:size-9 rounded-xl flex items-center justify-center shadow-xs">
              <Flag size={16} />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className="mx-4 mt-2 flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--p-warning-rgb)/0.12)] px-3.5 py-2.5 text-center text-[12.5px] font-medium text-pfg shadow-xs">
          <AlertTriangle size={14} strokeWidth={1.75} className="flex-none text-pwarning" aria-hidden="true" />
          {toast}
        </div>
      )}

      {coinPop > 0 && (
        <div key={coinPop} className="coin-pop" aria-hidden>
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--p-gold-rgb)/0.18)] px-3 py-1.5 text-[13px] font-semibold tabular-nums text-pgold shadow-xs">
            <CoinIcon size={14} />
            +1
          </span>
        </div>
      )}

      <QuestionStrip total={activeQuestions.length} current={current} answers={answers} onSelect={goTo} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-6xl lg:mx-auto lg:pt-6">
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
              <p className="text-xs text-pmuted font-medium" aria-label={`${tt('question')} ${current + 1} ${tt('of')} ${activeQuestions.length}${topicLabel ? `, ${topicLabel}` : ''}`}>
                {current + 1} / {activeQuestions.length}
                {topicLabel ? ` · ${topicLabel}` : ''}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  speak(q.text, settings?.language ?? 'uz')
                  playSound('click')
                }}
                aria-label={settings?.language === 'ru' ? 'Озвучить вопрос' : "Savolni o'qib berish"}
                className="grid size-7 place-items-center rounded-full bg-psurface text-pmuted transition-colors duration-150 ease-out hover:text-pfg active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary shadow-2xs"
              >
                <Volume2 size={13} strokeWidth={1.75} />
              </button>
            </div>
            <p className="mb-4 text-center font-display font-semibold leading-snug tracking-[-0.015em] text-pfg lg:text-left text-[18px]">
              {q.text}
            </p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-4">
              {selected && (
                <button onClick={handleOpenExplain}
                  aria-label={tt('whyThis')}
                  className="flex h-[34px] items-center gap-1.5 rounded-xl bg-[rgb(var(--p-warning-rgb)/0.15)] px-3 text-[12.5px] font-semibold text-pwarning transition-transform duration-150 ease-out active:scale-[0.98] shadow-xs">
                  <Info size={14} aria-hidden="true" />
                  {tt('whyThis')}
                </button>
              )}
              {selected && (
                <button onClick={() => setShowAiTutor(true)}
                  aria-label={tt('askAiExplain')}
                  className="flex h-[34px] items-center gap-1.5 rounded-xl bg-[rgb(var(--p-purple-rgb)/0.15)] px-3 text-[12.5px] font-semibold text-ppurple transition-transform duration-150 ease-out active:scale-[0.98] shadow-xs">
                  <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" /> {tt('askAiExplain')}
                </button>
              )}
            </div>
          </div>
          {q.image && (
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-2xl overflow-hidden mb-4 cursor-zoom-in flex items-center justify-center bg-psurface relative group active:scale-[0.99] transition-transform shadow-xs"
              onClick={() => {
                setZoomed(true)
                haptics.impact('light')
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoomed(true) }}
              aria-label={tt('zoomImage')}>
              <img src={formatImageSrc(q.image)} alt={`${tt('question')} ${current + 1}`} loading="eager" decoding="async"
                className="max-w-full max-h-[55vh] lg:max-h-[70vh] w-auto h-auto object-contain min-w-0 min-h-0" />
              <div className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-xs shadow-xs transition-colors group-hover:bg-black/85">
                <ZoomIn size={11} strokeWidth={1.75} />
                <span>{settings.language === 'ru' ? 'Увеличить' : 'Kattalashtirish'}</span>
              </div>
            </div>
          )}
          <div className="lg:col-start-1 lg:row-start-2">
            {q.options.map((opt, i) => (
              <OptionButton key={`${q.id}_${opt.id}`} indexLabel={String.fromCharCode(65 + i)} option={opt} state={getOptionState(opt.id)}
                onSelect={() => handleSelect(opt.id)} answered={!!selected} />
            ))}
          </div>
        </div>
      </div>

      {(isLast || allAnswered) && (
        <div className="fixed right-4 bottom-[calc(1.5rem+var(--safe-bottom,0px))] z-40">
          <button onClick={handleYakunlash}
            aria-label={tt('finish')}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-150 flex h-11 items-center gap-2 rounded-full pl-4 pr-5 text-[13px] font-semibold shadow-lg">
            <Check size={15} strokeWidth={2} aria-hidden="true" /> {tt('finish')}
          </button>
        </div>
      )}

      {/* Composition Modals Container */}
      <TestModals
        showResults={showResults}
        results={buildResults()}
        onRetry={handleRetry}
        threshold={mode === 'exam' ? 90 : mode === 'mock' ? 95 : 80}
        hideVerdict={!!examPreset}
        topicBreakdown={(isOfficialExam || !!examPreset || mode === 'exam' || mode === 'mock') ? topicBreakdown : undefined}
        disqualifiedByCheat={disqualifiedByCheat}
        onOpenReview={() => setShowReview(true)}
        onFinishFromModal={handleFinishFromModal}
        onGoToQuestion={handleGoToQuestion}

        showSettings={showSettings}
        onCloseSettings={() => setShowSettings(false)}

        showReview={showReview}
        reviewItems={buildReviewItems()}
        language={settings.language}
        onCloseReview={() => setShowReview(false)}

        activeStrike={activeStrike}
        onDismissStrike={dismissStrike}

        showExplain={showExplain}
        onCloseExplain={() => setShowExplain(false)}
        loadingDbExplain={loadingDbExplain}
        dbExplanation={dbExplanation}
        lessonExplanation={explanation}
        onOpenModuleLesson={(modId) => {
          navigate('/darslik', { state: { moduleId: modId, lessonIdx: 0 } })
        }}
        tt={tt}
        settings={settings}

        showAiTutor={showAiTutor}
        onCloseAiTutor={() => setShowAiTutor(false)}
        currentQuestion={q}
        selectedOption={selected}
        isAnswerCorrect={answers[current] === 'correct'}

        zoomed={zoomed}
        onCloseZoom={() => setZoomed(false)}
        currentIndex={current}
      />
    </div>
  )
}
