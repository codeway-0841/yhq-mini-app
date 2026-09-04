import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Bookmark, Flag, BarChart2, X, Volume2, Square, ZoomIn, ChevronLeft, Timer, AlertTriangle, Check, MoreHorizontal } from 'lucide-react'
import { CoinIcon } from '../../shared/components/CoinIcon'
import SettingsIcon from '../../shared/components/SettingsIcon'
import QuestionsLoadError from '../../shared/components/QuestionsLoadError'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { resolveExamMode } from '../../../shared/exam-presets'
import { buildTopicBreakdown } from './topic-diagnosis'
import { useTestSessionStore } from '../../shared/store/useTestSessionStore'
import { isResumable, remainingSeconds, clampIndex, testDurationSeconds } from '../../shared/lib/test-session'
import { useAnswerTimer } from '../../shared/hooks/useAnswerTimer'
import { useAppStore } from '../../shared/store/useAppStore'
import { api } from '../../shared/api'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { speak, stopSpeaking, isSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { Button } from '../../shared/components/ui/button'
import { ConfirmDialog } from '../../shared/components/ui/dialog'
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetClose } from '../../shared/components/ui/sheet'
import TestExplanation from './components/TestExplanation'
import TestHelperAvatar from './components/TestHelperAvatar'
import { useT } from '../../shared/i18n'
import { useTimer } from './useTimer'
import QuestionStrip from './QuestionStrip'
import OptionButton from './OptionButton'
import { type QuestionResult } from './ResultsModal'
import { type ExamReviewItem } from './components/ExamReviewModal'
import { MODULE_TOPICS } from '../../content/modules'
import { lessons } from '../../content/lessons'
import lessonMap from '../../content/lessonMap.yhq.json'
import { useTestSession, useTestSessionSave } from './hooks/useTestSession'
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
  const speaking = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false)

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
  // Capture before save effects run, so mount cannot overwrite saved answers before restore.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Re-capture only when a new route/subject starts.
  const entrySession = useMemo(() => useTestSessionStore.getState().session, [location.key, subjectId])

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
  const [showMenu, setShowMenu] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)

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

  // ── useTestSession Hook (activeQuestions & sessionKey) ──
  const { activeQuestions, sessionKey } = useTestSession({
    mode,
    questionIds: location.state?.questionIds as number[] | undefined,
    questions,
    subjectId,
    stateTitle,
    locationKey: location.key,
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
    pauseAutoNext: showExplain || showAiTutor || showMenu || showSettings || confirmFinish || isFinished,
  })

  // ── Session save — snapshot persistence (haqiqiy answer-flow state bilan) ──
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
    locationKey: location.key,
  })

  // ── Image Preload Hook ──
  useImagePreload(activeQuestions, current)

  useEffect(() => {
    setDbExplanation(null)
    setLoadingDbExplain(false)
  }, [q?.id])

  const handleOpenExplain = useCallback(() => {
    cancelAutoNext()
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
  }, [q?.id, dbExplanation, settings.language, cancelAutoNext])

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
    if (isFinished) return
    cancelAutoNext()
    setConfirmFinish(false)
    setShowMenu(false)
    markAllUnanswered()
    setIsFinished(true)
    setShowResults(true)
  }, [isFinished, cancelAutoNext, markAllUnanswered])

  const totalSeconds = testDurationSeconds(mode)

  const initialSeconds = useMemo(() => {
    const snap = entrySession
    return isResumable(snap, sessionKey, subjectId)
      ? remainingSeconds(snap.startedAt, totalSeconds)
      : totalSeconds
  }, [entrySession, sessionKey, subjectId, totalSeconds])

  const timer = useTimer(handleTimeUp, location.key, initialSeconds)

  // Sessiyani restore qilish
  useEffect(() => {
    const snap = entrySession
    const r = isResumable(snap, sessionKey, subjectId) ? snap : null
    const len = activeQuestions.length
    setCurrent(r ? clampIndex(r.current, len) : startIndex)
    restoreState(
      r && r.answers.length === len ? [...r.answers] : Array(len).fill(null),
      r && r.selected.length === len ? [...r.selected] : Array(len).fill(null),
      r && r.correctOptions?.length === len ? [...r.correctOptions] : Array(len).fill(null)
    )
    resetViolations(r?.cheatViolations ?? 0)
    const expired = !!r && remainingSeconds(r.startedAt, totalSeconds) === 0
    setShowResults(expired)
    setIsFinished(expired)
    setToast(null)
    if (r && !expired && len > 0 && r.answers.some((a) => a !== null)) {
      setToast(tt('sessionResumed'))
      setTimeout(() => setToast(null), 3000)
    }
  }, [entrySession, location.key, startIndex, activeQuestions.length, sessionKey, subjectId, totalSeconds])

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
    cancelAutoNext()
    setShowMenu(false)
    if (isFinished) {
      setShowResults(true)
    } else {
      setConfirmFinish(true)
    }
  }, [cancelAutoNext, isFinished])

  const handleRetry = useCallback(() => {
    if (activeQuestions.length === 0) return
    useTestSessionStore.getState().clear()
    navigate('/test/1', { replace: true, state: location.state })
  }, [navigate, activeQuestions.length, location.state])

  const handleFinishFromModal = useCallback(() => { setShowResults(false); goBack(navigate) }, [navigate])
  const handleGoToQuestion    = useCallback((i: number) => { setShowResults(false); setCurrent(i) }, [])

  useEffect(() => {
    stopSpeaking()
    return stopSpeaking
  }, [q?.id, settings.language])

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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Button variant="secondary" size="icon" onClick={handleBack} aria-label={confirmExit ? tt('cancelExit') : tt('backWord')}>
            {confirmExit ? <X className="text-pdanger" /> : <ChevronLeft />}
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-pfg" role="timer" aria-live="off" aria-label={`${tt('timeRemaining')}: ${timer}`}>
              <Timer size={16} className="text-pmuted" aria-hidden="true" />
              <span className="text-base font-semibold tabular-nums">{timer}</span>
            </div>
            {mode === 'mock' && (
              <span className={`text-xs font-medium tabular-nums ${wrongCount > 0 ? 'text-pdanger' : 'text-pmuted'}`}>
                {wrongCount}/2 {tt('testErrors')}
              </span>
            )}
          </div>
          <Button variant="secondary" size="icon" onClick={() => { cancelAutoNext(); setShowMenu(true) }} aria-label={tt('testMenu')} aria-haspopup="dialog" aria-expanded={showMenu}>
            <MoreHorizontal />
          </Button>
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

      <div className="flex-1 px-4 pb-24">
        <div className={`mx-auto pt-3 ${q.image ? 'max-w-6xl lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-4' : 'max-w-2xl'}`}>
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="min-w-0 flex-1 text-xs text-pmuted font-medium" aria-label={`${tt('question')} ${current + 1} ${tt('of')} ${activeQuestions.length}${topicLabel ? `, ${topicLabel}` : ''}`}>
                {current + 1} / {activeQuestions.length}
                {topicLabel ? ` · ${topicLabel}` : ''}
              </p>
              <Button variant="secondary" size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isSpeaking()) stopSpeaking()
                  else speak(q.text, settings.language)
                  playSound('click')
                }}
                aria-label={tt(speaking ? 'stopReading' : 'readQuestion')}
                aria-pressed={speaking}
                className={`flex-none ${speaking ? 'text-pprimary' : 'text-pmuted'}`}
              >
                {speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} strokeWidth={1.75} />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => toggleSaved(q.id)} aria-label={isSaved ? tt('removeSaved') : tt('saveBtn')} aria-pressed={isSaved}>
                <Bookmark fill={isSaved ? 'currentColor' : 'none'} className={isSaved ? 'text-pwarning' : ''} />
              </Button>
            </div>
            <p className="mb-4 text-left font-display font-semibold leading-relaxed tracking-[-0.015em] text-pfg text-[18px]">
              {q.text}
            </p>

          </div>
          {q.image && (
            <div className="min-w-0 self-start lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-2xl overflow-hidden mb-4 cursor-zoom-in flex items-center justify-center bg-psurface relative group active:scale-[0.99] transition-transform shadow-xs"
              onClick={() => {
                setZoomed(true)
                haptics.impact('light')
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoomed(true) }}
              aria-label={tt('zoomImage')}>
              <img src={formatImageSrc(q.image)} alt={`${tt('question')} ${current + 1}`} loading="eager" decoding="async"
                className="block h-auto w-auto max-w-full max-h-[min(30svh,240px)] lg:max-h-[min(40svh,320px)] shrink-0 object-contain" />
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

      {(selected || isLast || allAnswered) && (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1.5rem+var(--safe-bottom,0px))] z-40 mx-auto flex max-w-2xl items-end justify-between gap-4">
          <div>
            {(isLast || allAnswered) && <Button onClick={handleYakunlash} className="pointer-events-auto shadow-lg">
              <Check size={15} aria-hidden="true" />{tt('finish')}
            </Button>}
          </div>
          {selected && <Button variant="ghost" onPointerDown={cancelAutoNext} onClick={handleOpenExplain}
            aria-label={tt('whyThis')} title={tt('whyThis')} aria-expanded={showExplain} aria-haspopup="dialog"
            className="pointer-events-auto relative h-16 w-16 shrink-0 rounded-full p-0 hover:bg-transparent">
            <TestHelperAvatar />
            <span aria-hidden="true" className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-pcard text-sm font-bold text-pfg shadow-sm">?</span>
          </Button>}
        </div>
      )}

      {showExplain && (
        <TestExplanation loading={loadingDbExplain} text={dbExplanation} lesson={explanation?.lesson}
          language={settings.language} onClose={() => setShowExplain(false)}
          onOpenAi={() => { cancelAutoNext(); setShowExplain(false); setShowAiTutor(true) }}
          onOpenLesson={explanation ? () => navigate('/darslik', { state: { moduleId: explanation.modId, lessonIdx: 0 } }) : undefined} />
      )}

      <Sheet open={showMenu} onClose={() => setShowMenu(false)}>
        <SheetHeader><SheetTitle>{tt('testMenu')}</SheetTitle></SheetHeader>
        <SheetClose onClose={() => setShowMenu(false)} label={tt('pathClose')} />
        <SheetBody className="space-y-2">
          <Button variant="secondary" block onClick={() => { setShowMenu(false); setShowSettings(true) }}>
            <SettingsIcon className="size-[18px]" />{tt('settingsTitle')}
          </Button>
          <Button variant="secondary" block onClick={handleYakunlash}>
            {isFinished ? <BarChart2 /> : <Flag />}{tt(isFinished ? 'results' : 'finish')}
          </Button>
        </SheetBody>
      </Sheet>
      <ConfirmDialog open={confirmFinish && !showResults} title={tt('testFinishTitle')}
        description={answers.some((a) => a === null || a === 'unanswered')
          ? tt('testFinishUnanswered').replace('{count}', String(answers.filter((a) => a === null || a === 'unanswered').length))
          : tt('testFinishReady')}
        confirmLabel={tt('finish')} cancelLabel={tt('testKeepSolving')}
        onClose={() => setConfirmFinish(false)}
        onConfirm={() => { cancelAutoNext(); setConfirmFinish(false); setIsFinished(true); setShowResults(true) }} />

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
