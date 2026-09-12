/**
 * ⚡ Speed Round — server-authoritative 20 random questions × 10 seconds.
 *
 * Anti-scraping: savollar public full-bank store'dan olinmaydi. Session serverda
 * yaratiladi, client faqat rolling buffer oladi, correct option esa faqat
 * javobdan keyin authoritative answer response'da ochiladi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { X, Zap, Check, AlertTriangle } from 'lucide-react'
import { useAnswerTimer } from '../../shared/hooks/useAnswerTimer'
import { api, ApiError } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { Button } from '../../shared/components/ui/button'
import { ResultsModal, formatImageSrc, type QuestionResult } from '../test'
import type { DeliveredTestQuestion, TestSessionResponse } from '../../../shared/test-session'

const TIME_LIMIT = 10
type SpeedAnswer = 'correct' | 'wrong'

function clientToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function mergeQuestions(
  existing: DeliveredTestQuestion[],
  incoming: DeliveredTestQuestion[],
): DeliveredTestQuestion[] {
  const byPosition = new Map(existing.map((question) => [question.position, question]))
  for (const question of incoming) byPosition.set(question.position, question)
  return [...byPosition.values()].sort((a, b) => a.position - b.position)
}

export default function SpeedPage() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const applySessionAnswer = useAppStore((s) => s.applySessionAnswerMutation)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const lang = settings.language
  const tt = useT(lang)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [total, setTotal] = useState(20)
  const [questions, setQuestions] = useState<DeliveredTestQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<SpeedAnswer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [finished, setFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [earnedXpTotal, setEarnedXpTotal] = useState(0)
  const [earnedCoinsTotal, setEarnedCoinsTotal] = useState(0)
  const advanceTimerRef = useRef<number | null>(null)

  const q = questions.find((question) => question.position === idx)
  const answerTimer = useAnswerTimer(q?.position)
  const answered = selected !== null

  const startSession = useCallback(async (active: () => boolean = () => true) => {
    setLoading(true)
    setError(null)
    setFinished(false)
    setIdx(0)
    setAnswers([])
    setSelected(null)
    setRevealed(null)
    setTimeLeft(TIME_LIMIT)
    setEarnedXpTotal(0)
    setEarnedCoinsTotal(0)
    const response: TestSessionResponse = await api.createTestSession({
      subjectId,
      selector: { type: 'random', count: 20 },
      language: settings.language,
    })
    if (!active()) return
    setSessionId(response.session.id)
    setTotal(response.session.total)
    setQuestions(response.questions)
    setLoading(false)
  }, [settings.language, subjectId])

  useEffect(() => {
    api.warmUp()
    let active = true
    void startSession(() => active).catch((cause) => {
      if (!active) return
      if (cause instanceof ApiError && cause.code === 'premium_required') {
        navigate('/premium', { replace: true })
        return
      }
      setError(lang === 'ru' ? 'Быстрый тест не загрузился.' : 'Tezkor test yuklanmadi.')
      setLoading(false)
    })
    return () => {
      active = false
      if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current)
    }
  }, [lang, navigate, startSession])

  const addAnswer = useCallback((position: number, status: SpeedAnswer) => {
    setAnswers((previous) => {
      const next = [...previous]
      next[position] = status
      return next
    })
  }, [])

  const advance = useCallback((status: SpeedAnswer) => {
    addAnswer(idx, status)
    setSelected(null)
    setRevealed(null)
    if (idx + 1 >= total) {
      setFinished(true)
      if (sessionId) void api.finishTestSession(sessionId, 'completed').catch(() => undefined)
    } else {
      setIdx((value) => value + 1)
      setTimeLeft(TIME_LIMIT)
    }
  }, [addAnswer, idx, sessionId, total])

  const handleTimeout = useCallback(() => {
    if (busy || !q) return
    setSelected('__timeout__')
    playSound('error')
    haptics.error()
    advanceTimerRef.current = window.setTimeout(() => {
      advance('wrong')
    }, 500)
  }, [advance, busy, q])

  useEffect(() => {
    if (loading || finished || answered) return
    if (timeLeft <= 0) { handleTimeout(); return }
    const id = setTimeout(() => setTimeLeft((value) => value - 1), 1000)
    return () => clearTimeout(id)
  }, [answered, finished, handleTimeout, loading, timeLeft])

  const handleSelect = useCallback((optId: string) => {
    if (answered || busy || !q || !sessionId) return
    setSelected(optId)
    setBusy(true)
    void (async () => {
      try {
        const response = await api.submitTestSessionAnswer(sessionId, {
          position: q.position,
          deliveryToken: q.deliveryToken,
          expiresAt: q.expiresAt,
          selectedOptionId: optId,
          clientToken: clientToken(),
          elapsedMs: answerTimer.elapsed(),
        })
        setRevealed(response.attempt.correctOptionId)
        setQuestions((previous) => mergeQuestions(previous, response.append))
        if (!response.attempt.duplicate) {
          applySessionAnswer({
            correct: response.attempt.correct,
            subjectId,
            date: new Date().toISOString().slice(0, 10),
            dailyStreak: response.attempt.dailyStreak,
            coinSaved: response.attempt.coinSaved,
            coinBalance: response.attempt.coinBalance,
            xp: response.attempt.xp,
          })
          setEarnedXpTotal((previous) => previous + response.attempt.xpEarned)
          setEarnedCoinsTotal((previous) => previous + response.attempt.coinsEarned)
        }
        if (response.attempt.correct) {
          haptics.success()
          playSound('success')
        } else {
          haptics.error()
          playSound('error')
        }
        advanceTimerRef.current = window.setTimeout(() => {
          advance(response.attempt.correct ? 'correct' : 'wrong')
        }, 800)
      } catch {
        setError(lang === 'ru'
          ? 'Ответ не отправился. Попробуйте ещё раз.'
          : 'Javob yuborilmadi. Qayta urinib ko‘ring.')
        setSelected(null)
      } finally {
        setBusy(false)
      }
    })()
  }, [advance, answerTimer, answered, applySessionAnswer, busy, lang, q, sessionId, subjectId])

  const retry = useCallback(async () => {
    if (sessionId) await api.finishTestSession(sessionId, 'abandoned').catch(() => undefined)
    await startSession()
  }, [sessionId, startSession])

  const results: QuestionResult[] = useMemo(() =>
    Array.from({ length: total }, (_, i) => ({
      questionId: i + 1,
      status: (answers[i] === 'correct' ? 'correct' : answers[i] === 'wrong' ? 'incorrect' : 'unanswered') as QuestionResult['status'],
    })),
  [answers, total])

  const empty = !loading && !error && !q
  if (loading || error || empty) {
    return (
      <div className="flex flex-col min-h-screen bg-pcanvas font-display text-pfg">
        <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-pcanvas border-b border-pline">
          <div className="flex items-center justify-between px-4 py-2.5">
            <button onClick={() => goBack(navigate)} aria-label="Orqaga" className="text-pmuted p-1 hover:text-pfg transition-colors">
              <X size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Zap size={15} strokeWidth={1.75} className="text-pwarning" />
              <span className="text-sm font-semibold">{tt('speedRound')}</span>
            </div>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 py-12 gap-3 px-4 text-center">
          {error
            ? <AlertTriangle size={36} className="text-pdanger" />
            : empty
              ? <Zap size={36} className="text-pmuted opacity-50" />
              : <div className="size-9 animate-spin rounded-full border-2 border-pprimary border-t-transparent" />}
          <p className="text-sm text-pmuted">{error ?? (empty ? tt('speedQuestionsEmpty') : (lang === 'ru' ? 'Загрузка…' : 'Yuklanmoqda…'))}</p>
          {error
            ? <Button onClick={() => void retry()}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button>
            : null}
        </div>
      </div>
    )
  }

  const currentQuestion = q
  if (!currentQuestion) return null
  const R = 30
  const C = 2 * Math.PI * R
  const pct = timeLeft / TIME_LIMIT
  const ringColor = timeLeft <= 3 ? 'var(--p-danger)' : timeLeft <= 5 ? 'var(--p-warning)' : 'var(--p-primary)'
  const score = answers.filter((answer) => answer === 'correct').length

  if (finished) {
    return (
      <ResultsModal
        results={results}
        threshold={80}
        earnedXp={earnedXpTotal}
        earnedCoins={earnedCoinsTotal}
        onRetry={() => { void retry() }}
        onFinish={() => goBack(navigate)}
        onGoToQuestion={() => goBack(navigate)}
      />
    )
  }

  return (
    <div className="flex flex-col bg-pcanvas font-display text-pfg pb-6">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-pcanvas border-b border-pline">
        <div className="flex items-center justify-between px-4 py-2.5">
          <button onClick={() => goBack(navigate)} aria-label="Orqaga" className="text-pmuted p-1 hover:text-pfg transition-colors">
            <X size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={15} strokeWidth={1.75} className="text-pwarning" />
            <span className="text-sm font-semibold">{tt('speedRound')}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-pmuted">
            <Check size={12} strokeWidth={2} />
            {score} · {idx + 1}/{total}
          </span>
        </div>
      </header>

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

      {error && <div role="alert" className="mx-4 mt-3 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-4 py-3 text-sm text-pdanger">{error}</div>}

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6">
        <p className="text-[11px] font-semibold text-psubtle text-center mb-2 uppercase tracking-wide">
          {lang === 'ru' ? `${idx + 1} из ${total}` : `${idx + 1} / ${total}`}
        </p>
        <p className="text-base font-semibold leading-snug mb-4 text-center">{currentQuestion.text}</p>
        {currentQuestion.media && (
          <div className="rounded-2xl overflow-hidden mb-4 flex items-center justify-center bg-psurface shadow-xs">
            <img src={formatImageSrc(currentQuestion.media)} alt="savol" loading="lazy"
              className="max-w-full max-h-[40vh] w-auto h-auto object-contain" />
          </div>
        )}
        {currentQuestion.options.map((opt, i) => {
          const isRight = revealed !== null && opt.id === revealed
          const isChoice = selected === opt.id
          const showResult = answered && !busy
          const style =
            !showResult && isChoice ? 'bg-[rgb(var(--p-blue-rgb)/0.10)] ring-2 ring-pblue text-pfg motion-safe:animate-pulse' :
            !showResult            ? 'bg-pcard text-pfg hover:bg-psurface active:scale-[0.98]' :
            isRight                ? 'bg-pprimary/15 ring-2 ring-pprimary text-pfg' :
            isChoice               ? 'bg-pdanger/15 ring-2 ring-pdanger text-pdanger' :
                                     'bg-psurface text-pmuted'
          return (
            <button key={`${currentQuestion.position}_${opt.id}`} type="button" onClick={() => handleSelect(opt.id)} disabled={answered}
              className={`w-full text-left rounded-2xl p-3.5 mb-2.5 transition-all focus:outline-none shadow-xs ${style}`}>
              <div className="flex items-center gap-3">
                <span className="size-7 rounded-xl bg-psurface flex items-center justify-center text-xs font-semibold flex-shrink-0 shadow-2xs">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm">{opt.text}</span>
                {showResult && isRight && <Check size={16} strokeWidth={2} className="ml-auto flex-shrink-0 text-pprimary" />}
                {showResult && isChoice && revealed !== null && !isRight && <X size={16} strokeWidth={2} className="ml-auto flex-shrink-0 text-pdanger" />}
              </div>
            </button>
          )
        })}
        {answered && selected === '__timeout__' && (
          <p className="text-center text-[12px] text-pdanger font-semibold mt-2 animate-premiumIn">
            ⏱ {lang === 'ru' ? 'Время вышло!' : 'Vaqt tugadi!'}
          </p>
        )}
      </div>
    </div>
  )
}
