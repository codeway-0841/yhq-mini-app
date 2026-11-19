import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2, ChevronDown, ChevronLeft, Dumbbell, Flag, Lock, RefreshCw, RotateCcw, X, XCircle, Zap,
} from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import ModalShell from '../../shared/components/ModalShell'
import { useAppStore } from '../../shared/store/useAppStore'
import { useDailyStore, isSubjectExtendedOnDate, selectDailyCharges, todayStr } from '../../shared/store/useDailyStore'
import { useT, type Keys } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { ApiError, api, type LeagueWeekly } from '../../shared/api'
import { leaderboardPageCaches } from '../../shared/lib/leaderboard-cache'
import { track } from '../../shared/lib/analytics'
import type { AchievementDef } from '../../shared/config/achievements'
import { checkAndCelebrateAchievements } from '../../shared/lib/achievement-detector'
import { useAchievementCelebrationStore } from '../../shared/store/useAchievementCelebrationStore'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { speak, stopSpeaking, isSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { PathMascot } from '../lessons'
import {
  BRILLIANT_LEAGUES,
  LeagueShield,
  getDaysLeftInWeek,
  resolveBrilliantLeagueId,
} from '../profile'
import { BrilliantEndstateShell } from '../../shared/components/BrilliantEndstateShell'
import {
  BrilliantConfettiBurstIcon,
  BrilliantMissedTargetIcon,
} from '../../shared/components/BrilliantPracticeChrome'
import {
  BrilliantChargeStage,
  BrilliantCompletionStage,
  BrilliantLeagueStage,
  BrilliantPracticeNudgeStage,
  BrilliantStreakStage,
  buildLeagueClimb,
  splitLessonPhases,
} from '../../shared/components/BrilliantCompletionContent'
import LessonExercise from './LessonExercise'
import './rus-lesson-feedback.css'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import {
  DARSLIK_LESSON_XP_MAX,
  isDarslikPublicAnswerComplete,
  type DarslikAnswerFeedback,
  type DarslikAnswerValue,
  type DarslikAnswers,
  type DarslikCheckResult,
  type DarslikPublicCheck,
  type DarslikPublicExercise,
} from '../../../shared/darslik-mastery'

type LoadError = 'locked' | 'unavailable' | 'network'
type Phase = 'exercise' | 'feedback'
type EndstateStep = 'lesson' | 'streak' | 'charge' | 'league' | 'nudge'

const EXERCISE_LABEL: Record<DarslikPublicExercise['kind'], Keys> = {
  mcq: 'rusDarslikExerciseMcq',
  input: 'rusDarslikExerciseInput',
  word_bank: 'rusDarslikExerciseWordBank',
  match: 'rusDarslikExerciseMatch',
  listening: 'rusDarslikExerciseListening',
}

function classifyError(error: unknown): LoadError {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'locked'
    if (error.status >= 500 || error.status === 408 || error.status === 429) return 'unavailable'
  }
  return 'network'
}

interface LessonRunnerProps {
  topicId: string
  title: string
  mode?: 'lesson' | 'practice'
  onClose: () => void
  /** Server testdan o'tilganda (bir marta) */
  onPassed: () => void
  onNext?: () => void
  onOpenPremium?: () => void
  hasNext: boolean
  /** Server 403 qaytardi — progress eskirgan bo'lishi mumkin */
  onLocked?: () => void
  /** Kontent yuklanib tayyor bo'lganda (Warm-up parda ochilishi uchun) */
  onReady?: () => void
}

function answerOrEmpty(exercise: DarslikPublicExercise): DarslikAnswerValue {
  if (exercise.kind === 'word_bank' || exercise.kind === 'match') return []
  return ''
}

function answerText(exercise: DarslikPublicExercise, value: DarslikAnswerValue | undefined): string {
  if (value === undefined) return '—'
  if (exercise.kind === 'mcq' || exercise.kind === 'listening') {
    const index = Number(Array.isArray(value) ? value[0] : value)
    return Number.isInteger(index) ? exercise.options[index] ?? '—' : '—'
  }
  if (exercise.kind === 'match') {
    const selection = Array.isArray(value) ? value : []
    return exercise.left.map((left, index) => left + ' → ' + (selection[index] || '—')).join('; ')
  }
  return Array.isArray(value) ? value.join(' ') : value
}

function practiceDotForIndex(index: number, total: number, dotCount: number): number {
  if (total <= 0 || dotCount <= 1) return 0
  return Math.min(dotCount - 1, Math.floor((index * dotCount) / total))
}

function deriveMicroHint(
  exercise: DarslikPublicExercise,
  feedback: DarslikAnswerFeedback,
  tt: (key: Keys) => string,
): string {
  if (feedback.hint?.trim()) return feedback.hint.trim()
  const raw = feedback.explanation?.trim() ?? ''
  const firstSentence = raw.split(/(?<=[.!?])\s+/)[0]?.trim() ?? ''
  const ans = feedback.correctAnswer.trim().toLowerCase()
  const leaksAnswer = ans.length > 1 && firstSentence.toLowerCase().includes(ans)
  if (firstSentence.length > 15 && !leaksAnswer) return firstSentence

  switch (exercise.kind) {
    case 'input':
      return tt('rusDarslikHintInput')
    case 'word_bank':
      return tt('rusDarslikHintWordBank')
    case 'match':
      return tt('rusDarslikHintMatch')
    case 'mcq':
    case 'listening':
      return tt('rusDarslikHintMcq')
  }
}

/**
 * Yagona dars oqimi: yuklash → mashqlar → darhol feedback → natija.
 *
 * v2 (format: 'lesson') — bitta mashqdan iborat qadamlar, combo, progress,
 * natija ekranida aniqlik/XP/streak. v1 (format: 'legacy') — eski 2 MCQ + 1
 * input oqimi saqlanadi: barcha savol bir sahifada, yakunda bitta submit.
 * Shu tufayli 537 mavzuning qolganlari va eski fallback bloklanmaydi.
 */
