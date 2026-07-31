import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Bookmark, Share2, Flag, Settings,
  Volume2, Video, BookOpen, MessageCircle,
  RotateCcw, BarChart2,
} from 'lucide-react'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import SettingsModal from '../../shared/components/SettingsModal'
import { haptics } from '../../lib/haptics'
import { shareUrl } from '../../lib/telegram'

function useTimer(onTimeUp: () => void, resetKey: unknown): string {
  const [seconds, setSeconds] = useState(25 * 60)
  const onTimeUpRef = useRef(onTimeUp)
  const firedRef    = useRef(false)

  useEffect(() => { onTimeUpRef.current = onTimeUp }, [onTimeUp])

  useEffect(() => {
    firedRef.current = false
    setSeconds(25 * 60)
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (!firedRef.current) {
            firedRef.current = true
            setTimeout(() => onTimeUpRef.current(), 0)
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [resetKey])

  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function DonutChart({ correct, total }: { correct: number; total: number }) {
  const r             = 52
  const cx            = 70
  const cy            = 70
  const circumference = 2 * Math.PI * r
  const percent       = total > 0 ? Math.round((correct / total) * 100) : 0
  const correctArc    = total > 0 ? (correct / total) * circumference : 0
  const wrongArc      = circumference - correctArc
  const passed        = percent >= 90

  return (
    <div className="relative w-40 h-40 mx-auto my-4">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#21262d" strokeWidth="14" />
        {wrongArc > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth="14"
            strokeDasharray={`${wrongArc} ${circumference}`}
            strokeDashoffset={-correctArc} />
        )}
        {correctArc > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22c55e" strokeWidth="14"
            strokeDasharray={`${correctArc} ${circumference}`}
            strokeDashoffset={0} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white">{percent}%</span>
        <span className={`text-sm font-bold mt-0.5 ${passed ? 'text-green-400' : 'text-red-400'}`}>
          {passed ? "O'tdi ✓" : "O'tmadi ✗"}
        </span>
      </div>
    </div>
  )
}

type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

function ResultsModal({ results, onRetry, onFinish, onGoToQuestion }: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
}) {
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full bg-[#161b22] rounded-t-3xl border-t border-[#30363d] p-5 pb-10 max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-[#30363d] rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">Natijalar</h2>
        <DonutChart correct={correct} total={total} />

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-xl bg-green-900/30 border border-green-700/40 p-3 text-center">
            <p className="text-2xl font-black text-green-400">{correct}</p>
            <p className="text-[11px] text-green-300/70 mt-0.5">✓ To'g'ri</p>
          </div>
          <div className="rounded-xl bg-red-900/30 border border-red-700/40 p-3 text-center">
            <p className="text-2xl font-black text-red-400">{wrong}</p>
            <p className="text-[11px] text-red-300/70 mt-0.5">✗ Noto'g'ri</p>
          </div>
          <div className="rounded-xl bg-[#21262d] border border-[#30363d] p-3 text-center">
            <p className="text-2xl font-black text-[#8b949e]">{unanswered}</p>
            <p className="text-[11px] text-[#8b949e]/70 mt-0.5">— Javobsiz</p>
          </div>
        </div>

        <p className="text-sm font-bold mb-3">Savollar</p>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {results.map((r, i) => (
            <button key={r.questionId} onClick={() => onGoToQuestion(i)}
              className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-green-600 text-white' :
                r.status === 'incorrect' ? 'bg-red-700 text-white'   :
                                           'bg-[#21262d] text-[#8b949e]'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry}
            className="flex-1 py-3.5 rounded-xl bg-[#21262d] text-[#e6edf3] font-semibold flex items-center justify-center gap-2">
            <RotateCcw size={16} />
            Qayta
          </button>
          <button onClick={onFinish}
            className="flex-[2] py-3.5 rounded-xl bg-green-600 text-white font-bold text-base">
            Yakunlash
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionStrip({ total, current, answers, onSelect }: {
  total: number; current: number
  answers: (string | null)[]
  onSelect: (i: number) => void
}) {
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stripRef.current?.children[current]
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [current])

  return (
    <div ref={stripRef}
      className="flex gap-1.5 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}>
      {Array.from({ length: total }, (_: unknown, i: number) => {
        const ans       = answers[i]
        const isCurrent = i === current
        let bg = 'bg-[#21262d] border border-[#30363d]'
        if (ans === 'correct')    bg = 'bg-green-600 border-green-500'
        else if (ans === 'wrong') bg = 'bg-red-700 border-red-600'
        const ring = isCurrent ? 'ring-2 ring-[#1f6feb] ring-offset-1 ring-offset-[#0d1117]' : ''
        return (
          <button key={i} onClick={() => onSelect(i)}
            className={`flex-none w-8 h-8 rounded-lg text-xs font-bold transition-all ${bg} ${ring}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}

type Option = { id: string; text: string }

function OptionButton({ option, state, onSelect, answered, fontSize }: {
  option: Option
  state: 'correct' | 'wrong' | 'default'
  onSelect: () => void
  answered: boolean
  fontSize: string
}) {
  const base = 'w-full text-left rounded-xl border p-3 transition-all active:scale-[0.98]'
  let style  = 'bg-[#161b22] border-[#30363d] text-[#e6edf3]'
  let icon   = null

  if (state === 'correct') {
    style = 'bg-green-900/60 border-green-500 text-white'
    icon  = <span className="text-green-400 font-bold">✓</span>
  } else if (state === 'wrong') {
    style = 'bg-red-900/60 border-red-500 text-white'
    icon  = <span className="text-red-400 font-bold">✗</span>
  }

  const fontClass =
    fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <div className="mb-2">
      <button className={`${base} ${style}`} onClick={onSelect} disabled={answered}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex-none w-7 h-7 rounded-full border border-current/40 flex items-center justify-center text-xs font-bold opacity-70">
              {option.id}
            </span>
            <span className={fontClass}>{option.text}</span>
          </div>
          {icon}
        </div>
      </button>

      {answered && (state === 'correct' || state === 'wrong') && (
        <div className="flex gap-2 mt-1 px-1">
          {[
            { icon: Volume2,       label: 'Ovozli'   },
            { icon: Video,         label: 'Video'    },
            { icon: BookOpen,      label: 'Qoidasi'  },
            { icon: MessageCircle, label: 'Muhokama' },
          ].map(({ icon: Icon, label }) => (
            <button key={label} disabled title="Tez kunda"
              className="flex items-center gap-1 text-[11px] text-[#8b949e]/60 bg-[#21262d] px-2 py-1 rounded-lg cursor-not-allowed">
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
