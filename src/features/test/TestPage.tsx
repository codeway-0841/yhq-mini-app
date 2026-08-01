import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Bookmark, Share2, Flag, Settings, BarChart2 } from 'lucide-react'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'
import { haptics } from '../../lib/haptics'
import { shareUrl } from '../../lib/telegram'
import { useT } from '../../shared/i18n'
import { useTimer } from './useTimer'
import QuestionStrip from './QuestionStrip'
import OptionButton from './OptionButton'
import ResultsModal, { type QuestionResult } from './ResultsModal'

export default function TestPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, addResult, toggleSaved, savedQuestions } = useAppStore()
  const tt          = useT(settings.language)
  const questions   = useQuestionsStore((s) => s.questions)
  const storeTopics = useQuestionsStore((s) => s.topics)

  const mode = (location.state?.mode as 'random50' | 'exam' | 'tricky' | 'numeric' | undefined) ?? null

  const activeQuestions = useMemo(() => {
    const ids = location.state?.questionIds
    if (ids?.length) {
      const idSet = new Set(ids)
      return questions.filter((q) => idSet.has(q.id))
    }
    const shuffled = () => [...questions].sort(() => Math.random() - 0.5)
    switch (mode) {
      case 'exam':     return shuffled().slice(0, Math.min(40, questions.length))
      case 'random50': return shuffled().slice(0, Math.min(50, questions.length))
      case 'tricky':   return shuffled().slice(0, Math.min(30, questions.length))
      case 'numeric': {
        const numeric = questions.filter((q) => /\d/.test(q.text))
        return numeric.length > 0 ? numeric : questions
      }
      default:         return questions
    }
  }, [location.state?.questionIds, mode, questions])

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

  const q         = activeQuestions[current]
  const fontSize  = settings?.fontSize || 'medium'
  const selected  = selectedHistory[current] ?? null
  const correctId = q?.correct ?? null

  const handleTimeUp = useCallback(() => {
    setAnswers((prev) => prev.map((a) => a ?? 'unanswered'))
    setIsFinished(true)
    setShowResults(true)
  }, [])

  // Exam mode: 40 questions / 30 minutes — like the real test
  const totalSeconds = mode === 'exam' ? 30 * 60 : 25 * 60
  const timer = useTimer(handleTimeUp, location.key, totalSeconds)

  useEffect(() => {
    setCurrent(startIndex)
    setAnswers(Array(activeQuestions.length).fill(null))
    setSelectedHistory(Array(activeQuestions.length).fill(null))
    setShowResults(false)
    setIsFinished(false)
    setToast(null)
  }, [location.key, startIndex, activeQuestions.length])

  const goTo   = useCallback((i: number) => { if (i >= 0 && i < activeQuestions.length) setCurrent(i) }, [activeQuestions.length])
  const goNext = useCallback(() => goTo(current + 1), [current, goTo])
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo])

  const goNextRef = useRef(goNext)
  useEffect(() => { goNextRef.current = goNext }, [goNext])

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
    addResult(isCorrect, q.id)   // wrongByTicket is keyed by QUESTION id
    if (isCorrect && settings?.autoNextCorrect) {
      setTimeout(() => goNextRef.current(), 800)
    } else if (!isCorrect && settings?.autoNextWrong) {
      setTimeout(() => goNextRef.current(), 1200)
    }
  }, [selected, correctId, current, q, settings, addResult])

  const buildResults = useCallback((): QuestionResult[] =>
    activeQuestions.map((q, i) => ({
      questionId: q.id,
      status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : 'unanswered') as QuestionResult['status'],
    })),
    [activeQuestions, answers]
  )

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

  const handleRetry = useCallback(() => {
    if (activeQuestions.length === 0) return
    const currentQId = q?.id
    let pick
    do {
      pick = activeQuestions[Math.floor(Math.random() * activeQuestions.length)]
    } while (pick.id === currentQId && activeQuestions.length > 1)
    navigate(`/test/${pick.id}`, { replace: true, state: location.state })
  }, [q, navigate, activeQuestions, location.state])

  const handleFinishFromModal = useCallback(() => { setShowResults(false); navigate('/') }, [navigate])
  const handleGoToQuestion    = useCallback((i: number) => { setShowResults(false); setCurrent(i) }, [])

  // Share the result — ResultsModal passes its computed stats
  const handleShareResult = useCallback((correct: number, total: number) => {
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0
    shareUrl(
      'https://t.me/prava_oson_bot',
      `YHQ test men natijam: ${percent}% (${correct}/${total}). Siz ham sinab ko'ring!`
    )
  }, [])

  // Exit confirm: first tap shows the warning, second tap within 3 s really exits
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleBack = useCallback(() => {
    const answered = answers.filter((a) => a !== null && a !== 'unanswered').length
    if (isFinished || answered === 0 || confirmExit) {
      navigate(-1)
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button onClick={handleBack}
          className={`text-lg px-1 transition-colors ${confirmExit ? 'text-red-400 font-bold' : 'text-muted hover:text-white'}`}>
          {confirmExit ? '✕' : '←'}
        </button>
        <div className="flex items-center gap-1 bg-surface px-3 py-1 rounded-xl border border-line">
          <span className="text-duo-orange">⏱</span>
          <span className="font-mono font-bold text-sm text-white">{timer}</span>
        </div>
        <div className="flex items-center gap-3">
          {isFinished && (
            <button onClick={() => setShowResults(true)} className="text-duo-blue hover:text-blue-300">
              <BarChart2 size={20} />
            </button>
          )}
          <button onClick={() => toggleSaved(q.id)} className={isSaved ? 'text-yellow-400' : 'text-muted hover:text-white'}>
            <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => shareUrl('https://t.me/prava_oson_bot', 'YHQ imtihoniga tayyorlaning!')}
            className="text-muted hover:text-white">
            <Share2 size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="text-muted hover:text-white"><Settings size={20} /></button>
          <button
            onClick={() => { setToast(tt('flagThanks')); setTimeout(() => setToast(null), 3000) }}
            className="text-muted hover:text-white">
            <Flag size={20} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="mx-4 mt-2 bg-orange-900/60 border border-orange-500/50 text-orange-200 text-xs font-semibold px-3 py-2 rounded-xl text-center">
          ⚠️ {toast}
        </div>
      )}

      <QuestionStrip total={activeQuestions.length} current={current} answers={answers} onSelect={goTo} />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-center text-xs text-muted mb-2 font-medium">
          {current + 1} / {activeQuestions.length}
          {topicLabel ? ` · ${topicLabel}` : ''}
        </p>
        <p className={`text-center font-semibold mb-4 leading-snug ${
          fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-xl' : 'text-base'
        }`}>
          {q.text}
        </p>
        {q.image && (
          <div className="rounded-xl overflow-hidden mb-4 border border-line cursor-zoom-in"
            onClick={() => setZoomed(true)}>
            <img src={q.image} alt="savol" className="w-full object-cover max-h-52" />
          </div>
        )}
        <div>
          {q.options.map((opt) => (
            <OptionButton key={opt.id} option={opt} state={getOptionState(opt.id)}
              onSelect={() => handleSelect(opt.id)} answered={!!selected} fontSize={fontSize} />
          ))}
        </div>
      </div>

      <div className="flex gap-3 px-4 py-3 border-t border-line bg-canvas">
        <button onClick={goPrev} disabled={current === 0}
          className="btn-3d-ghost flex-1 py-3 rounded-2xl font-extrabold">
          ← {tt('prev')}
        </button>
        {(isLast || allAnswered) ? (
          <button onClick={handleYakunlash} className="btn-3d-green flex-1 py-3 rounded-2xl font-extrabold">
            ✓ {tt('finish')}
          </button>
        ) : (
          <button onClick={selected ? goNext : undefined}
            className={`flex-1 py-3 rounded-2xl font-extrabold transition-colors ${
              selected ? 'btn-3d-blue' : 'bg-elevated text-subtle cursor-default border-2 border-line'
            }`}>
            {selected ? `✕ ${tt('study')}` : tt('study')}
          </button>
        )}
      </div>

      {showResults && (
        <ResultsModal results={buildResults()} onRetry={handleRetry}
          onFinish={handleFinishFromModal} onGoToQuestion={handleGoToQuestion}
          onShare={handleShareResult} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

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