export default function LessonRunner({
  topicId,
  title,
  mode = 'lesson',
  onClose,
  onPassed,
  onNext,
  onOpenPremium,
  hasNext,
  onLocked,
  onReady,
}: LessonRunnerProps) {
  const isPractice = mode === 'practice'
  const lang = useAppStore((state) => state.settings.language)
  const tariff = useAppStore((state) => state.tariff)
  const userId = useAppStore((state) => state.user?.id) ?? '0'
  const storeLeague = useAppStore((state) => state.league)
  const tt = useT(lang)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const onLockedRef = useRef(onLocked)
  onLockedRef.current = onLocked
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const passedNotified = useRef(false)
  const startedTracked = useRef(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const feedbackRef = useRef<HTMLDivElement | null>(null)

  const [check, setCheck] = useState<DarslikPublicCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<LoadError | null>(null)
  const [reload, setReload] = useState(0)
  const [answers, setAnswers] = useState<DarslikAnswers>({})
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('exercise')
  const [showReview, setShowReview] = useState(false)
  const [feedback, setFeedback] = useState<DarslikAnswerFeedback | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [stepOutcomes, setStepOutcomes] = useState<Record<number, 'correct' | 'wrong'>>({})
  const [reported, setReported] = useState<Record<string, boolean>>({})
  const [checking, setChecking] = useState(false)
  const [answerError, setAnswerError] = useState(false)
  const [combo, setCombo] = useState(0)
  const [earnedLessonXp, setEarnedLessonXp] = useState(0)
  const [lastCheckXp, setLastCheckXp] = useState(0)
  const [endstateIdx, setEndstateIdx] = useState(0)
  const [streakGlow, setStreakGlow] = useState(false)
  const [weeklyLeague, setWeeklyLeague] = useState<LeagueWeekly | null>(() => leaderboardPageCaches.weekly.peek())
  const preLessonScoreRef = useRef<number | null>(null)
  const [sessionXpDelta, setSessionXpDelta] = useState(0)
  const [endstateStreak, setEndstateStreak] = useState<{
    streak: number
    showCharge: boolean
    charges: number
    chargeSaved: boolean
    chargeEarned: boolean
  } | null>(null)
  const pendingAchievementsRef = useRef<AchievementDef[]>([])
  const completionFlushedRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [result, setResult] = useState<DarslikCheckResult | null>(null)
  const [speaking, setSpeaking] = useState(false)
  /** Admin darsni o'rtada regeneratsiya qildi — yangi versiya yuklandi. */
  const [checkUpdated, setCheckUpdated] = useState(false)

  const lesson = check?.format === 'lesson'
  const total = check?.questions.length ?? 0
  const { phase1Count, phase2Count } = useMemo(() => splitLessonPhases(total, Boolean(lesson) && !isPractice), [isPractice, lesson, total])
  const isPhase2 = Boolean(lesson && phase2Count > 0 && index >= phase1Count)
  const isCheckpointStep = Boolean(lesson && (isPractice || isPhase2))
  const dotIdx = isPhase2 ? index - phase1Count : -1
  const current = check?.questions[index]
  const currentAnswered = current ? isDarslikPublicAnswerComplete(current, answers[current.id]) : false

  const requestClose = useCallback(() => {
    if (lesson && check && !result && !loadError && !loading) {
      setShowExitConfirm(true)
      return
    }
    onClose()
  }, [check, lesson, loadError, loading, onClose, result])
  closeRef.current = requestClose

  useEffect(() => {
    const id = Symbol('rus-lesson-runner')
    return registerModal(id, () => closeRef.current())
  }, [])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showExplanation && !showExitConfirm) {
        event.preventDefault()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [showExplanation, showExitConfirm])

  useEffect(() => subscribeSpeaking(() => setSpeaking(isSpeaking())), [])
  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => {
    setCheckUpdated(false)
  }, [topicId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setCheck(null)
    setResult(null)
    setAnswers({})
    setIndex(0)
    setPhase('exercise')
    setFeedback(null)
    setRevealed(false)
    setShowExplanation(false)
    setShowExitConfirm(false)
    setStepOutcomes({})
    setReported({})
    setEndstateIdx(0)
    setStreakGlow(false)
    setEndstateStreak(null)
    setSessionXpDelta(0)
    setShowReview(false)
    setAnswerError(false)
    setSubmitError(false)
    setCombo(0)
    setEarnedLessonXp(0)
    setLastCheckXp(0)
    pendingAchievementsRef.current = []
    completionFlushedRef.current = false
    startedTracked.current = false
    passedNotified.current = false

    if (userId && userId !== '0') {
      leaderboardPageCaches.weekly.fetch(userId)
        .then((data) => {
          if (cancelled) return
          setWeeklyLeague(data)
          const youRow = data.entries.find((e) => e.isYou || e.userId === userId)
          if (youRow && preLessonScoreRef.current === null) {
            preLessonScoreRef.current = youRow.score
          }
        })
        .catch(() => {})
    }

    api.getDarslikCheck(topicId)
      .then((loaded) => {
        if (cancelled) return
        setCheck(loaded)
        onReadyRef.current?.()
        if (!startedTracked.current) {
          startedTracked.current = true
          track('lesson_start', {
            topic_id: topicId,
            format: loaded.format === 'lesson' ? 'lesson' : 'legacy',
            total: loaded.questions.length,
          })
        }
      })
      .catch((error) => {
        if (cancelled) return
        const kind = classifyError(error)
        setLoadError(kind)
        if (kind === 'locked') onLockedRef.current?.()
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [topicId, reload, userId])

  // Yangi mashqda scroll tepaga va sarlavhaga fokus (klaviatura/screen reader).
  useEffect(() => {
    if (scrollRef.current && typeof scrollRef.current.scrollTo === 'function') {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' })
    }
    headingRef.current?.focus({ preventScroll: true })
  }, [index])

  const setAnswer = useCallback((value: DarslikAnswerValue) => {
    if (!current) return
    setAnswers((previous) => ({ ...previous, [current.id]: value }))
    setAnswerError(false)
    setSubmitError(false)
  }, [current])

  const submit = useCallback(async () => {
    if (!check || submitting) return
    const complete = check.questions.every(question => isDarslikPublicAnswerComplete(question, answers[question.id]))
    if (!complete) {
      setSubmitError(true)
      return
    }
    setSubmitting(true)
    setSubmitError(false)
    try {
      const graded = check.revision
        ? await api.submitDarslikCheck(topicId, answers, check.revision)
        : await api.submitDarslikCheck(topicId, answers)
      setResult(graded)
      setEndstateIdx(0)
      setStreakGlow(false)
      track('lesson_complete', {
        topic_id: topicId,
        format: lesson ? (isPractice ? 'practice' : 'lesson') : 'legacy',
        correct: graded.correct,
        total: graded.total,
      })
      if (graded.passed) {
        track('check_passed', { topic_id: topicId, correct: graded.correct, total: graded.total })
        playSound('endstate')
        haptics.success()
        if (!passedNotified.current) {
          passedNotified.current = true
          onPassed()
        }
        setSessionXpDelta(graded.xpEarned ?? (earnedLessonXp || 0))
        if (typeof graded.xp === 'number') useAppStore.setState({ xp: graded.xp })
        if (typeof graded.dailyStreak === 'number') {
          const today = todayStr()
          const alreadyDone = isSubjectExtendedOnDate(useDailyStore.getState(), today, RUSSIAN_SUBJECT_ID)
          const charges = graded.streakCharges ?? selectDailyCharges(useDailyStore.getState(), RUSSIAN_SUBJECT_ID)
          const showCharge = Boolean(graded.chargeSaved || graded.chargeEarned || charges > 0)
          if (!alreadyDone && graded.dailyStreak > 0) {
            setEndstateStreak({
              streak: graded.dailyStreak,
              showCharge,
              charges,
              chargeSaved: Boolean(graded.chargeSaved),
              chargeEarned: Boolean(graded.chargeEarned),
            })
          }
          useDailyStore.getState().applyServerResult(
            today,
            RUSSIAN_SUBJECT_ID,
            graded.dailyStreak,
            {
              suppressCelebration: true,
              chargeSaved: graded.chargeSaved,
              chargeEarned: graded.chargeEarned,
              streakCharges: graded.streakCharges,
            },
          )
        }
        // Dars yakuni ekrani ustiga yutuq oynasi chiqib ketmasligi uchun yakun tugmasigacha kechiktiriladi.
        completionFlushedRef.current = false
        pendingAchievementsRef.current = []
        const userId = useAppStore.getState().user?.id
        if (userId && userId !== '0') {
          void api.getAchievements(userId)
            .then(({ stats }) => {
              const unlocked = checkAndCelebrateAchievements(stats, { deferCelebration: true })
              if (unlocked.length === 0) return
              if (completionFlushedRef.current) {
                useAchievementCelebrationStore.getState().triggerCelebration(unlocked)
              } else {
                pendingAchievementsRef.current = [...pendingAchievementsRef.current, ...unlocked]
              }
            })
            .catch(() => { /* yutuq tekshiruvi dars natijasini buzmaydi */ })
        }
      } else {
        track('check_failed', { topic_id: topicId, correct: graded.correct, total: graded.total })
        playSound('lesson-failed')
        haptics.error()
      }
      setPhase('feedback')
      if (scrollRef.current && typeof scrollRef.current.scrollTo === 'function') {
        scrollRef.current.scrollTo({ top: 0, behavior: 'auto' })
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLoadError('locked')
        onLockedRef.current?.()
        return
      }
      if (error instanceof ApiError && error.status === 409) {
        // Kontent o'rtada yangilandi: eski javoblar yangi savollarga mos emas.
        setCheckUpdated(true)
        setReload((value) => value + 1)
        return
      }
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }, [answers, check, earnedLessonXp, isPractice, lesson, onPassed, submitting, topicId])

  const checkAnswer = useCallback(async () => {
    const value = current ? answers[current.id] : undefined
    if (!current || value === undefined || !currentAnswered || checking || phase !== 'exercise') return
    setChecking(true)
    setAnswerError(false)
    try {
      const graded = check.revision
        ? await api.checkDarslikExercise(topicId, current.id, value, check.revision)
        : await api.checkDarslikExercise(topicId, current.id, value)
      setFeedback(graded)
      setPhase('feedback')
      setStepOutcomes((previous) => ({ ...previous, [index]: graded.correct ? 'correct' : 'wrong' }))
      const stepXp = graded.xpEarned ?? 0
      setLastCheckXp(stepXp)
      if (typeof graded.xp === 'number') useAppStore.setState({ xp: graded.xp })
      if (stepXp > 0) {
        setEarnedLessonXp((previous) => Math.min(DARSLIK_LESSON_XP_MAX, previous + stepXp))
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          try { feedbackRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) } catch { /* eski webview */ }
        })
      }
      const nextCombo = graded.correct ? combo + 1 : 0
      setCombo(nextCombo)
      if (graded.correct) {
        playSound('correct')
        haptics.success()
      } else {
        playSound('incorrect')
        haptics.error()
      }
      track('exercise_answer', {
        topic_id: topicId,
        kind: current.kind,
        index,
        correct: graded.correct,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLoadError('locked')
        onLockedRef.current?.()
        return
      }
      if (error instanceof ApiError && error.status === 409) {
        setCheckUpdated(true)
        setReload((value) => value + 1)
        return
      }
      setAnswerError(true)
    } finally {
      setChecking(false)
    }
  }, [answers, check, checking, combo, current, currentAnswered, index, phase, topicId])

  const continueLesson = useCallback(() => {
    if (!check) return
    if (index + 1 >= check.questions.length) {
      void submit()
      return
    }
    stopSpeaking()
    setIndex((value) => value + 1)
    setPhase('exercise')
    setFeedback(null)
    setLastCheckXp(0)
    setRevealed(false)
    setShowExplanation(false)
    setAnswerError(false)
  }, [check, index, submit])

  const retry = useCallback(() => {
    stopSpeaking()
    setAnswers({})
    setIndex(0)
    setPhase('exercise')
    setFeedback(null)
    setRevealed(false)
    setShowExplanation(false)
    setShowExitConfirm(false)
    setStepOutcomes({})
    setReported({})
    setEndstateIdx(0)
    setStreakGlow(false)
    setEndstateStreak(null)
    setSessionXpDelta(0)
    setResult(null)
    setAnswerError(false)
    setSubmitError(false)
    setCombo(0)
    setEarnedLessonXp(0)
    setLastCheckXp(0)
    pendingAchievementsRef.current = []
    completionFlushedRef.current = false
    passedNotified.current = false
  }, [])

  const playAudio = useCallback((text: string) => {
    speak(text, 'ru')
  }, [])

  const legacyAnswered = useMemo(
    () => Boolean(check && check.questions.every(question => isDarslikPublicAnswerComplete(question, answers[question.id]))),
    [answers, check],
  )

  const phase1ProgressPct = useMemo(() => {
    if (total <= 0) return 0
    if (phase2Count === 0) {
      return Math.round(((index + (phase === 'feedback' ? 1 : 0)) / Math.max(1, total)) * 100)
    }
    if (isPhase2) return 100
    return Math.round(((index + (phase === 'feedback' ? 1 : 0)) / Math.max(1, phase1Count)) * 100)
  }, [index, isPhase2, phase, phase1Count, phase2Count, total])

  const practiceDotCount = Math.min(3, Math.max(1, total))
  const currentPracticeDot = practiceDotForIndex(index, total, practiceDotCount)

  const header = lesson && check && !result ? (
    <header className="rus-lesson-header pt-[calc(0.625rem+var(--safe-top,0px))]">
      <button type="button" onClick={requestClose} aria-label={tt('rusDarslikQuizClose')} className="rus-lesson-close"><X size={24} /></button>
      {!isPractice && (
        <div className="rus-lesson-progress" role="progressbar" aria-label={tt('rusDarslikLessonProgress')}
          aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (phase === 'feedback' ? 1 : 0)}>
          <span style={{ width: `${Math.max(4, phase1ProgressPct)}%` }} />
        </div>
      )}
      <span className="sr-only">{Math.min(index + 1, total)}/{total}</span>
      {combo >= 2 && <span className="sr-only" data-testid="lesson-combo">{tt('rusDarslikLessonCombo').replace('{count}', String(combo))}</span>}
      <span
        className={cn('rus-lesson-dots', isPractice && 'rus-practice-dots')}
        aria-hidden="true"
        data-phase2={isCheckpointStep ? 'true' : undefined}
      >
        {isPractice
          ? Array.from({ length: practiceDotCount }, (_, dot) => {
              const indices = Array.from({ length: total }, (__, qIdx) => qIdx).filter(
                (qIdx) => practiceDotForIndex(qIdx, total, practiceDotCount) === dot,
              )
              const hasWrong = indices.some((qIdx) => stepOutcomes[qIdx] === 'wrong')
              const allCorrect = indices.length > 0 && indices.every((qIdx) => stepOutcomes[qIdx] === 'correct')
              const status = hasWrong ? 'wrong' : allCorrect ? 'correct' : undefined
              return (
                <i
                  key={dot}
                  data-status={status}
                  data-current={currentPracticeDot === dot ? 'true' : undefined}
                />
              )
            })
          : (phase2Count > 0 ? Array.from({ length: phase2Count }, (_, d) => d) : [0, 1, 2]).map((dot) => (
              <i
                key={dot}
                data-status={phase2Count > 0 ? stepOutcomes[phase1Count + dot] : (combo >= dot + 1 ? 'correct' : undefined)}
                data-current={phase2Count > 0 && isPhase2 && dotIdx === dot ? 'true' : undefined}
              />
            ))}
      </span>
      <Zap size={16} strokeWidth={2.2} className="rus-lesson-lightning" data-hot={isCheckpointStep && (!isPractice || index > 0 || phase === 'feedback') || combo >= 2 ? 'true' : undefined} aria-hidden="true" />
    </header>
  ) : (
    <div className="bg-pcanvas px-3.5 py-2.5 pt-[calc(0.625rem+var(--safe-top,0px))]">
      <div className="mx-auto flex w-full max-w-[520px] items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={tt('rusDarslikQuizClose')}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center text-pfg hover:opacity-80 active:scale-90 transition-transform focus-visible:outline-none"
        >
          <ChevronLeft size={21} strokeWidth={2.25} />
        </button>

        {lesson && check && !result ? (
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="sr-only">{tt('rusDarslikLessonTitle')}</h2>
                <p className="truncate text-[11.5px] font-bold text-pmuted">{title}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {combo >= 2 && (
                  <span
                    data-testid="lesson-combo"
                    className="flex shrink-0 items-center rounded-full bg-[rgb(var(--p-warning-rgb)/0.16)] px-2.5 py-0.5 text-[10.5px] font-extrabold text-pwarning"
                  >
                    {tt('rusDarslikLessonCombo').replace('{count}', String(combo))}
                  </span>
                )}
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    onClick={() => {
                      setEarnedLessonXp(25)
                      setResult({
                        passed: true,
                        correct: total || 5,
                        total: total || 5,
                        feedback: [],
                        accuracy: 100,
                        xpEarned: 25,
                        lessonXpEarned: 25,
                        dailyStreak: 3,
                      })
                    }}
                    className="shrink-0 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 hover:bg-amber-500/30 transition-colors"
                    title="Dev: Yakunni ko'rish (yechmasdan)"
                  >
                    ⚡ Yakun
                  </button>
                )}
                <span className="rounded-full bg-psurface px-2 py-0.5 text-[11px] font-bold tabular-nums text-pmuted">
                  {Math.min(index + 1, total)}/{total}
                </span>
              </div>
            </div>

            <div
              className="h-2 w-full overflow-hidden rounded-full bg-psurface"
              role="progressbar"
              aria-label={tt('rusDarslikLessonProgress')}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={index + (phase === 'feedback' ? 1 : 0)}
            >
              <div
                className="h-full rounded-full bg-psuccess transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(8, phase1ProgressPct)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold leading-tight text-pfg">
              {lesson ? tt('rusDarslikLessonTitle') : tt('rusDarslikQuizTitle')}
            </h2>
            <p className="truncate text-[11.5px] font-medium text-pmuted">{title}</p>
          </div>
        )}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-pcanvas">
        <span className="size-8 animate-spin rounded-full border-3 border-pprimary border-t-transparent" />
      </div>
    )
  }

  if (loadError) {
    const locked = loadError === 'locked'
    const message = locked
      ? tt('rusDarslikCheckLocked')
      : loadError === 'unavailable'
        ? tt('rusDarslikCheckUnavailable')
        : tt('rusDarslikCheckNetwork')
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-pcanvas" data-testid="topic-check" data-error={loadError} role="dialog" aria-modal="true">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className={cn(
            'grid size-16 place-items-center rounded-3xl shadow-xs',
            locked ? 'bg-pcard text-pmuted' : 'bg-[rgb(var(--p-warning-rgb)/0.14)] text-pwarning',
          )}>
            {locked ? <Lock size={30} strokeWidth={2.2} /> : <XCircle size={30} strokeWidth={2.2} />}
          </span>
          <h3 className="text-[18px] font-bold text-pfg">
            {locked ? tt('rusDarslikCheckLockedTitle') : tt('rusDarslikQuizUnavailable')}
          </h3>
          <p className="max-w-[330px] text-[13px] leading-relaxed text-pmuted">{message}</p>
          <div className="mt-2 flex w-full max-w-[330px] flex-col gap-2">
            {!locked && (
              <Button size="lg" block onClick={() => setReload((value) => value + 1)}>
                <RefreshCw size={18} strokeWidth={2.25} />
                {tt('rusDarslikQuizRetry')}
              </Button>
            )}
            <Button size="lg" variant={locked ? 'default' : 'secondary'} block onClick={onClose}>
              {tt('rusDarslikQuizBackToTopic')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!check) return null

  if (result) {
    const accuracyPct = Math.round((result.correct / Math.max(1, result.total)) * 100)
    const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'
    const blockNum = Number(topicId.split(':')[0])
    const colorVariant = Number.isFinite(blockNum) && blockNum > 0 ? (blockNum - 1) % 6 : 0
    const isRu = lang === 'ru'

    const heading = result.passed
      ? (lesson ? (isPractice ? tt('rusDarslikPracticePassed') : tt('rusDarslikLessonPassed')) : tt('rusDarslikQuizPassed'))
      : (lesson ? tt('rusDarslikLessonFailed') : tt('rusDarslikQuizFailed'))

    const totalLessonXp = result.lessonXpEarned ?? (earnedLessonXp || result.xpEarned || 0)
    const leagueClimb = !isPractice
      ? buildLeagueClimb(weeklyLeague, userId, sessionXpDelta, preLessonScoreRef.current)
      : null
    const leagueTierId = resolveBrilliantLeagueId(weeklyLeague?.myLeague || storeLeague)
    const leagueTier = BRILLIANT_LEAGUES.find((l) => l.id === leagueTierId) ?? BRILLIANT_LEAGUES[0]

    const endstateQueue: EndstateStep[] = ['lesson']
    if (lesson && result.passed) {
      if (endstateStreak && endstateStreak.streak > 0) {
        endstateQueue.push('streak')
        if (endstateStreak.showCharge) endstateQueue.push('charge')
      }
      if (leagueClimb) endstateQueue.push('league')
      if (tariff !== 'premium') endstateQueue.push('nudge')
    }
    const currentEndstate: EndstateStep = lesson && result.passed
      ? (endstateQueue[Math.min(endstateIdx, endstateQueue.length - 1)] ?? 'lesson')
      : 'lesson'

    const finishEndstate = (openPremium = false) => {
      completionFlushedRef.current = true
      if (result.passed && pendingAchievementsRef.current.length > 0) {
        const pendingAchievements = pendingAchievementsRef.current
        pendingAchievementsRef.current = []
        useAchievementCelebrationStore.getState().triggerCelebration(pendingAchievements)
      }
      if (openPremium) {
        if (onOpenPremium) {
          onOpenPremium()
        } else {
          if (typeof window !== 'undefined') window.location.hash = '#/premium'
          onClose()
        }
        return
      }
      if (result.passed) {
        if (hasNext && onNext) onNext()
        else onClose()
      } else {
        retry()
      }
    }

    const handlePrimary = () => {
      if (!result.passed) {
        finishEndstate(false)
        return
      }
      if (lesson && currentEndstate === 'nudge') {
        finishEndstate(true)
        return
      }
      if (lesson && endstateIdx + 1 < endstateQueue.length) {
        playSound('click')
        haptics.impact('light')
        setEndstateIdx((prev) => prev + 1)
        return
      }
      finishEndstate(false)
    }

    const primaryLabel = !result.passed
      ? tt('rusDarslikQuizRetry')
      : !lesson
      ? (hasNext && onNext ? tt('rusDarslikQuizNextTopic') : tt('rusDarslikQuizBackToTopic'))
      : currentEndstate === 'nudge'
      ? tt('rusDarslikLearnMore')
      : tt('rusDarslikLessonContinue')

    const secondaryLabel = !lesson
      ? (result.passed ? tt('rusDarslikQuizRetry') : tt('rusDarslikQuizBackToTopic'))
      : currentEndstate === 'nudge'
      ? tt('rusDarslikRemindLater')
      : undefined
    const handleSecondary = !lesson
      ? (result.passed ? retry : onClose)
      : currentEndstate === 'nudge'
      ? () => finishEndstate(false)
      : undefined

    const streakTitle = endstateStreak
      ? endstateStreak.streak <= 1
        ? (isRu ? 'Вы начали новую серию!' : 'Yangi seriyani boshladingiz!')
        : (isRu ? `Серия ${endstateStreak.streak} дн.!` : `${endstateStreak.streak} kunlik seriya!`)
      : ''

    return (
      <>
        <BrilliantEndstateShell
          data-testid={lesson ? 'lesson-result' : 'topic-check'}
          data-result={result.passed ? 'passed' : 'failed'}
          data-endstate={lesson && result.passed ? currentEndstate : undefined}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60]"
          viewportClassName={currentEndstate === 'streak' && streakGlow ? 'brilliant-streak-bg-glow' : undefined}
          primaryVariant={lesson && currentEndstate !== 'nudge' ? 'secondary' : 'primary'}
          primaryLabel={primaryLabel}
          onPrimaryClick={handlePrimary}
          secondaryLabel={secondaryLabel}
          onSecondaryClick={handleSecondary}
        >
          {lesson && result.passed && currentEndstate === 'streak' && endstateStreak ? (
            <BrilliantStreakStage
              streak={endstateStreak.streak}
              heading={streakTitle}
              lang={isRu ? 'ru' : 'uz'}
              dark={dark}
              nonce={endstateIdx}
              onGlowChange={setStreakGlow}
            />
          ) : lesson && result.passed && currentEndstate === 'charge' && endstateStreak ? (
            <BrilliantChargeStage
              heading={
                endstateStreak.chargeSaved
                  ? (isRu ? 'Заряд спас вашу серию!' : 'Seriya zaryadi seriyangizni saqladi!')
                  : (endstateStreak.chargeEarned || endstateStreak.charges === undefined)
                    ? (isRu ? 'Вы получили 1 заряд серии!' : '1 ta Seriya zaryadini oldingiz!')
                    : (isRu ? `Заряды серии: ${endstateStreak.charges}/2` : `Seriya zaryadingiz: ${endstateStreak.charges}/2`)
              }
              description={
                endstateStreak.chargeSaved
                  ? (isRu
                      ? `Пропущенный день закрыт зарядом — серия сохранена (${endstateStreak.charges}/2 заряда осталось).`
                      : `O‘tkazib yuborilgan kun zaryad bilan yopildi — seriyangiz saqlandi (${endstateStreak.charges}/2 zaryad qoldi).`)
                  : (isRu
                      ? 'Каждый заряд серии сохраняет вашу серию при пропуске дня обучения (макс. 2 заряда — до 2 дней подряд).'
                      : 'Har bir seriya zaryadi mashg‘ulotni o‘tkazib yuborgan kuningizda seriyangizni saqlab qoladi (maks. 2 ta zaryad).')
              }
              dark={dark}
              nonce={endstateIdx}
            />
          ) : lesson && result.passed && currentEndstate === 'league' && leagueClimb ? (
            <BrilliantLeagueStage
              heading={tt('rusDarslikLeagueHeading')}
              subtitle={tt('rusDarslikLeagueDaysLeft')
                .replace('{league}', `${leagueTier.name} Liga`)
                .replace('{days}', String(getDaysLeftInWeek()))}
              leagueLevel={leagueTier.level}
              entries={leagueClimb.entries}
              oldRank={leagueClimb.oldRank}
              dark={dark}
              nonce={endstateIdx}
              fallback={<LeagueShield tierId={leagueTier.id} size={96} />}
            />
          ) : lesson && result.passed && currentEndstate === 'nudge' ? (
            <BrilliantPracticeNudgeStage
              heading={tt('rusDarslikPracticeNudgeTitle')}
              description={tt('rusDarslikPracticeNudgeDesc')}
              dark={dark}
              nonce={endstateIdx}
              fallback={
                <span className="grid size-24 place-items-center rounded-3xl bg-psurface text-pprimary shadow-xs">
                  <Dumbbell size={44} strokeWidth={2.2} />
                </span>
              }
            />
          ) : (
            <BrilliantCompletionStage
              mode={lesson && isPractice ? 'practice' : lesson ? 'lesson' : 'practice'}
              heading={heading}
              subtitle={lesson ? (isPractice && result.passed ? tt('rusDarslikPracticeSubtitle') : undefined) : title}
              xpLabel={isRu ? 'Всего XP' : 'Jami XP'}
              dark={dark}
              variant={colorVariant}
              lessonTrigger={result.passed ? (accuracyPct === 100 ? 'koji360' : 'kojiFlip') : 'kojiFail'}
              isLevel={false}
              skillCheckMastered={false}
              practiceTrigger={result.passed ? (accuracyPct === 100 ? 'play100' : 'play50Plus') : 'playFailure'}
              showXp={Boolean(lesson && result.passed && totalLessonXp > 0)}
              earnedXp={totalLessonXp}
              xpStyle={lesson ? 'total' : 'delta'}
              animateXpCount={false}
              fallback={
                lesson ? (
                  <PathMascot variant="avatar" animation={result.passed ? 'celebrate' : 'oops'} />
                ) : (
                  <span className={cn(
                    'grid size-20 place-items-center rounded-3xl',
                    result.passed
                      ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess'
                      : 'bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger',
                  )}>
                    {result.passed ? <CheckCircle2 size={42} strokeWidth={2.2} /> : <XCircle size={42} strokeWidth={2.2} />}
                  </span>
                )
              }
            >
            {!lesson && (
              <>
                <div className="flex w-full max-w-[340px] items-stretch justify-center gap-2 pt-1">
                  <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-pcard px-2.5 py-2.5 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-psuccess">
                      {tt('rusDarslikQuizCorrect')}
                    </span>
                    <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-psuccess">{accuracyPct}%</p>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-pcard px-2.5 py-2.5 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pmuted">
                      {tt('rusDarslikReviewTitle')}
                    </span>
                    <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-pfg">
                      {result.correct}/{result.total}
                    </p>
                  </div>
                </div>

                <p className="max-w-[330px] text-[12.5px] leading-relaxed text-pmuted">
                  {result.passed ? tt('rusDarslikQuizPassHint') : tt('rusDarslikCheckNeedAll')}
                </p>

                <button
                  type="button"
                  onClick={() => setShowReview((v) => !v)}
                  aria-expanded={showReview}
                  className="inline-flex items-center gap-1.5 rounded-full bg-psurface px-3.5 py-1.5 text-[12px] font-bold text-pfg shadow-xs transition-colors cursor-pointer"
                >
                  <span>{tt('rusDarslikReviewTitle')}</span>
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-200', showReview && 'rotate-180')}
                  />
                </button>

                {showReview && (
                  <div className="flex w-full flex-col gap-2.5 pt-1 pb-4 text-left">
                    {check.questions.map((question, questionIndex) => {
                      const item = result.feedback.find((entry) => entry.id === question.id)
                      const correct = item?.correct ?? false
                      return (
                        <div key={question.id} className="rounded-2xl bg-pcard p-3.5 shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10.5px] font-bold uppercase tracking-wide text-psubtle">
                              {questionIndex + 1}/{check.questions.length} · {tt(EXERCISE_LABEL[question.kind])}
                            </p>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                                correct
                                  ? 'bg-[rgb(var(--p-success-rgb)/0.12)] text-psuccess'
                                  : 'bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger',
                              )}
                            >
                              {correct ? <CheckCircle2 size={12} strokeWidth={2.5} /> : <XCircle size={12} strokeWidth={2.5} />}
                              {correct ? tt('rusDarslikQuizCorrect') : tt('rusDarslikQuizWrong')}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[13.5px] font-bold leading-snug text-pfg">{question.prompt}</p>
                          {!correct && (
                            <p className="mt-1.5 text-[12px] leading-relaxed text-pmuted">
                              {tt('rusDarslikCheckYourAnswer')}: <span className="font-semibold text-pdanger">{answerText(question, answers[question.id])}</span>
                            </p>
                          )}
                          {item?.explanation && (
                            <p className="mt-1.5 rounded-xl bg-psurface px-2.5 py-1.5 text-[12px] leading-relaxed text-pmuted">
                              {tt('rusDarslikQuizExplanation')}: {item.explanation}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </BrilliantCompletionStage>
          )}
        </BrilliantEndstateShell>
      </>
    )
  }

  if (lesson) {
    if (!current) return null
    const isLast = index + 1 >= check.questions.length
    const isPhase1WrongDock = Boolean(!isCheckpointStep && phase === 'feedback' && feedback && !feedback.correct && !revealed)
    const isPhase2WrongDock = Boolean(isCheckpointStep && phase === 'feedback' && feedback && !feedback.correct && !revealed)
    const isReported = Boolean(reported[current.id])
    const reportButton = (
      <button
        type="button"
        aria-label={tt('rusDarslikReportIssue')}
        aria-pressed={isReported}
        onClick={() => {
          playSound('click')
          setReported((previous) => ({ ...previous, [current.id]: true }))
          track('lesson_report_issue', { topic_id: topicId, exercise_id: current.id })
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-pmuted transition-colors hover:text-pfg cursor-pointer shrink-0"
      >
        <Flag size={16} strokeWidth={2.2} className={isReported ? 'text-pprimary fill-current' : undefined} />
        {isReported && <span className="text-[11px] font-bold text-pfg">{tt('rusDarslikReported')}</span>}
      </button>
    )
    const continueLabel = submitting
      ? tt('rusDarslikCheckSubmitting')
      : revealed
      ? tt('rusDarslikSkipExplanation')
      : isLast
      ? tt('rusDarslikLessonFinish')
      : tt('rusDarslikLessonContinue')

    return (
      <div
        className="rus-lesson-runner fixed inset-0 z-[60] flex flex-col bg-pcanvas"
        data-testid="lesson-runner"
        data-format="lesson"
        data-mode={mode}
        data-phase={phase}
        data-stage={isCheckpointStep ? 'phase2' : 'phase1'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-runner-title"
      >
        {header}

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(7.5rem+var(--safe-bottom,0px))]">
          <div className="mx-auto w-full max-w-[460px]">
            {checkUpdated && (
              <p
                role="status"
                data-testid="lesson-updated"
                className="mb-3 rounded-2xl bg-[rgb(var(--p-warning-rgb)/0.14)] px-3.5 py-2.5 text-[12.5px] font-semibold text-pwarning"
              >
                {tt('rusDarslikLessonUpdated')}
              </p>
            )}

            <div key={current.id} className="rus-lesson-question-enter">
              <h3
                id="lesson-runner-title"
                ref={headingRef}
                tabIndex={-1}
                className={cn(
                  'mb-6 mt-5 leading-snug text-pfg focus-visible:outline-none',
                  isCheckpointStep
                    ? 'text-[22px] font-bold tracking-tight sm:text-[24px]'
                    : 'text-[19px] font-semibold sm:text-[21px]',
                )}
              >
                {current.prompt}
              </h3>

              <div>
                <LessonExercise
                  key={current.id}
                  exercise={current}
                  value={revealed && feedback && (current.kind === 'mcq' || current.kind === 'listening') ? String(current.options.indexOf(feedback.correctAnswer)) : answers[current.id] ?? answerOrEmpty(current)}
                  outcome={phase === 'feedback' ? (revealed ? 'revealed' : feedback?.correct ? 'correct' : isCheckpointStep ? 'phase2_wrong' : 'wrong') : undefined}
                  onChange={setAnswer}
                  disabled={phase === 'feedback' || checking}
                  onSpeak={playAudio}
                  speaking={speaking}
                />
              </div>

              {!isCheckpointStep && phase === 'exercise' && currentAnswered && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('skip')
                      setAnswer(answerOrEmpty(current))
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-pmuted transition-colors hover:text-pfg"
                  >
                    <RotateCcw size={14} strokeWidth={2.2} />
                    {tt('rusDarslikStartOver')}
                  </button>
                </div>
              )}
            </div>

            {answerError && (
              <p role="alert" className="mt-3 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.12)] px-3.5 py-2.5 text-[12.5px] font-semibold text-pdanger">
                {tt('rusDarslikLessonAnswerError')}
              </p>
            )}
            {submitError && (
              <p role="alert" className="mt-3 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.12)] px-3.5 py-2.5 text-[12.5px] font-semibold text-pdanger">
                {tt('rusDarslikCheckSubmitError')}
              </p>
            )}
          </div>
        </div>

        <div
          className="rus-lesson-dock rounded-t-3xl px-4 py-4 pb-[calc(1.125rem+var(--safe-bottom,0px))]"
          data-state={
            phase !== 'feedback' || !feedback
              ? 'exercise'
              : revealed
              ? 'revealed'
              : feedback.correct
              ? 'correct'
              : isCheckpointStep
              ? 'phase2-wrong'
              : 'wrong'
          }
        >
          <div className="relative mx-auto w-full max-w-[460px]">
            {isPhase1WrongDock && (
              <div className="rus-koji-overhang" aria-hidden="true">
                <PathMascot variant="avatar" animation="oops" />
              </div>
            )}

            {phase === 'feedback' && feedback && (
              <div
                ref={feedbackRef}
                data-testid="lesson-feedback"
                data-correct={feedback.correct ? 'true' : 'false'}
                data-revealed={revealed ? 'true' : 'false'}
                role="status"
                aria-live="polite"
                className={cn(
                  'rus-feedback-pop mb-4 flex items-start justify-between gap-3',
                  isPhase1WrongDock && 'pt-3',
                )}
              >
                {isPhase1WrongDock ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <span className="sr-only">{tt('rusDarslikLessonWrong')}</span>
                      <p className="text-[15.5px] font-semibold leading-snug text-pfg">
                        {deriveMicroHint(current, feedback, tt)}
                      </p>
                    </div>
                    {reportButton}
                  </>
                ) : isPhase2WrongDock ? (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <BrilliantMissedTargetIcon />
                      <p className="text-[19px] font-extrabold leading-tight text-pfg">{tt('rusDarslikIncorrect')}</p>
                      <span className="sr-only">{tt('rusDarslikLessonWrong')}</span>
                    </div>
                    {reportButton}
                  </>
                ) : revealed ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-[19px] font-extrabold leading-tight text-pfg">{tt('rusDarslikAnswerShown')}</p>
                      <p className="mt-1 break-words text-[14.5px] font-medium text-pmuted">{feedback.correctAnswer}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {reportButton}
                      <Button
                        variant="secondary"
                        onClick={() => { playSound('hint'); setShowExplanation(true) }}
                        className="rus-lesson-secondary shrink-0 rounded-full px-5"
                      >
                        {tt('rusDarslikWhy')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 flex-wrap">
                      {isCheckpointStep && <BrilliantConfettiBurstIcon />}
                      <p className="text-[20px] font-extrabold leading-tight text-pfg">{tt('rusDarslikLessonCorrect')}</p>
                      {lastCheckXp > 0 && (
                        <span
                          data-testid="lesson-check-xp"
                          className="text-[14px] font-extrabold text-[#21c65b] tabular-nums"
                        >
                          +{lastCheckXp} XP
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {reportButton}
                      {!isCheckpointStep && (
                        <Button
                          variant="secondary"
                          onClick={() => { playSound('hint'); setShowExplanation(true) }}
                          className="rus-lesson-secondary shrink-0 rounded-full px-5"
                        >
                          {tt('rusDarslikWhy')}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {phase === 'exercise' ? (
              <div className="flex items-center gap-3">
                {!isCheckpointStep && (
                  <div className="relative block size-14 shrink-0" aria-hidden="true">
                    <PathMascot variant="avatar" animation="idle" />
                  </div>
                )}
                <Button
                  size="lg"
                  block
                  sheen={false}
                  className="rus-lesson-check flex-1"
                  onClick={() => { void checkAnswer() }}
                  disabled={!currentAnswered || checking}
                >
                  {checking ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
                </Button>
              </div>
            ) : isPhase1WrongDock ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => { playSound('hint'); setRevealed(true) }}
                  className="rus-lesson-secondary min-w-0 flex-[0.44] rounded-full"
                >
                  {tt('rusDarslikSeeAnswer')}
                </Button>
                <Button
                  size="lg"
                  sheen={false}
                  className="rus-lesson-action min-w-0 flex-[0.56]"
                  onClick={() => {
                    playSound('skip')
                    setAnswers(previous => ({ ...previous, [current.id]: answerOrEmpty(current) }))
                    setFeedback(null)
                    setPhase('exercise')
                  }}
                >
                  {tt('rusDarslikTryAgain')}
                </Button>
              </div>
            ) : isPhase2WrongDock ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => { playSound('hint'); setShowExplanation(true) }}
                  className="rus-lesson-secondary min-w-0 flex-[0.36] rounded-full"
                >
                  {tt('rusDarslikWhy')}
                </Button>
                <Button
                  size="lg"
                  block
                  sheen={false}
                  onClick={() => { playSound('continue'); continueLesson() }}
                  disabled={submitting}
                  className="rus-lesson-action min-w-0 flex-[0.64]"
                >
                  {continueLabel}
                </Button>
              </div>
            ) : isCheckpointStep && feedback?.correct && !revealed ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => { playSound('hint'); setShowExplanation(true) }}
                  className="rus-lesson-secondary min-w-0 flex-[0.34] rounded-full"
                >
                  {tt('rusDarslikWhy')}
                </Button>
                <Button
                  size="lg"
                  block
                  sheen={false}
                  onClick={() => { playSound('continue'); continueLesson() }}
                  disabled={submitting}
                  className="rus-lesson-action min-w-0 flex-[0.66]"
                >
                  {continueLabel}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {!isCheckpointStep && (
                  <div className="relative block size-14 shrink-0" aria-hidden="true">
                    <PathMascot variant="avatar" animation={feedback?.correct ? 'happy' : 'idle'} />
                  </div>
                )}
                <Button
                  size="lg"
                  block
                  sheen={false}
                  onClick={() => { playSound('continue'); continueLesson() }}
                  disabled={submitting}
                  className="rus-lesson-action flex-1"
                >
                  {continueLabel}
                </Button>
              </div>
            )}
          </div>
        </div>

        {showExitConfirm && (
          <ModalShell
            title={tt('rusDarslikExitTitle')}
            showHeader={false}
            showHandle={false}
            onClose={() => setShowExitConfirm(false)}
            zIndex={85}
          >
            <div className="pt-2 pb-1">
              <h3 className="font-display text-[22px] font-extrabold tracking-tight text-pfg">
                {tt('rusDarslikExitTitle')}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-pmuted">
                {tt('rusDarslikExitSubtitle')}
              </p>
              <Button
                variant="secondary"
                size="lg"
                block
                className="mt-6 rounded-full"
                onClick={() => setShowExitConfirm(false)}
              >
                {tt('rusDarslikKeepLearning')}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false)
                  onClose()
                }}
                className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-full text-[16px] font-bold text-[#e5645c] transition-opacity hover:opacity-80 active:opacity-60"
              >
                {tt('rusDarslikQuitLesson')}
              </button>
            </div>
          </ModalShell>
        )}

        {showExplanation && feedback && <ModalShell title={tt('rusDarslikQuizExplanation')} onClose={() => setShowExplanation(false)} zIndex={80} footer={<Button variant="secondary" size="lg" block onClick={() => setShowExplanation(false)}>{tt('rusDarslikGotIt')}</Button>}>
          <p className="py-5 text-[17px] leading-relaxed text-pfg">{feedback.explanation}</p>
          <div className="rounded-2xl bg-pcard p-4 text-[15px] leading-relaxed text-pfg"><p className="font-bold">{current.prompt}</p><p className="mt-3">{tt('rusDarslikQuizCorrectAnswer')}: <strong>{feedback.correctAnswer}</strong></p></div>
        </ModalShell>}
      </div>
    )
  }

  // Legacy 2 MCQ + 1 input — eski oqim o'zgarishsiz ishlaydi.
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-pcanvas" data-testid="topic-check" data-format="legacy" role="dialog" aria-modal="true" aria-labelledby="rus-check-title">
      {header}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-[460px]">
          {checkUpdated && (
            <p
              role="status"
              data-testid="lesson-updated"
              className="mb-3 rounded-2xl bg-[rgb(var(--p-warning-rgb)/0.14)] px-3.5 py-2.5 text-[12.5px] font-semibold text-pwarning"
            >
              {tt('rusDarslikLessonUpdated')}
            </p>
          )}
          <p className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-pprimary">
            {tt('rusDarslikCheckCount').replace('{count}', String(check.questions.length))}
          </p>
          <h3 id="rus-check-title" className="text-[18px] font-bold leading-snug text-pfg">{title}</h3>

          <div className="mt-4 flex flex-col gap-4">
            {check.questions.map((question, questionIndex) => (
              <section key={question.id} className="rounded-3xl bg-pcard p-4 shadow-xs" aria-labelledby={'rus-check-q-' + questionIndex}>
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-pprimary">
                  {tt(EXERCISE_LABEL[question.kind])} · {questionIndex + 1}/{check.questions.length}
                </p>
                <h4 id={'rus-check-q-' + questionIndex} className="mt-1.5 text-[15px] font-bold leading-snug text-pfg">
                  {question.prompt}
                </h4>
                <div className="mt-3">
                  <LessonExercise
                    exercise={question}
                    value={answers[question.id] ?? answerOrEmpty(question)}
                    onChange={(value) => setAnswers((previous) => ({ ...previous, [question.id]: value }))}
                    disabled={submitting}
                  />
                </div>
              </section>
            ))}
          </div>

          {submitError && (
            <p role="alert" className="mt-4 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.12)] px-3.5 py-2.5 text-[12.5px] font-semibold text-pdanger">
              {tt('rusDarslikCheckSubmitError')}
            </p>
          )}
          {!legacyAnswered && (
            <p className="mt-4 text-center text-[12px] font-medium text-pmuted">{tt('rusDarslikCheckAllRequired')}</p>
          )}
        </div>
      </div>

      <div className="bg-pcanvas px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
        <div className="mx-auto w-full max-w-[460px]">
          <Button size="lg" block onClick={() => { void submit() }} disabled={!legacyAnswered || submitting}>
            {submitting ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
