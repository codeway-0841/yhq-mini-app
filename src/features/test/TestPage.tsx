import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import { Bookmark, Share2, Flag, Settings, BarChart2, Play, Video, Info, MessageCircle, GraduationCap, X, Crown, Loader2, Volume2 } from 'lucide-react'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'
import { haptics } from '../../lib/haptics'
import { playSound } from '../../lib/sounds'
import { speak, stopSpeaking } from '../../lib/speech'
import { shareUrl } from '../../lib/telegram'
import { useT } from '../../shared/i18n'
import { useTimer } from './useTimer'
import QuestionStrip from './QuestionStrip'
import OptionButton from './OptionButton'
import ResultsModal, { type QuestionResult } from './ResultsModal'
import { MODULE_TOPICS } from '../../data/modules'
import { lessons } from '../../data/lessons'
import { explainQuestion, fetchStaticExplanation, TutorError } from '../../lib/tutor'
import { openTelegramLink } from '../../lib/telegram'

// Study panel elementlari (Ovozli/Video/Qoidasi/Muhokama)
const STUDY_ITEMS = [
  { key: 'voiceLesson' as const, icon: Play },
  { key: 'videoLesson' as const, icon: Video },
  { key: 'ruleBook'    as const, icon: Info },
  { key: 'discuss'     as const, icon: MessageCircle },
]

