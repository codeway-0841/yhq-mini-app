import { useState, useCallback, useRef, useEffect } from 'react'
import type { Question, ApiSettings } from '../../../shared/api'
import type { SubmitResult } from '../../../shared/store/useAppStore'
import { onResultSync } from '../../../shared/lib/outbox'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'

interface UseTestAnswerFlowOptions {
  activeQuestions: Question[]
  current:         number
  settings?:       ApiSettings
  submitAnswer:    (questionId: number, selectedAnswer: string | null, elapsedMs?: number) => Promise<SubmitResult>
  answerTimer:     { elapsed: () => number }
  goTo:            (index: number) => void
  onToast:         (msg: string) => void
  pauseAutoNext?:  boolean
}

export function useTestAnswerFlow({
  activeQuestions,
  current,
  settings,
  submitAnswer,
  answerTimer,
  goTo,
  onToast,
  pauseAutoNext = false,
}: UseTestAnswerFlowOptions) {
  const [answers, setAnswers]                 = useState<(string | null)[]>(() => Array(activeQuestions.length).fill(null))
  const [selectedHistory, setSelectedHistory] = useState<(string | null)[]>(() => Array(activeQuestions.length).fill(null))
  const [correctOpts, setCorrectOpts]         = useState<(string | null)[]>(() => Array(activeQuestions.length).fill(null))
  const [submitting, setSubmitting]           = useState(false)
  const [coinPop, setCoinPop]                 = useState(0)
  const [earnedXpTotal, setEarnedXpTotal]     = useState(0)
  const [earnedCoinsTotal, setEarnedCoinsTotal] = useState(0)
  const [rewardedQuestionIds, setRewardedQuestionIds] = useState<number[]>([])

  const autoNextTimerRef = useRef<number | null>(null)
  const correctStreakRef = useRef(0)
  const pausedRef = useRef(pauseAutoNext)
  const rewardedQuestionIdsRef = useRef<Set<number>>(new Set())

  const cancelAutoNext = useCallback(() => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current)
      autoNextTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    pausedRef.current = pauseAutoNext
    if (pauseAutoNext) cancelAutoNext()
  }, [pauseAutoNext, cancelAutoNext])

  // Current savol o'zgarganda yoki unmount bo'lganda avtomatik o'tish taymerini tozalash (unmount-safe)
  useEffect(() => cancelAutoNext, [current, cancelAutoNext])

  const q = activeQuestions[current]
  const selected = selectedHistory[current] ?? null
  const answeredStatus = answers[current]
  const revealedId = correctOpts[current] ?? null

  const getOptionState = useCallback((optId: string) => {
    if (!selected) return 'default'
    if (revealedId) {
      if (optId === revealedId) return 'correct'
      if (optId === selected && selected !== revealedId) return 'wrong'
      return 'default'
    }
    if (optId === selected) {
      if (answeredStatus === 'correct') return 'correct'
      if (answeredStatus === 'wrong')   return 'wrong'
      return 'pending'
    }
    return 'default'
  }, [selected, revealedId, answeredStatus])

  const handleSelect = useCallback((optId: string) => {
    if (selected || submitting || !q) return
    const questionId = q.id
    const answeredIndex = current
    setSelectedHistory((prev) => { const next = [...prev]; next[answeredIndex] = optId; return next })
    setSubmitting(true)

    void (async () => {
      const outcome = await submitAnswer(questionId, optId, answerTimer.elapsed())
      setSubmitting(false)

      // Fatal (4xx) — rollback va xato toast
      if (outcome && 'fatal' in outcome) {
        setSelectedHistory((prev) => { const next = [...prev]; next[answeredIndex] = null; return next })
        onToast('submitFailed')
        return
      }

      const idx = activeQuestions.findIndex((x) => x.id === questionId)
      if (idx === -1) {
        onToast('notFoundQ')
        return
      }

      if (!outcome || outcome.correct === null || outcome.correctAnswer === null) {
        // Offline — pending holat va outbox toasti
        setAnswers((prev) => { const next = [...prev]; next[idx] = 'pending'; return next })
        onToast('offlineQueued')
        if (!pausedRef.current && (settings?.autoNextCorrect || settings?.autoNextWrong) && idx < activeQuestions.length - 1) {
          cancelAutoNext()
          autoNextTimerRef.current = window.setTimeout(() => {
            autoNextTimerRef.current = null
            goTo(idx + 1)
          }, 800)
        }
        return
      }

      const isCorrect = outcome.correct
      const revealed = outcome.correctAnswer
      setAnswers((prev) => { const next = [...prev]; next[idx] = isCorrect ? 'correct' : 'wrong'; return next })
      setCorrectOpts((prev) => { const next = [...prev]; next[idx] = revealed; return next })
      if (isCorrect) {
        haptics.success()
      } else {
        haptics.error()
      }

      // Deduplicate authoritative rewards by questionId
      if (!outcome.duplicate && !rewardedQuestionIdsRef.current.has(questionId)) {
        rewardedQuestionIdsRef.current.add(questionId)
        setRewardedQuestionIds((prev) => [...prev, questionId])
        if (outcome.xpEarned) {
          setEarnedXpTotal((prev) => prev + outcome.xpEarned!)
        }
        if (outcome.coinsEarned) {
          setEarnedCoinsTotal((prev) => prev + outcome.coinsEarned!)
        }
      }

      if (isCorrect) {
        correctStreakRef.current += 1
        playSound(correctStreakRef.current % 3 === 0 ? 'combo' : 'success')
        if ((outcome.coinsEarned ?? 0) > 0) {
          setCoinPop((k) => k + 1)
        }
      } else {
        correctStreakRef.current = 0
        playSound('error')
      }

      const delay = isCorrect
        ? (settings?.autoNextCorrect ? 800 : null)
        : (settings?.autoNextWrong ? 1200 : null)

      if (delay !== null && !pausedRef.current) {
        cancelAutoNext()
        autoNextTimerRef.current = window.setTimeout(() => {
          autoNextTimerRef.current = null
          goTo(idx + 1)
        }, delay)
      }
    })()
  }, [selected, submitting, q, current, submitAnswer, answerTimer, activeQuestions, onToast, settings, cancelAutoNext, goTo])

  // Offline paytida yuborilgan javob internet kelganda ekranda yangilanishi (va rewardlarni hisobga olish)
  useEffect(() => {
    return onResultSync((info) => {
      if (info.duplicate) return
      const idx = activeQuestions.findIndex((x) => x.id === info.questionId)
      if (idx !== -1) {
        setAnswers((prev) => {
          const next = [...prev]
          next[idx] = info.correct ? 'correct' : 'wrong'
          return next
        })
        if (info.correctAnswer) {
          setCorrectOpts((prev) => {
            const next = [...prev]
            next[idx] = info.correctAnswer!
            return next
          })
        }
        if (!rewardedQuestionIdsRef.current.has(info.questionId)) {
          rewardedQuestionIdsRef.current.add(info.questionId)
          setRewardedQuestionIds((prev) => [...prev, info.questionId])
          if (info.xpEarned) {
            setEarnedXpTotal((prev) => prev + info.xpEarned!)
          }
          if (info.coinsEarned) {
            setEarnedCoinsTotal((prev) => prev + info.coinsEarned!)
          }
        }
      }
    })
  }, [activeQuestions])

  const resetRewards = useCallback(() => {
    rewardedQuestionIdsRef.current.clear()
    setRewardedQuestionIds([])
    setEarnedXpTotal(0)
    setEarnedCoinsTotal(0)
  }, [])

  const restoreState = (
    rAnswers: (string | null)[],
    rSelected: (string | null)[],
    rCorrectOpts: (string | null)[],
    rEarnedXp = 0,
    rEarnedCoins = 0,
    rRewardedQuestionIds: number[] = [],
  ) => {
    setAnswers(rAnswers)
    setSelectedHistory(rSelected)
    setCorrectOpts(rCorrectOpts)
    setEarnedXpTotal(rEarnedXp)
    setEarnedCoinsTotal(rEarnedCoins)
    rewardedQuestionIdsRef.current = new Set(rRewardedQuestionIds)
    setRewardedQuestionIds([...rRewardedQuestionIds])
    setSubmitting(false)
  }

  const markAllUnanswered = () => {
    setAnswers((prev) => prev.map((a) => a ?? 'unanswered'))
  }

  return {
    answers,
    selectedHistory,
    correctOpts,
    submitting,
    coinPop,
    selected,
    answeredStatus,
    revealedId,
    earnedXpTotal,
    earnedCoinsTotal,
    rewardedQuestionIds,
    resetRewards,
    getOptionState,
    handleSelect,
    cancelAutoNext,
    restoreState,
    markAllUnanswered,
  }
}
