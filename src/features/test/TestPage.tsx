import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Bookmark, Share2, Flag, Settings, BarChart2, Info, GraduationCap, X, Volume2 } from 'lucide-react'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { resolveExamMode } from '../../../shared/exam-presets'
import { buildTopicBreakdown } from './topic-diagnosis'
import { useTestSessionStore } from '../../shared/store/useTestSessionStore'
import { isResumable, remainingSeconds, clampIndex } from '../../shared/lib/test-session'
import { useAppStore } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { speak, stopSpeaking } from '../../shared/lib/speech'
import { shareUrl } from '../../platform/telegram'
import { useT } from '../../shared/i18n'
import { useTimer } from './useTimer'
import QuestionStrip from './QuestionStrip'
import OptionButton from './OptionButton'
import ResultsModal, { type QuestionResult } from './ResultsModal'
import AiTutorModal from './components/AiTutorModal'
import StudyPanel from './components/StudyPanel'
import { MODULE_TOPICS } from '../../content/modules'
import { lessons } from '../../content/lessons'
import { useTestSession } from './hooks/useTestSession'

export default function TestPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const settings       = useAppStore((s) => s.settings)
  const submitAnswer   = useAppStore((s) => s.submitAnswer)
  const toggleSaved    = useAppStore((s) => s.toggleSaved)
  const savedQuestions = useAppStore((s) => s.savedQuestions)
  const tt          = useT(settings.language)
  const questions   = useQuestionsStore((s) => s.questions)
  const storeTopics = useQuestionsStore((s) => s.topics)

  const mode = (location.state?.mode as string | undefined) ?? null
  /** Rasmiy imtihon preset'i ('exam:<presetId>') bo'lsa — shared/exam-presets'dan */
  const examPreset = resolveExamMode(mode)

  // ── Resumable session — Telegram WebView restart/reload'da test saqlanadi ──
  const subjectId  = useSubjectStore((s) => s.subjectId)
  const stateTitle = location.state?.title as string | undefined

  // State initialization (needed before calling the hook)
  const [current, setCurrent]                 = useState(0)
  const [answers, setAnswers]                 = useState<(string | null)[]>([])
  const [selectedHistory, setSelectedHistory] = useState<(string | null)[]>([])
  /** Server reveal qilgan to'g'ri variant id'lari (javobgacha null) */
  const [correctOpts, setCorrectOpts]         = useState<(string | null)[]>([])
  /** Server tekshiruvi kutilayotgan javob (double-submit himoyasi) */
  const [submitting, setSubmitting]           = useState(false)
  const [showSettings, setShowSettings]       = useState(false)
  const [showResults, setShowResults]         = useState(false)
  const [isFinished, setIsFinished]           = useState(false)

  // ── useTestSession hook — manages activeQuestions and session persistence ──
  const { activeQuestions, sessionKey } = useTestSession({
    mode,
    questionIds: location.state?.questionIds as number[] | undefined,
    questions,
    subjectId,
    stateTitle,
    answers,
    current,
    isFinished,
    locationKey: location.key,
    selectedHistory,
    correctOpts,
  })

  const startIndex = Math.min(
    Math.max(0, (Number(id) || 1) - 1),
    Math.max(0, activeQuestions.length - 1)
  )

  const [toast, setToast]                     = useState<string | null>(null)
  const [zoomed, setZoomed]                   = useState(false)
  const [confirmExit, setConfirmExit]         = useState(false)
  const [studyOpen, setStudyOpen]             = useState(false)

  const q         = activeQuestions[current]
  const fontSize  = settings?.fontSize || 'medium'
  const selected  = selectedHistory[current] ?? null
  const answeredStatus = answers[current]
  // To'g'ri javob endi client'da saqlanMAYDI — faqat server javob bergach
  // (post-answer reveal) shu massivga yoziladi.
  const revealedId = correctOpts[current] ?? null
  const [showExplain, setShowExplain] = useState(false)

  // ── AI Tutor modal state ──
  const [showAiTutor, setShowAiTutor] = useState(false)

  /** Joriy savolning modda (darslik darsi) — "Nega shunday?" izohi.
      Mavzu → slug → MODULE_TOPICS orqali modul. */
  const explanation = useMemo(() => {
    if (!q?.topicId) return null
    const topic = storeTopics.find((t) => t.id === q.topicId)
    if (!topic) return null
    const entry = Object.entries(MODULE_TOPICS).find(([, slugs]) => slugs.includes(topic.slug))
    if (!entry) return null
    const modId = Number(entry[0])
    const lesson = lessons[modId]?.[0]
    return lesson ? { modId, lesson } : null
  }, [q?.topicId, storeTopics])

  const handleTimeUp = useCallback(() => {
    setAnswers((prev) => prev.map((a) => a ?? 'unanswered'))
    setIsFinished(true)
    setShowResults(true)
  }, [])

  // Exam mode: 40 questions / 30 minutes — like the real test.
  // Rasmiy preset: muddat shared/exam-presets'dan (45sav/180daq, 50sav/120daq).
  // Pause YO'Q — timer wall-clock (useTimer), background'da ham yuradi.
  const totalSeconds =
    examPreset            ? examPreset.durationMinutes * 60 :
    mode === 'exam'        ? 30 * 60 :
    mode === 'mock'        ? 25 * 60 :
    mode === 'random100'   ? 120 * 60 :
    mode === 'random20'    ? 30 * 60 : 25 * 60
  // Resume: timer wall-clock — sessiya boshlanganidan o'tgan vaqt ayiriladi
  // (reload orqali imtihon vaqtini "yangilash" imkonsiz)
  const initialSeconds = useMemo(() => {
    const snap = useTestSessionStore.getState().session
    return isResumable(snap, sessionKey, subjectId)
      ? remainingSeconds(snap.startedAt, totalSeconds)
      : totalSeconds
    // eslint-disable-next-line react-hooks/exhaustive-deps — location.key: yangi urinishda qayta hisoblash
  }, [location.key, sessionKey, subjectId, totalSeconds])
  const timer = useTimer(handleTimeUp, location.key, initialSeconds)

  // Sessiya snapshot'ini persist'ga yozish — FAQAT hooks/useTestSession.ts'da
  // (bu yerda dublikat effect bo'lgan — ikki manba, ikki startedAtRef: o'chirildi)
  useEffect(() => {
    const snap = useTestSessionStore.getState().session
    const r = isResumable(snap, sessionKey, subjectId) ? snap : null
    const len = activeQuestions.length
    setCurrent(r ? clampIndex(r.current, len) : startIndex)
    setAnswers(r && r.answers.length === len ? [...r.answers] : Array(len).fill(null))
    setSelectedHistory(r && r.selected.length === len ? [...r.selected] : Array(len).fill(null))
    setCorrectOpts(r && r.correctOptions?.length === len ? [...r.correctOptions] : Array(len).fill(null))
    setSubmitting(false)
    setShowResults(false)
    setIsFinished(false)
    setToast(null)
    setStudyOpen(false)
    if (r && len > 0 && r.answers.some((a) => a !== null)) {
      setToast(tt('sessionResumed'))
      setTimeout(() => setToast(null), 3000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps — tt startIndex/len o'zgarishlarida yetarli
  }, [location.key, startIndex, activeQuestions.length, sessionKey, subjectId])

  const autoNextTimerRef = useRef<number | null>(null)
  const cancelAutoNext = useCallback(() => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current)
      autoNextTimerRef.current = null
    }
  }, [])
  useEffect(() => cancelAutoNext, [current, cancelAutoNext])

  const goTo = useCallback((i: number) => {
    cancelAutoNext()
    if (i >= 0 && i < activeQuestions.length) {
      setCurrent(i)
      setStudyOpen(false)
      setShowExplain(false)
      setShowAiTutor(false)
    }
  }, [activeQuestions.length, cancelAutoNext])

  // "O'rganish" — panelni ochadi/yopadi (faqat toggle)
  const handleStudyToggle = useCallback(() => {
    setStudyOpen((o) => !o)
  }, [])

  const getOptionState = useCallback((optId: string) => {
    if (!selected) return 'default'
    // REVEAL faqat server'dan: javobgacha hech qaysi variant "to'g'ri" ko'rinmaydi
    if (revealedId) {
      if (optId === revealedId) return 'correct'
      if (optId === selected && selected !== revealedId) return 'wrong'
      return 'default'
    }
    // Reveal yo'q: yoki server javobi kutilmoqda, yoki offline (pending),
    // yoki eski (reveal'siz) sessiya — o'z tanlovini status bo'yicha bo'yaymiz.
    if (optId === selected) {
      if (answeredStatus === 'correct') return 'correct'
      if (answeredStatus === 'wrong')   return 'wrong'
      return 'pending'   // submit kutilmoqda yoki offline navbatda
    }
    return 'default'
  }, [selected, revealedId, answeredStatus])

  const handleSelect = useCallback((optId: string) => {
    if (selected || submitting || !q) return
    const questionId = q.id
    const answeredIndex = current
    setSelectedHistory((prev) => { const next = [...prev]; next[answeredIndex] = optId; return next })
    setSubmitting(true)

    // ASYNC FEEDBACK: to'g'rilikni SERVER hal qiladi (javob kaliti client'da yo'q).
    void (async () => {
      const outcome = await submitAnswer(questionId, optId)
      setSubmitting(false)

      // Fatal (4xx) — server QAT'IY rad etdi: javob SAQLANMADI (outbox'siz).
      // "Offline"ga yutmaymiz: tanlovni rollback (qayta urinish mumkin) + xato toast.
      if (outcome && 'fatal' in outcome) {
        setSelectedHistory((prev) => { const next = [...prev]; next[answeredIndex] = null; return next })
        setToast(tt('submitFailed'))
        setTimeout(() => setToast(null), 3000)
        return
      }

      // Find current index after async — activeQuestions may have changed
      const idx = activeQuestions.findIndex(x => x.id === questionId)
      if (idx === -1) {
        setToast(tt('notFoundQ'))
        setTimeout(() => setToast(null), 2500)
        return
      }

      if (!outcome) {
        // Offline — javob outbox'ga yozildi; internet qaytganda server
        // tekshirib counterlarni yangilaydi. Indigo "pending" holat qoladi.
        setAnswers((prev) => { const next = [...prev]; next[idx] = 'pending'; return next })
        setToast(tt('offlineQueued'))
        setTimeout(() => setToast(null), 2500)
        return
      }
      if (outcome.duplicate || outcome.correct === null || outcome.correctAnswer === null) {
        // Idempotent replay — counterlar qayta yozilmagan va reveal qaytarilmaydi;
        // holatni o'zgartirmaymiz (no-op).
        return
      }
      const isCorrect: boolean = outcome.correct
      const revealed: string = outcome.correctAnswer
      setAnswers((prev) => { const next = [...prev]; next[idx] = isCorrect ? 'correct' : 'wrong'; return next })
      setCorrectOpts((prev) => { const next = [...prev]; next[idx] = revealed; return next })
      haptics.notify(isCorrect ? 'success' : 'error')
      if (isCorrect) {
        correctStreakRef.current += 1
        // 🔥 combo: har 3 ta ketma-ket to'g'ri javobda ko'tariladigan ovoz
        playSound(correctStreakRef.current % 3 === 0 ? 'combo' : 'success')
      } else {
        correctStreakRef.current = 0
        playSound('error')
      }
      const delay = isCorrect
        ? (settings?.autoNextCorrect ? 800 : null)
        : (settings?.autoNextWrong ? 1200 : null)
      if (delay !== null) {
        cancelAutoNext()
        autoNextTimerRef.current = window.setTimeout(() => {
          autoNextTimerRef.current = null
          goTo(idx + 1)
        }, delay)
      }
    })()
  }, [selected, submitting, current, q, settings, submitAnswer, cancelAutoNext, goTo, tt, activeQuestions])

  const buildResults = useCallback((): QuestionResult[] =>
    activeQuestions.map((q, i) => ({
      questionId: q.id,
      status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : 'unanswered') as QuestionResult['status'],
    })),
    [activeQuestions, answers]
  )

  /** Rasmiy imtihon yakuni — mavzular kesimida diagnostika (eng zaif birinchi) */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps — tt til o'zgarishi bilan yangilanadi
    [activeQuestions, answers, storeTopics, settings.language],
  )

  // Mock imtihon: 2+ xato — "yiqildingiz" (darhol yakunlanadi, bilet qoidasi)
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
  }, [answers])

  // "Qayta" — shu rejimni 1-savoldan qayta boshlaydi (yangi aralashtirish:
  // location.key o'zgarishi activeQuestions memo'sini ham yangilaydi)
  const handleRetry = useCallback(() => {
    if (activeQuestions.length === 0) return
    // Yangi urinish: eski sessiyani tozalash — aks holda key === match bo'lib RESUME bo'lardi
    useTestSessionStore.getState().clear()
    navigate('/test/1', { replace: true, state: location.state })
  }, [navigate, activeQuestions.length, location.state])

  // "Yakunlash" — dashboardga emas, test boshlangan sahifaga qaytaradi
  const handleFinishFromModal = useCallback(() => { setShowResults(false); goBack(navigate) }, [navigate])
  const handleGoToQuestion    = useCallback((i: number) => { setShowResults(false); setCurrent(i) }, [])

  // Savol almashganda / sahifadan chiqilganda ovoz to'xtatiladi (TTS)
  useEffect(() => { stopSpeaking() }, [current])

  // Exit confirm: first tap shows the warning, second tap within 3 s really exits
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 🔥 Ketma-ket to'g'ri javoblar hisoblagichi (combo ovozi uchun)
  const correctStreakRef = useRef(0)

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

  // Warn when closing/reloading the page mid-test
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

  if (!q) return (
    <div className="flex items-center justify-center min-h-screen text-muted">{tt('notFoundQ')}</div>
  )

  const isSaved     = savedQuestions.includes(questionKey(subjectId, q.id))
  const isLast      = current === activeQuestions.length - 1
  const allAnswered = answers.every((a) => a !== null && a !== 'unanswered')
  const topicLabel  = (() => {
    if (location.state?.title) return location.state.title
    const topic = storeTopics.find(t => t.id === q.topicId)
    return topic ? (settings?.language === 'ru' ? topic.nameRu : topic.nameUz) : ''
  })()

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} aria-label={confirmExit ? tt('cancelExit') : tt('backWord')}
            className={`btn-3d-ghost w-9 h-9 rounded-xl flex items-center justify-center text-lg ${confirmExit ? 'text-duo-red' : ''}`}>
            {confirmExit ? '✕' : '←'}
          </button>
          <button onClick={() => toggleSaved(q.id)}
            aria-label={isSaved ? tt('removeSaved') : tt('saveBtn')}
            className={`btn-3d-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-extrabold ${isSaved ? 'text-duo-yellow' : ''}`}>
            <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">{tt('saveBtn')}</span>
          </button>
          <button
            onClick={() => shareUrl('https://t.me/kiwi_uz_bot', 'YHQ imtihoniga tayyorlaning!')}
            aria-label={tt('shareApp')}
            className="btn-3d-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-extrabold">
            <Share2 size={16} />
            <span className="hidden sm:inline">{tt('shareApp')}</span>
          </button>
        </div>

        <div className="card-neon flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl min-w-[75px] sm:absolute sm:left-1/2 sm:-translate-x-1/2 shadow-[0_0_14px_rgba(59,130,246,0.20)]" role="timer" aria-live="off" aria-label={`${tt('timeRemaining')}: ${timer}`}>
          <span className="text-neon-yellow text-sm flex-shrink-0" aria-hidden="true">⏱</span>
          <span className="font-mono font-black text-sm text-fg whitespace-nowrap">{timer}</span>
        </div>

        {/* Mock imtihon: xatolar hisoblagichi (2 ta = yiqildingiz) */}
        {mode === 'mock' && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border ${
            wrongCount > 0 ? 'border-duo-red/60 bg-duo-red/10 text-duo-red' : 'border-line text-subtle'
          }`}>
            <span className="text-[12px] font-black">✗ {wrongCount}/2</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isFinished && (
            <button onClick={() => setShowResults(true)} aria-label="Natijalar"
              className="btn-3d-ghost w-9 h-9 rounded-xl flex items-center justify-center">
              <BarChart2 size={17} />
            </button>
          )}
          <button onClick={() => setShowSettings(true)} aria-label="Sozlamalar"
            className="btn-3d-ghost w-9 h-9 rounded-xl flex items-center justify-center">
            <Settings size={17} />
          </button>
          <button
            onClick={() => { setIsFinished(true); setShowResults(true) }}
            aria-label="Testni yakunlash"
            className="btn-3d-ghost w-9 h-9 rounded-xl flex items-center justify-center">
            <Flag size={16} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="mx-4 mt-2 bg-orange-500/10 border border-orange-500/40 text-fg text-xs font-semibold px-3 py-2 rounded-xl text-center">
          ⚠️ {toast}
        </div>
      )}

      <QuestionStrip total={activeQuestions.length} current={current} answers={answers} onSelect={goTo} />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-6xl lg:mx-auto lg:pt-6">
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
              <p className="text-xs text-muted font-medium" aria-label={`${tt('question')} ${current + 1} ${tt('of')} ${activeQuestions.length}${topicLabel ? `, ${topicLabel}` : ''}`}>
                {current + 1} / {activeQuestions.length}
                {topicLabel ? ` · ${topicLabel}` : ''}
              </p>
              {/* 🔊 Ovozli o'qish (TTS) */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  speak(q.text, settings?.language ?? 'uz')
                  playSound('click')
                }}
                aria-label={settings?.language === 'ru' ? 'Озвучить вопрос' : "Savolni o'qib berish"}
                className="w-6 h-6 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg active:scale-90 transition-all"
              >
                <Volume2 size={12} />
              </button>
            </div>
            <p className={`text-center lg:text-left font-semibold mb-4 leading-snug ${
              fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-xl' : 'text-base'
            }`}>
              {q.text}
            </p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-4">
              {/* "Nega shunday?" — javobdan keyin modda/izoh tugmasi */}
              {selected && explanation && (
                <button onClick={() => setShowExplain(true)}
                  aria-label={tt('whyThis')}
                  className="flex items-center gap-1.5 bg-duo-yellow/15 border border-duo-yellow/40 text-duo-yellow text-[12px] font-bold px-3.5 py-2 rounded-xl active:scale-95 transition-transform">
                  <Info size={14} aria-hidden="true" />
                  {tt('whyThis')}
                </button>
              )}
              {/* AI Tutor — HAMMA javobdan keyin */}
              {selected && (
                <button onClick={() => setShowAiTutor(true)}
                  aria-label={tt('askAiExplain')}
                  className="flex items-center gap-1.5 bg-duo-purple/15 border border-duo-purple/40 text-duo-purple text-[12px] font-bold px-3.5 py-2 rounded-xl active:scale-95 transition-transform">
                  <span aria-hidden="true">✨</span> {tt('askAiExplain')}
                </button>
              )}
            </div>
          </div>
          {q.image && (
            /* Rasmlar PORTRAIT (juda baland, masalan 253x1179). Fixed px balandlik
               kichraytirib tashlaydi — shuning uchun max-h viewportga nisbatan:
               rasm natural o'lchamda, lekin ekrandan tashqariga chiqmaydi */
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-2xl overflow-hidden mb-4 border border-line cursor-zoom-in flex items-center justify-center bg-elevated"
              onClick={() => setZoomed(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoomed(true) }}
              aria-label={tt('zoomImage')}>
              <img src={q.image} alt={`${tt('question')} ${current + 1}`} loading="lazy"
                className="max-w-full max-h-[55vh] lg:max-h-[70vh] w-auto h-auto object-contain min-w-0 min-h-0" />
            </div>
          )}
          <div className="lg:col-start-1 lg:row-start-2">
            {q.options.map((opt) => (
              <OptionButton key={opt.id} option={opt} state={getOptionState(opt.id)}
                onSelect={() => handleSelect(opt.id)} answered={!!selected} fontSize={fontSize} />
            ))}
          </div>
        </div>
      </div>

      {/* Floating study panel */}
      <StudyPanel language={settings.language} isOpen={studyOpen} />

      {/* Yakunlash / O'rganish tugma */}
      <div className="fixed right-4 bottom-6 z-40">
        {(isLast || allAnswered) ? (
          <button onClick={handleYakunlash}
            aria-label={tt('finish')}
            className="btn-neon flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full text-[13px] font-black">
            <span aria-hidden="true">✓</span> {tt('finish')}
          </button>
        ) : (
          <button onClick={handleStudyToggle}
            aria-label={studyOpen ? tt('closeStudy') : tt('study')}
            className="btn-3d-ghost flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full text-[13px] font-extrabold">
            {studyOpen
              ? (<><X size={15} aria-hidden="true" />{tt('study')}</>)
              : (<><GraduationCap size={16} aria-hidden="true" />{tt('study')}</>)}
          </button>
        )}
      </div>

      {showResults && (
        <ResultsModal results={buildResults()} onRetry={handleRetry}
          threshold={mode === 'exam' ? 90 : mode === 'mock' ? 95 : 80}
          hideVerdict={!!examPreset}
          topicBreakdown={examPreset ? topicBreakdown : undefined}
          onFinish={handleFinishFromModal} onGoToQuestion={handleGoToQuestion} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* "Nega shunday?" — modda izohi (bottom sheet) */}
      {showExplain && explanation && (
        <DialogOverlay onClose={() => setShowExplain(false)} labelId="explain-title">
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-duo-yellow/15 border border-duo-yellow/40 flex items-center justify-center flex-shrink-0">
                <Info size={17} className="text-duo-yellow" />
              </div>
              <p id="explain-title" className="text-[15px] font-black text-fg">
                {settings?.language === 'ru' ? explanation.lesson.titleRu : explanation.lesson.titleUz}
              </p>
            </div>
            {(settings?.language === 'ru' ? explanation.lesson.bodyRu : explanation.lesson.bodyUz)
              .slice(0, 3).map((p, i) => (
                <p key={i} className="text-[13px] text-muted leading-relaxed mb-2">{p}</p>
              ))}
            <button
              onClick={() => {
                setShowExplain(false)
                navigate('/darslik', { state: { moduleId: explanation.modId, lessonIdx: 0 } })
              }}
              className="btn-neon w-full mt-2 py-3 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2">
              <GraduationCap size={16} />
              {tt('openModule')}
            </button>
          </div>
        </DialogOverlay>
      )}

      {/* AI Tutor modal */}
      {showAiTutor && q && selected && (
        <AiTutorModal
          questionId={q.id}
          selectedOptionId={selected}
          isCorrect={answers[current] === 'correct'}
          onClose={() => setShowAiTutor(false)}
          language={settings.language}
        />
      )}

      {/* Full-screen image zoom */}
      {zoomed && q.image && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 cursor-zoom-out"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label={tt('closeZoom')}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') setZoomed(false) }}>
          <img src={q.image} alt={`${tt('question')} ${current + 1}`} className="max-w-full max-h-full object-contain" />
          <span className="absolute top-4 right-4 text-white/70 text-2xl px-2" aria-hidden="true">✕</span>
        </div>
      )}
    </div>
  )
}