export default function TestPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, addResult, toggleSaved, savedQuestions } = useAppStore()
  const tt          = useT(settings.language)
  const questions   = useQuestionsStore((s) => s.questions)
  const storeTopics = useQuestionsStore((s) => s.topics)

  const mode = (location.state?.mode as 'random50' | 'random100' | 'random20' | 'exam' | 'mock' | 'tricky' | 'numeric' | undefined) ?? null

  const activeQuestions = useMemo(() => {
    const ids = location.state?.questionIds
    if (ids?.length) {
      const idSet = new Set(ids)
      return questions.filter((q) => idSet.has(q.id))
    }
    const shuffled = () => [...questions].sort(() => Math.random() - 0.5)
    switch (mode) {
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
  }, [location.state?.questionIds, mode, questions, location.key])

  const startIndex = Math.min(
    Math.max(0, (Number(id) || 1) - 1),
    Math.max(0, activeQuestions.length - 1)
  )

  const [current, setCurrent]                 = useState(startIndex)
  const [answers, setAnswers]                 = useState(() => Array(activeQuestions.length).fill(null))
  const [selectedHistory, setSelectedHistory] = useState(() => Array(activeQuestions.length).fill(null))
  const [showSettings, setShowSettings]       = useState(false)
  const [showResults, setShowResults]         = useState(false)
  const [isFinished, setIsFinished]           = useState(false)
  const [toast, setToast]                     = useState<string | null>(null)
  const [zoomed, setZoomed]                   = useState(false)
  const [confirmExit, setConfirmExit]         = useState(false)
  const [studyOpen, setStudyOpen]             = useState(false)

  const q         = activeQuestions[current]
  const fontSize  = settings?.fontSize || 'medium'
  const selected  = selectedHistory[current] ?? null
  const correctId = q?.correct ?? null
  const [showExplain, setShowExplain] = useState(false)

  // ── AI Tutor (Premium) — xato savolni streaming tushuntirish ──
  const { tariff } = useAppStore()
  const userId  = useAppStore((s) => s.user?.id)
  const isPremium = tariff === 'premium'
  const [showAi, setShowAi]         = useState(false)
  const [aiText, setAiText]         = useState('')
  const [aiBusy, setAiBusy]         = useState(false)
  const aiCacheRef = useRef(new Map<number, string>())

  /** Joriy savol AI tushuntirishi — cache bilan (re-open bepul).
      To'g'ri/xato javobga qarab prompt tanlanadi. */
  const startAiExplain = useCallback(async () => {
    if (!q || !userId || !selected) return
    const answeredCorrect = selected === correctId
    const cacheKey = q.id * 10 + (answeredCorrect ? 1 : 0)
    const cached = aiCacheRef.current.get(cacheKey)
    if (cached) { setAiText(cached); return }
    setAiBusy(true)
    setAiText('')
    try {
      let acc = ''
      for await (const chunk of explainQuestion(q.id, settings?.language ?? 'uz', answeredCorrect)) {
        acc += chunk
        setAiText(acc)
      }
      aiCacheRef.current.set(cacheKey, acc)
    } catch (err) {
      if (err instanceof TutorError && err.kind === 'premium_required') {
        setShowAi(false)
        setShowAiUpsell(true)
        return
      }
      setAiText(err instanceof TutorError && err.kind === 'quota'
        ? tt('aiQuotaMsg')
        : tt('aiUnavailable'))
    } finally {
      setAiBusy(false)
    }
  }, [q, userId, selected, correctId, settings?.language, tt])

  const [showAiUpsell, setShowAiUpsell] = useState(false)

  // ── Statik tushuntirish (FREE) — AI Tutor olmaganlarga muqobil ──
  const [staticText, setStaticText] = useState<string | null>(null)
  const [showStatic, setShowStatic] = useState(false)

  const openAi = useCallback(async () => {
    // Premium yo'q bo'lsa — avval statik tushuntirish beramiz (bo'lsa),
    // bo'lmasa upsell modal. Botga YUBORILMAYDI; ilova ichida ochiladi.
    if (!isPremium) {
      if (q) {
        try {
          const text = await fetchStaticExplanation(q.id, settings?.language ?? 'uz')
          if (text) { setStaticText(text); setShowStatic(true); return }
        } catch { /* tarmoq xatosi — upsell'ga tushamiz */ }
      }
      setShowAiUpsell(true)
      return
    }
    setShowAi(true)
    void startAiExplain()
  }, [isPremium, q, settings?.language, startAiExplain])

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

  // Exam mode: 40 questions / 30 minutes — like the real test
  const totalSeconds =
    mode === 'exam'        ? 30 * 60 :
    mode === 'mock'        ? 25 * 60 :
    mode === 'random100'   ? 120 * 60 :
    mode === 'random20'    ? 30 * 60 : 25 * 60
  const timer = useTimer(handleTimeUp, location.key, totalSeconds)

  useEffect(() => {
    setCurrent(startIndex)
    setAnswers(Array(activeQuestions.length).fill(null))
    setSelectedHistory(Array(activeQuestions.length).fill(null))
    setShowResults(false)
    setIsFinished(false)
    setToast(null)
    setStudyOpen(false)
  }, [location.key, startIndex, activeQuestions.length])

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
      setShowAi(false)
    }
  }, [activeQuestions.length, cancelAutoNext])

  // "O'rganish" — panelni ochadi/yopadi (faqat toggle)
  const handleStudyToggle = useCallback(() => {
    setStudyOpen((o) => !o)
  }, [])

  const getOptionState = useCallback((optId: string) => {
    if (!selected) return 'default'
    if (optId === correctId) return 'correct'
    if (optId === selected && selected !== correctId) return 'wrong'
    return 'default'
  }, [selected, correctId])

  const handleSelect = useCallback((optId: string) => {
    if (selected || !correctId || !q) return
    const isCorrect = optId === correctId
    setSelectedHistory((prev) => { const next = [...prev]; next[current] = optId; return next })
    setAnswers((prev) => { const next = [...prev]; next[current] = isCorrect ? 'correct' : 'wrong'; return next })
    haptics.notify(isCorrect ? 'success' : 'error')
    if (isCorrect) {
      correctStreakRef.current += 1
      // 🔥 combo: har 3 ta ketma-ket to'g'ri javobda ko'tariladigan ovoz
      playSound(correctStreakRef.current % 3 === 0 ? 'combo' : 'success')
    } else {
      correctStreakRef.current = 0
      playSound('error')
    }
    addResult(isCorrect, q.id, optId)   // server selected variantni o'zi tekshiradi
    const delay = isCorrect
      ? (settings?.autoNextCorrect ? 800 : null)
      : (settings?.autoNextWrong ? 1200 : null)
    if (delay !== null) {
      cancelAutoNext()
      const answeredIndex = current
      autoNextTimerRef.current = window.setTimeout(() => {
        autoNextTimerRef.current = null
        goTo(answeredIndex + 1)
      }, delay)
    }
  }, [selected, correctId, current, q, settings, addResult, cancelAutoNext, goTo])

  const buildResults = useCallback((): QuestionResult[] =>
    activeQuestions.map((q, i) => ({
      questionId: q.id,
      status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : 'unanswered') as QuestionResult['status'],
    })),
    [activeQuestions, answers]
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
    exitTimerRef.current = setTimeout(() => { setConfirmExit(false); setToast(null) }, 3000)
  }, [answers, isFinished, confirmExit, navigate, tt])

  // Warn when closing/reloading the page mid-test
  useEffect(() => {
    const answeredCount = answers.filter((a) => a !== null && a !== 'unanswered').length
    if (answeredCount === 0 || isFinished) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [answers, isFinished])

  if (!q) return (
    <div className="flex items-center justify-center min-h-screen text-muted">{tt('notFoundQ')}</div>
  )

  const isSaved     = savedQuestions.includes(q.id)
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
          <button onClick={handleBack} aria-label="Orqaga"
            className={`btn-3d-ghost w-9 h-9 rounded-xl flex items-center justify-center text-lg ${confirmExit ? 'text-duo-red' : ''}`}>
            {confirmExit ? '✕' : '←'}
          </button>
          <button onClick={() => toggleSaved(q.id)}
            className={`btn-3d-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-extrabold ${isSaved ? 'text-duo-yellow' : ''}`}>
            <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">{tt('saveBtn')}</span>
          </button>
          <button
            onClick={() => shareUrl('https://t.me/kiwi_uz_bot', 'YHQ imtihoniga tayyorlaning!')}
            className="btn-3d-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-extrabold">
            <Share2 size={16} />
            <span className="hidden sm:inline">{tt('shareApp')}</span>
          </button>
        </div>

        <div className="card-neon flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl sm:absolute sm:left-1/2 sm:-translate-x-1/2 shadow-[0_0_14px_rgba(59,130,246,0.20)]">
          <span className="text-neon-yellow text-sm">⏱</span>
          <span className="font-mono font-black text-sm text-fg">{timer}</span>
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
              <p className="text-xs text-muted font-medium">
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
                  className="flex items-center gap-1.5 bg-duo-yellow/15 border border-duo-yellow/40 text-duo-yellow text-[12px] font-bold px-3.5 py-2 rounded-xl active:scale-95 transition-transform">
                  <Info size={14} />
                  {tt('whyThis')}
                </button>
              )}
              {/* AI Tutor — HAMMA javobdan keyin (Premium) */}
              {selected && (
                <button onClick={openAi}
                  className="flex items-center gap-1.5 bg-duo-purple/15 border border-duo-purple/40 text-duo-purple text-[12px] font-bold px-3.5 py-2 rounded-xl active:scale-95 transition-transform">
                  ✨ {tt('askAiExplain')}
                  {!isPremium && <Crown size={13} fill="currentColor" />}
                </button>
              )}
            </div>
          </div>
          {q.image && (
            /* Rasmlar PORTRAIT (juda baland, masalan 253x1179). Fixed px balandlik
               kichraytirib tashlaydi — shuning uchun max-h viewportga nisbatan:
               rasm natural o'lchamda, lekin ekrandan tashqariga chiqmaydi */
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-2xl overflow-hidden mb-4 border border-line cursor-zoom-in flex items-center justify-center bg-elevated"
              onClick={() => setZoomed(true)}>
              <img src={q.image} alt="savol" loading="lazy"
                className="max-w-full max-h-[55vh] lg:max-h-[70vh] w-auto h-auto object-contain" />
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

      {/* Floating study tugma + panel (14_22/14_24 uslubi):
          yopiqda bitta pill; ochilganda stek tepaga stagger-animatsiya bilan chiqadi,
          yopilganda pastga qaytib yo'qoladi */}
      <div className="fixed right-4 bottom-6 z-40 flex flex-col items-end gap-2">
        {STUDY_ITEMS.map((it, i) => {
          const Icon = it.icon
          return (
            <button key={it.key} disabled title={tt('comingSoon')}
              className={`btn-3d-ghost flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-[12px] font-extrabold transition-all duration-300 ${
                studyOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-3 invisible pointer-events-none'
              }`}
              style={{ transitionDelay: studyOpen ? `${i * 45}ms` : `${(STUDY_ITEMS.length - 1 - i) * 45}ms` }}>
              <Icon size={14} />
              {tt(it.key)}
            </button>
          )
        })}
        {(isLast || allAnswered) ? (
          <button onClick={handleYakunlash}
            className="btn-neon flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full text-[13px] font-black">
            ✓ {tt('finish')}
          </button>
        ) : (
          <button onClick={handleStudyToggle}
            className="btn-3d-ghost flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full text-[13px] font-extrabold">
            {studyOpen
              ? (<><X size={15} />{tt('study')}</>)
              : (<><GraduationCap size={16} />{tt('study')}</>)}
          </button>
        )}
      </div>

      {showResults && (
        <ResultsModal results={buildResults()} onRetry={handleRetry}
          threshold={mode === 'exam' ? 90 : mode === 'mock' ? 95 : 80}
          onFinish={handleFinishFromModal} onGoToQuestion={handleGoToQuestion} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* "Nega shunday?" — modda izohi (bottom sheet) */}
      {showExplain && explanation && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowExplain(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-duo-yellow/15 border border-duo-yellow/40 flex items-center justify-center flex-shrink-0">
                <Info size={17} className="text-duo-yellow" />
              </div>
              <p className="text-[15px] font-black text-fg">
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
        </div>
      )}

      {/* AI Tutor PREMIUM upsell modali — premium yo'q foydalanuvchi uchun */}
      {showAiUpsell && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAiUpsell(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-duo-purple/15 border border-duo-purple/40 flex items-center justify-center mb-3">
                <Crown size={26} className="text-duo-yellow" fill="currentColor" />
              </div>
              <p className="text-[17px] font-black text-fg">{tt('premiumNeedTitle')}</p>
              <p className="text-[13px] text-muted mt-1.5 mb-4 leading-snug">{tt('premiumNeedDesc')}</p>
              <button
                onClick={() => {
                  setShowAiUpsell(false)
                  openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')
                }}
                className="btn-neon w-full py-3.5 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 mb-2">
                <Crown size={16} fill="currentColor" />
                {tt('buyPremium')}
              </button>
              <button onClick={() => setShowAiUpsell(false)}
                className="w-full py-3 rounded-2xl bg-elevated text-[13px] font-bold text-muted active:scale-[0.98] transition-transform">
                {tt('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tutor sheeti — streaming matn (premium) */}
      {showAi && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAi(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8 max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-duo-purple/15 border border-duo-purple/40 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={17} className="text-duo-purple" />
              </div>
              <p className="text-[15px] font-black text-fg">AI Tutor</p>
              {aiBusy && <Loader2 size={15} className="text-duo-purple animate-spin ml-auto" />}
            </div>
            <div className="overflow-y-auto min-h-[80px]">
              {aiText ? (
                <p className="text-[13.5px] text-fg leading-relaxed whitespace-pre-wrap">{aiText}</p>
              ) : (
                <p className="text-[13px] text-muted">{tt('aiThinking')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statik tushuntirish sheeti — FREE foydalanuvchilarga (AI o'rniga) */}
      {showStatic && staticText && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowStatic(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8 max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-duo-yellow/15 border border-duo-yellow/40 flex items-center justify-center flex-shrink-0">
                <Info size={17} className="text-duo-yellow" />
              </div>
              <p className="text-[15px] font-black text-fg">{tt('staticExplainTitle')}</p>
            </div>
            <div className="overflow-y-auto min-h-[60px]">
              <p className="text-[13.5px] text-fg leading-relaxed whitespace-pre-wrap">{staticText}</p>
            </div>
            {/* Soft upsell — agressiv modal emas, qiziqtirgich */}
            <button
              onClick={() => { setShowStatic(false); setShowAiUpsell(true) }}
              className="mt-4 w-full py-2.5 rounded-2xl bg-duo-purple/15 border border-duo-purple/40 text-duo-purple text-[12.5px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform flex-shrink-0">
              <Crown size={14} fill="currentColor" />
              {tt('staticExplainAiHint')}
            </button>
          </div>
        </div>
      )}

      {/* Full-screen image zoom */}
      {zoomed && q.image && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 cursor-zoom-out"
          onClick={() => setZoomed(false)}>
          <img src={q.image} alt="savol" className="max-w-full max-h-full object-contain" />
          <span className="absolute top-4 right-4 text-white/70 text-2xl px-2">✕</span>
        </div>
      )}
    </div>
  )
}
