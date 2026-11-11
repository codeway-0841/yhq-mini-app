import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2, ChevronDown, ChevronLeft, Lock, RefreshCw, X, XCircle,
} from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import ModalShell from '../../shared/components/ModalShell'
import { useAppStore } from '../../shared/store/useAppStore'
import { useDailyStore, doneKeyOf, todayStr } from '../../shared/store/useDailyStore'
import { useT, type Keys } from '../../shared/i18n'
import { registerModal } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { ApiError, api } from '../../shared/api'
import { track } from '../../shared/lib/analytics'
import { checkAndCelebrateAchievements } from '../../shared/lib/achievement-detector'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { speak, stopSpeaking, isSpeaking, subscribeSpeaking } from '../../shared/lib/speech'
import { PathMascot } from '../lessons'
import { BrilliantEndstateRive } from '../../shared/components/BrilliantEndstateRive'
import { BrilliantCopyContainer, BrilliantEndstateShell, BrilliantRiveContainer } from '../../shared/components/BrilliantEndstateShell'
import { BrilliantCompletionStage } from '../../shared/components/BrilliantCompletionContent'
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
const Tutor = lazy(() => import('../ai-tutor').then((module) => ({ default: module.SocraticChatSheet })))

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
  onClose: () => void
  /** Server testdan o'tilganda (bir marta) */
  onPassed: () => void
  onNext?: () => void
  hasNext: boolean
  /** Server 403 qaytardi — progress eskirgan bo'lishi mumkin */
  onLocked?: () => void
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
  onClose,
  onPassed,
  onNext,
  hasNext,
  onLocked,
}: LessonRunnerProps) {
  const lang = useAppStore((state) => state.settings.language)
  const tt = useT(lang)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const onLockedRef = useRef(onLocked)
  onLockedRef.current = onLocked
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
  const [showTutor, setShowTutor] = useState(false)
  const [checking, setChecking] = useState(false)
  const [answerError, setAnswerError] = useState(false)
  const [combo, setCombo] = useState(0)
  const [earnedLessonXp, setEarnedLessonXp] = useState(0)
  const [lastCheckXp, setLastCheckXp] = useState(0)
  const pendingStreakRef = useRef<{
    streak: number
    showCharge: boolean
    charges: number
    chargeSaved: boolean
    chargeEarned: boolean
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [result, setResult] = useState<DarslikCheckResult | null>(null)
  const [speaking, setSpeaking] = useState(false)
  /** Admin darsni o'rtada regeneratsiya qildi — yangi versiya yuklandi. */
  const [checkUpdated, setCheckUpdated] = useState(false)

  const lesson = check?.format === 'lesson'
  const total = check?.questions.length ?? 0
  const current = check?.questions[index]
  const currentAnswered = current ? isDarslikPublicAnswerComplete(current, answers[current.id]) : false

  useEffect(() => {
    const id = Symbol('rus-lesson-runner')
    return registerModal(id, () => closeRef.current())
  }, [])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showExplanation && !showTutor) {
        event.preventDefault()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [showExplanation, showTutor])

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
    setShowTutor(false)
    setShowReview(false)
    setAnswerError(false)
    setSubmitError(false)
    setCombo(0)
    setEarnedLessonXp(0)
    setLastCheckXp(0)
    pendingStreakRef.current = null
    startedTracked.current = false
    passedNotified.current = false

    api.getDarslikCheck(topicId)
      .then((loaded) => {
        if (cancelled) return
        setCheck(loaded)
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
  }, [topicId, reload])

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
      track('lesson_complete', {
        topic_id: topicId,
        format: lesson ? 'lesson' : 'legacy',
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
        if (typeof graded.xp === 'number') useAppStore.setState({ xp: graded.xp })
        if (typeof graded.dailyStreak === 'number') {
          const today = todayStr()
          const alreadyDone = useDailyStore.getState().activityKey === doneKeyOf(today, RUSSIAN_SUBJECT_ID)
          const charges = graded.streakCharges ?? useDailyStore.getState().charges[RUSSIAN_SUBJECT_ID] ?? 0
          const showCharge = Boolean(graded.chargeSaved || graded.chargeEarned || charges > 0)
          if (!alreadyDone && graded.dailyStreak > 0) {
            pendingStreakRef.current = {
              streak: graded.dailyStreak,
              showCharge,
              charges,
              chargeSaved: Boolean(graded.chargeSaved),
              chargeEarned: Boolean(graded.chargeEarned),
            }
          }
          useDailyStore.getState().applyServerResult(
            today,
            RUSSIAN_SUBJECT_ID,
            graded.dailyStreak,
            graded.coinSaved === true,
            {
              suppressCelebration: true,
              chargeSaved: graded.chargeSaved,
              chargeEarned: graded.chargeEarned,
              streakCharges: graded.streakCharges,
            },
          )
        }
        // Mavjud yutuq tizimi — yangi achievement store yaratilmaydi.
        const userId = useAppStore.getState().user?.id
        if (userId && userId !== '0') {
          void api.getAchievements(userId)
            .then(({ stats }) => checkAndCelebrateAchievements(stats))
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
  }, [answers, check, lesson, onPassed, submitting, topicId])

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
    setResult(null)
    setAnswerError(false)
    setSubmitError(false)
    setCombo(0)
    setEarnedLessonXp(0)
    setLastCheckXp(0)
    pendingStreakRef.current = null
    passedNotified.current = false
  }, [])

  const playAudio = useCallback((text: string) => {
    speak(text, 'ru')
  }, [])

  const legacyAnswered = useMemo(
    () => Boolean(check && check.questions.every(question => isDarslikPublicAnswerComplete(question, answers[question.id]))),
    [answers, check],
  )

  const progressPercent = total > 0
    ? Math.round(((index + (phase === 'feedback' ? 1 : 0)) / Math.max(1, total)) * 100)
    : 0

  const header = lesson && check && !result ? (
    <header className="rus-lesson-header pt-[calc(0.625rem+var(--safe-top,0px))]">
      <button type="button" onClick={onClose} aria-label={tt('rusDarslikQuizClose')} className="rus-lesson-close"><X size={24} /></button>
      <div className="rus-lesson-progress" role="progressbar" aria-label={tt('rusDarslikLessonProgress')}
        aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (phase === 'feedback' ? 1 : 0)}>
        <span style={{ width: `${Math.max(3, progressPercent)}%` }} />
      </div>
      <span className="sr-only">{Math.min(index + 1, total)}/{total}</span>
      {combo >= 2 && <span className="sr-only" data-testid="lesson-combo">{tt('rusDarslikLessonCombo').replace('{count}', String(combo))}</span>}
      <span className="rus-lesson-dots" aria-hidden="true"><i /><i /><i /></span>
    </header>
  ) : (
    <div className="border-b border-pline bg-pcanvas px-3.5 py-2.5 pt-[calc(0.625rem+var(--safe-top,0px))]">
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
                style={{ width: `${Math.max(8, progressPercent)}%` }}
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
    const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'
    const blockNum = Number(topicId.split(':')[0])
    const colorVariant = Number.isFinite(blockNum) && blockNum > 0 ? (blockNum - 1) % 6 : 0
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col justify-between bg-pcanvas pt-[var(--safe-top,0px)]"
        data-testid="topic-check"
        role="dialog"
        aria-modal="true"
        aria-busy="true"
      >
        <div className="flex-1 flex flex-col justify-start">
          <BrilliantRiveContainer className="aspect-square">
            <BrilliantEndstateRive
              kind="lesson-loader"
              variant={colorVariant}
              dark={dark}
              label={tt('rusDarslikCheckLoading')}
              className="size-full"
              fallback={
                <div className="relative grid size-20 place-items-center rounded-3xl bg-pcard shadow-xs">
                  <span className="size-9 animate-spin rounded-full border-3 border-pprimary border-t-transparent" />
                </div>
              }
            />
          </BrilliantRiveContainer>
          <BrilliantCopyContainer>
            <h1 className="text-[22px] font-extrabold text-pfg">{tt('rusDarslikCheckLoading')}</h1>
            <p className="text-[14px] text-pmuted">{tt('rusDarslikCheckLoadingHint')}</p>
          </BrilliantCopyContainer>
        </div>
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
    const heading = result.passed
      ? (lesson ? tt('rusDarslikLessonPassed') : tt('rusDarslikQuizPassed'))
      : (lesson ? tt('rusDarslikLessonFailed') : tt('rusDarslikQuizFailed'))

    const isRu = lang === 'ru'
    const primaryLabel = result.passed
      ? (lesson ? tt('rusDarslikLessonContinue') : (hasNext && onNext ? tt('rusDarslikQuizNextTopic') : tt('rusDarslikQuizBackToTopic')))
      : tt('rusDarslikQuizRetry')
    const primaryAction = result.passed
      ? (hasNext && onNext ? onNext : onClose)
      : retry
    const handlePrimary = () => {
      if (result.passed && pendingStreakRef.current) {
        const pending = pendingStreakRef.current
        pendingStreakRef.current = null
        useDailyStore.getState().triggerStreakCelebration(pending.streak, pending)
      }
      primaryAction()
    }
    const secondaryLabel = !lesson ? (result.passed ? tt('rusDarslikQuizRetry') : tt('rusDarslikQuizBackToTopic')) : undefined
    const handleSecondary = !lesson ? (result.passed ? retry : onClose) : undefined
    const totalLessonXp = result.lessonXpEarned ?? (earnedLessonXp || result.xpEarned || 0)

    return (
      <>
        <BrilliantEndstateShell
          data-testid={lesson ? 'lesson-result' : 'topic-check'}
          data-result={result.passed ? 'passed' : 'failed'}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60]"
          primaryLabel={primaryLabel}
          onPrimaryClick={handlePrimary}
          secondaryLabel={secondaryLabel}
          onSecondaryClick={handleSecondary}
        >
          <BrilliantCompletionStage
            mode={lesson ? 'lesson' : 'practice'}
            heading={heading}
            subtitle={lesson ? undefined : title}
            xpLabel={isRu ? 'Всего XP' : 'Jami XP'}
            dark={dark}
            variant={colorVariant}
            lessonTrigger={result.passed ? (accuracyPct === 100 ? 'koji360' : 'kojiFlip') : 'kojiFail'}
            isLevel={false}
            skillCheckMastered={false}
            practiceTrigger={result.passed ? (accuracyPct === 100 ? 'play100' : 'play50Plus') : 'playFailure'}
            showXp={Boolean(lesson && result.passed && totalLessonXp > 0)}
            earnedXp={totalLessonXp}
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
                  <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-pcard px-2.5 py-2.5 border border-pline">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-psuccess">
                      {tt('rusDarslikQuizCorrect')}
                    </span>
                    <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-psuccess">{accuracyPct}%</p>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-pcard px-2.5 py-2.5 border border-pline">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-pline bg-psurface px-3.5 py-1.5 text-[12px] font-bold text-pfg transition-colors hover:border-plineStrong cursor-pointer"
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
                        <div key={question.id} className="rounded-2xl bg-pcard p-3.5 shadow-xs border border-pline">
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
        </BrilliantEndstateShell>
      </>
    )
  }

  if (lesson) {
    if (!current) return null
    const isLast = index + 1 >= check.questions.length
    return (
      <div
        className="rus-lesson-runner fixed inset-0 z-[60] flex flex-col bg-pcanvas"
        data-testid="lesson-runner"
        data-format="lesson"
        data-phase={phase}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-runner-title"
      >
        {header}

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(6.5rem+var(--safe-bottom,0px))]">
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

            <h3 id="lesson-runner-title" ref={headingRef} tabIndex={-1} className="mb-7 mt-8 text-[20px] font-semibold leading-relaxed text-pfg focus-visible:outline-none sm:text-[22px]">{current.prompt}</h3>

            <div>
              <LessonExercise
                key={current.id}
                exercise={current}
                value={revealed && feedback && (current.kind === 'mcq' || current.kind === 'listening') ? String(current.options.indexOf(feedback.correctAnswer)) : answers[current.id] ?? answerOrEmpty(current)}
                outcome={phase === 'feedback' ? (revealed ? 'revealed' : feedback?.correct ? 'correct' : 'wrong') : undefined}
                onChange={setAnswer}
                disabled={phase === 'feedback' || checking}
                onSpeak={playAudio}
                speaking={speaking}
              />
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

        <div className="rus-lesson-dock rounded-t-3xl px-4 py-5 pb-[calc(1.25rem+var(--safe-bottom,0px))]"
          data-state={phase !== 'feedback' || !feedback ? 'exercise' : revealed ? 'revealed' : feedback.correct ? 'correct' : 'wrong'}>
          <div className="relative mx-auto w-full max-w-[460px]">
            {phase === 'feedback' && feedback && (
              <div ref={feedbackRef} data-testid="lesson-feedback" data-correct={feedback.correct ? 'true' : 'false'} data-revealed={revealed ? 'true' : 'false'} role="status" aria-live="polite" className="mb-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[20px] font-extrabold leading-tight text-pfg">{revealed ? tt('rusDarslikAnswerShown') : feedback.correct ? tt('rusDarslikLessonCorrect') : tt('rusDarslikLessonWrong')}</p>
                    {feedback.correct && !revealed && lastCheckXp > 0 && (
                      <span
                        data-testid="lesson-check-xp"
                        className="inline-flex items-center rounded-full bg-[#29cc57]/15 px-2.5 py-0.5 text-[12px] font-extrabold text-[#29cc57] tabular-nums"
                      >
                        +{lastCheckXp} XP
                      </span>
                    )}
                  </div>
                  {revealed && <p className="mt-1 break-words text-[15px] font-semibold text-pfg">{feedback.correctAnswer}</p>}</div>
                {feedback.correct || revealed
                  ? <Button variant="secondary" onClick={() => { playSound('hint'); setShowExplanation(true) }} className="rus-lesson-secondary shrink-0 rounded-full">{tt('rusDarslikWhy')}</Button>
                  : <Button variant="secondary" onClick={() => { playSound('hint'); setRevealed(true) }} className="rus-lesson-secondary shrink-0 rounded-full">{tt('rusDarslikSeeAnswer')}</Button>}
              </div>
            )}
            {phase === 'exercise' ? <div className="flex items-center gap-3"><button type="button" className="relative block size-20 shrink-0" aria-label={tt('darslikAskTutor')} onClick={() => { playSound('hint'); setShowTutor(true) }}><PathMascot variant="avatar" animation="idle" /></button><Button size="lg" block className="rus-lesson-check flex-1" onClick={() => { void checkAnswer() }} disabled={!currentAnswered || checking}>{checking ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}</Button></div>
              : feedback && !feedback.correct && !revealed ? <div className="flex items-center gap-3">
                <button type="button" className="relative block size-20 shrink-0" aria-label={tt('darslikAskTutor')} onClick={() => { playSound('hint'); setShowTutor(true) }}><PathMascot variant="avatar" animation="oops" /></button>
                <Button size="lg" className="rus-lesson-action min-w-0 flex-1" onClick={() => { playSound('skip'); setAnswers(previous => ({ ...previous, [current.id]: answerOrEmpty(current) })); setFeedback(null); setPhase('exercise') }}>{tt('rusDarslikTryAgain')}</Button>
              </div> : <div className="flex items-center gap-3">
                <button type="button" className="relative block size-20 shrink-0" aria-label={tt('darslikAskTutor')} onClick={() => { playSound('hint'); setShowTutor(true) }}><PathMascot variant="avatar" animation={feedback?.correct ? 'happy' : 'idle'} /></button>
                <Button size="lg" block onClick={() => { playSound('continue'); continueLesson() }} disabled={submitting} className="rus-lesson-action flex-1">
                  {submitting ? tt('rusDarslikCheckSubmitting') : revealed ? tt('rusDarslikSkipExplanation') : isLast ? tt('rusDarslikLessonFinish') : tt('rusDarslikLessonContinue')}
                </Button>
              </div>}
          </div>
        </div>
        {showExplanation && feedback && <ModalShell title={tt('rusDarslikQuizExplanation')} onClose={() => setShowExplanation(false)} zIndex={80} footer={<Button size="lg" block onClick={() => setShowExplanation(false)}>{tt('rusDarslikGotIt')}</Button>}>
          <p className="py-5 text-[17px] leading-relaxed text-pfg">{feedback.explanation}</p>
          <div className="rounded-2xl bg-pcard p-4 text-[15px] leading-relaxed text-pfg"><p className="font-bold">{current.prompt}</p><p className="mt-3">{tt('rusDarslikQuizCorrectAnswer')}: <strong>{feedback.correctAnswer}</strong></p></div>
        </ModalShell>}
        {showTutor && <Suspense fallback={null}><Tutor isOpen onClose={() => setShowTutor(false)} zIndex={80} variant="lesson"
          mascot={<PathMascot variant="avatar" animation="idle" />} context={{
          subjectId: RUSSIAN_SUBJECT_ID,
          topicName: title,
          questionText: current.prompt,
          options: current.kind === 'mcq' || current.kind === 'listening'
            ? Object.fromEntries(current.options.map((option, optionIndex) => [String(optionIndex + 1), option]))
            : undefined,
          userSelectedOption: answers[current.id] === undefined ? undefined : answerText(current, answers[current.id]),
        }} /></Suspense>}
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

      <div className="border-t border-pline bg-pcanvas px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
        <div className="mx-auto w-full max-w-[460px]">
          <Button size="lg" block onClick={() => { void submit() }} disabled={!legacyAnswered || submitting}>
            {submitting ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
