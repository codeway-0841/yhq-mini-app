import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Bookmark, Share2, Flag, Settings, BarChart2 } from 'lucide-react'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'
import { haptics } from '../../lib/haptics'
import { shareUrl } from '../../lib/telegram'
import { useTimer } from './useTimer'
import QuestionStrip from './QuestionStrip'
import OptionButton from './OptionButton'
import ResultsModal, { type QuestionResult } from './ResultsModal'

export default function TestPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, addResult, toggleSaved, savedQuestions } = useAppStore()
  const questions   = useQuestionsStore((s) => s.questions)
  const storeTopics = useQuestionsStore((s) => s.topics)

  const activeQuestions = useMemo(() => {
    const ids = location.state?.questionIds
    if (ids?.length) {
      const idSet = new Set(ids)
      return questions.filter((q) => idSet.has(q.id))
    }
    return questions
  }, [location.state?.questionIds, questions])

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

  const q         = activeQuestions[current]
  const fontSize  = settings?.fontSize || 'medium'
  const selected  = selectedHistory[current] ?? null
  const correctId = q?.correct ?? null

  const handleTimeUp = useCallback(() => {
    setAnswers((prev) => prev.map((a) => a ?? 'unanswered'))
    setIsFinished(true)
    setShowResults(true)
  }, [])

  const timer = useTimer(handleTimeUp, location.key)

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
      setToast(`${unansweredIdx.length} ta javob berilmagan savol bor`)
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

  if (!q) return (
    <div className="flex items-center justify-center min-h-screen text-[#8b949e]">Savol topilmadi</div>
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
    <div className="flex flex-col min-h-screen bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button onClick={() => navigate(-1)} className="text-[#8b949e] hover:text-white text-lg px-1">←</button>
        <div className="flex items-center gap-1 bg-[#161b22] px-3 py-1 rounded-xl border border-[#30363d]">
          <span className="text-[#f59e0b]">⏱</span>
          <span className="font-mono font-bold text-sm text-white">{timer}</span>
        </div>
        <div className="flex items-center gap-3">
          {isFinished && (
            <button onClick={() => setShowResults(true)} className="text-[#1f6feb] hover:text-blue-300">
              <BarChart2 size={20} />
            </button>
          )}
          <button onClick={() => toggleSaved(q.id)} className={isSaved ? 'text-yellow-400' : 'text-[#8b949e] hover:text-white'}>
            <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => shareUrl('https://t.me/osonprava_bot', 'YHQ imtihoniga tayyorlaning!')}
            className="text-[#8b949e] hover:text-white">
            <Share2 size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="text-[#8b949e] hover:text-white"><Settings size={20} /></button>
          <button
            onClick={() => { setToast("Xatolik haqidagi xabar qabul qilindi. Rahmat!"); setTimeout(() => setToast(null), 3000) }}
            className="text-[#8b949e] hover:text-white">
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
        <p className="text-center text-xs text-[#8b949e] mb-2 font-medium">
          {current + 1} / {activeQuestions.length}
          {topicLabel ? ` · ${topicLabel}` : ''}
        </p>
        <p className={`text-center font-semibold mb-4 leading-snug ${
          fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-xl' : 'text-base'
        }`}>
          {q.text}
        </p>
        {q.image && (
          <div className="rounded-xl overflow-hidden mb-4 border border-[#30363d]">
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

      <div className="flex gap-3 px-4 py-3 border-t border-[#30363d] bg-[#0d1117]">
        <button onClick={goPrev} disabled={current === 0}
          className="flex-1 py-3 rounded-xl bg-[#21262d] text-[#e6edf3] font-semibold disabled:opacity-40">
          ← Oldingi
        </button>
        {(isLast || allAnswered) ? (
          <button onClick={handleYakunlash} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold">
            ✓ Yakunlash
          </button>
        ) : (
          <button onClick={selected ? goNext : undefined}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
              selected ? 'bg-[#1f6feb] text-white' : 'bg-[#21262d] text-[#8b949e] cursor-default'
            }`}>
            {selected ? "✕ O'rganish" : "O'rganish"}
          </button>
        )}
      </div>

      {showResults && (
        <ResultsModal results={buildResults()} onRetry={handleRetry}
          onFinish={handleFinishFromModal} onGoToQuestion={handleGoToQuestion} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
