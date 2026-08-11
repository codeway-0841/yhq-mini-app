/**
 * ⚡ Speed Round — 20 tasodifiy savol × 10 SONIYA.
 * Vaqt tugasa — savol "xato" deb yozilib avtomatik keyingisiga o'tiladi.
 * Halqa timer: aksent → sariq (≤5s) → qizil (≤3s).
 * Natija — umumiy ResultsModal'da (animatsiyali DonutChart bilan).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { X, Zap } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { ResultsModal, type QuestionResult } from '../test'

const TIME_LIMIT = 10   // soniya / savol
const QUESTIONS  = 20

export default function SpeedPage() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS
  const settings = useAppStore((s) => s.settings)
  const submitAnswer = useAppStore((s) => s.submitAnswer)
  const questions = useQuestionsStore((s) => s.questions)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const lang = settings.language

  // 20 ta tasodifiy savol (sahifa ochilganda 1 marta tanlanadi)
  const qs = useMemo(() => {
    const pool = [...questions]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, QUESTIONS)
  }, [questions])

  const [idx, setIdx]           = useState(0)
  const [answers, setAnswers]   = useState<('correct' | 'wrong')[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  /** Server reveal: javobdan keyingina to'g'ri variant ko'rinadi */
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [finished, setFinished] = useState(false)
  const advanceTimerRef = useRef<number | null>(null)

  const q = qs[idx]
  const answered = selected !== null

  // Har savol uchun countdown — javob berilsa yoki vaqt tugasa to'xtaydi
  useEffect(() => {
    if (finished || answered) return
    if (timeLeft <= 0) { handleTimeout(); return }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, finished, answered])

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current)
  }, [])

  const advance = useCallback((isCorrect: boolean) => {
    setAnswers((a) => [...a, isCorrect ? 'correct' : 'wrong'])
    setSelected(null)
    setRevealed(null)
    if (idx + 1 >= qs.length) {
      setFinished(true)
    } else {
      setIdx((i) => i + 1)
      setTimeLeft(TIME_LIMIT)
    }
  }, [idx, qs.length])

  // Vaqt tugadi — javob berilmagan = xato, 700ms "to'g'ri javobni ko'rsat", keyin keyingi
  const handleTimeout = useCallback(() => {
    if (busy) return
    setBusy(true)
    setSelected('__timeout__')
    void (async () => {
      // selectedAnswer=null → server xato deb yozadi va reveal qaytaradi
      // (fatal rad etuvida reveal yo'q — jimgina keyingisiga o'tamiz)
      const outcome = q ? await submitAnswer(q.id, null) : null
      setBusy(false)
      if (outcome && !('fatal' in outcome)) setRevealed(outcome.correctAnswer)
      playSound('error')
      haptics.notify('error')
      advanceTimerRef.current = window.setTimeout(() => advance(false), 700)
    })()
  }, [advance, busy, q, submitAnswer])

  const handleSelect = useCallback((optId: string) => {
    if (answered || busy || !q) return
    setSelected(optId)   // timer to'xtaydi + tugmalar bloklanadi
    setBusy(true)
    void (async () => {
      // ASYNC FEEDBACK: to'g'rilikni SERVER hal qiladi (kalit client'da yo'q)
      const outcome = await submitAnswer(q.id, optId)
      setBusy(false)
      // Fatal (4xx) — javob saqlanmadi; reveal yo'q (offline kabi qisqa o'tamiz)
      const scored = outcome && !('fatal' in outcome) ? outcome : null
      if (scored) {
        setRevealed(scored.correctAnswer)
        haptics.notify(scored.correct ? 'success' : 'error')
        playSound(scored.correct ? 'success' : 'error')
      }
      // Offline/fatal: reveal yo'q — faqat tanlangan variant belgilanib qoladi
      advanceTimerRef.current = window.setTimeout(() => advance(scored?.correct ?? false), scored ? 800 : 400)
    })()
  }, [answered, busy, q, submitAnswer, advance])

  useEffect(() => { useSubjectStore.getState() }, [subjectId])

  if (!q) {
    return <div className="flex items-center justify-center min-h-screen text-pmuted">Yuklanmoqda...</div>
  }

  const R = 30, C = 2 * Math.PI * R
  const pct       = timeLeft / TIME_LIMIT
  const ringColor = timeLeft <= 3 ? '#ef4444' : timeLeft <= 5 ? '#f59e0b' : 'var(--p-primary)'
  const score     = answers.filter((a) => a === 'correct').length

  const results: QuestionResult[] = qs.map((question, i) => ({
    questionId: question.id,
    status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : 'unanswered') as QuestionResult['status'],
  }))

  if (finished) {
    return (
      <ResultsModal results={results} threshold={80}
        onRetry={() => { setIdx(0); setAnswers([]); setSelected(null); setTimeLeft(TIME_LIMIT); setFinished(false) }}
        onFinish={() => goBack(navigate)}
        onGoToQuestion={() => goBack(navigate)} />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-pcanvas font-display text-pfg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pline">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga" className="text-pmuted p-1">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-pwarning" fill="currentColor" />
          <span className="text-sm font-bold">Speed Round</span>
        </div>
        <span className="text-xs font-bold text-pmuted tabular-nums">
          ✓ {score} · {idx + 1}/{qs.length}
        </span>
      </div>

      {/* Timer halqasi */}
      <div className="flex justify-center pt-4 pb-1">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={R} fill="none" stroke="var(--p-line)" strokeWidth="6" />
          <circle cx="36" cy="36" r={R} fill="none" stroke={ringColor} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.3s ease' }} />
          <text x="36" y="41" textAnchor="middle" fill="var(--p-fg)" fontSize="18" fontWeight="800">
            {timeLeft}
          </text>
        </svg>
      </div>

      {/* Savol */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-24">
        <p className="text-[11px] font-semibold text-psubtle text-center mb-2 uppercase tracking-wide">
          {lang === 'ru' ? `${idx + 1} из ${qs.length}` : `${idx + 1} / ${qs.length}`}
        </p>
        <p className="text-base font-semibold leading-snug mb-4 text-center">{q.text}</p>
        {q.image && (
          <div className="rounded-xl overflow-hidden mb-4 border border-pline flex items-center justify-center bg-elevated">
            <img src={q.image} alt="savol" loading="lazy"
              className="max-w-full max-h-[40vh] w-auto h-auto object-contain" />
          </div>
        )}
        {q.options.map((opt) => {
          const isRight  = revealed !== null && opt.id === revealed
          const isChoice = selected === opt.id
          const showResult = answered && !busy
          const style =
            !showResult && isChoice ? 'bg-duo-blue/10 border-duo-blue/60 border-2 text-pfg animate-pulse' :
            !showResult            ? 'bg-surface border-pline text-pfg hover:border-duo-green/50 active:scale-[0.98]' :
            isRight                ? 'bg-duo-green/15 border-duo-green text-pfg' :
            isChoice               ? 'bg-duo-red/15 border-duo-red text-duo-red' :
                                     'bg-surface border-pline text-pmuted'
          return (
            <button key={opt.id} onClick={() => handleSelect(opt.id)} disabled={answered}
              className={`w-full text-left rounded-xl border-2 p-3.5 mb-2 transition-all ${style}`}>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full border border-current/30 flex items-center justify-center text-xs font-bold opacity-60 flex-shrink-0">
                  {opt.id}
                </span>
                <span className="text-sm">{opt.text}</span>
                {showResult && isRight && <span className="ml-auto text-duo-green font-black">✓</span>}
                {showResult && isChoice && revealed !== null && !isRight && <span className="ml-auto font-black">✗</span>}
              </div>
            </button>
          )
        })}
        {answered && selected === '__timeout__' && (
          <p className="text-center text-[12px] text-pdanger font-bold mt-2 animate-premiumIn">
            ⏱ {lang === 'ru' ? 'Время вышло!' : 'Vaqt tugadi!'}
          </p>
        )}
      </div>
    </div>
  )
}
