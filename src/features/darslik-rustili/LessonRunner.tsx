import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2, ChevronLeft, Lock, RefreshCw, XCircle,
} from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import Confetti from '../../shared/components/Confetti'
import { useAppStore } from '../../shared/store/useAppStore'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
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
import LessonExercise from './LessonExercise'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import {
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
  const [feedback, setFeedback] = useState<DarslikAnswerFeedback | null>(null)
  const [checking, setChecking] = useState(false)
  const [answerError, setAnswerError] = useState(false)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
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
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [])

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
    setAnswerError(false)
    setSubmitError(false)
    setCombo(0)
    setMaxCombo(0)
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
        playSound('win')
        haptics.success()
        if (!passedNotified.current) {
          passedNotified.current = true
          onPassed()
        }
        if (typeof graded.xp === 'number') useAppStore.setState({ xp: graded.xp })
        if (typeof graded.dailyStreak === 'number') {
          useDailyStore.getState().applyServerResult(todayStr(), RUSSIAN_SUBJECT_ID, graded.dailyStreak, graded.coinSaved === true)
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
        playSound('error')
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
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          try { feedbackRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) } catch { /* eski webview */ }
        })
      }
      const nextCombo = graded.correct ? combo + 1 : 0
      setCombo(nextCombo)
      setMaxCombo((value) => Math.max(value, nextCombo))
      if (graded.correct) {
        playSound(nextCombo >= 3 ? 'combo' : 'success')
        haptics.success()
      } else {
        playSound('error')
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
    setAnswerError(false)
  }, [check, index, submit])

  const retry = useCallback(() => {
    stopSpeaking()
    setAnswers({})
    setIndex(0)
    setPhase('exercise')
    setFeedback(null)
    setResult(null)
    setAnswerError(false)
    setSubmitError(false)
    setCombo(0)
    setMaxCombo(0)
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

  const header = (
    <div className="border-b border-pline bg-pcanvas px-3.5 py-2.5 pt-[calc(0.625rem+var(--safe-top,0px))]">
      <div className="mx-auto flex w-full max-w-[520px] items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={tt('rusDarslikQuizClose')}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg shadow-2xs transition-transform active:scale-95"
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
                className="h-full rounded-full bg-pprimary transition-[width] duration-300 ease-out"
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
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-pcanvas" data-testid="topic-check" role="dialog" aria-modal="true" aria-busy="true">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="relative grid size-20 place-items-center rounded-3xl bg-pcard shadow-xs">
            <span className="size-9 animate-spin rounded-full border-3 border-pprimary border-t-transparent" />
          </div>
          <div>
            <p className="text-[16px] font-bold text-pfg">{tt('rusDarslikCheckLoading')}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-pmuted">{tt('rusDarslikCheckLoadingHint')}</p>
          </div>
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
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-pcanvas"
        data-testid={lesson ? 'lesson-result' : 'topic-check'}
        data-result={result.passed ? 'passed' : 'failed'}
        role="dialog"
        aria-modal="true"
      >
        {result.passed && <Confetti count={28} />}
        {header}
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(5rem+var(--safe-bottom,0px))]">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="flex flex-col items-center rounded-3xl bg-pcard px-5 py-6 text-center shadow-xs">
              {lesson && result.passed ? (
                <div className="relative mb-2 grid size-24 place-items-center rounded-3xl bg-[rgb(var(--p-primary-rgb)/0.10)] p-2.5">
                  <span className="relative block size-full" data-testid="lesson-result-mascot">
                    <PathMascot variant="avatar" animation="celebrate" />
                  </span>
                </div>
              ) : (
                <span className={cn(
                  'grid size-20 place-items-center rounded-3xl',
                  result.passed
                    ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess'
                    : 'bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger',
                )}>
                  {result.passed ? <CheckCircle2 size={42} strokeWidth={2.2} /> : <XCircle size={42} strokeWidth={2.2} />}
                </span>
              )}
              <h3 className="mt-3 font-display text-[24px] font-extrabold tracking-tight text-pfg">
                {result.passed
                  ? (lesson ? tt('rusDarslikLessonPassed') : tt('rusDarslikQuizPassed'))
                  : (lesson ? tt('rusDarslikLessonFailed') : tt('rusDarslikQuizFailed'))}
              </h3>
              <p className="mt-1 text-[13.5px] font-semibold text-pmuted">{title}</p>

              {lesson ? (
                <>
                  <div className="mt-5 grid w-full grid-cols-3 gap-2.5">
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-psurface px-2.5 py-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-psuccess">
                        {tt('rusDarslikLessonAccuracy')}
                      </span>
                      <p className="mt-1 text-[20px] font-extrabold tabular-nums text-psuccess">{accuracyPct}%</p>
                    </div>

                    <div className="flex flex-col items-center justify-center rounded-2xl bg-psurface px-2.5 py-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-pprimary">
                        XP
                      </span>
                      <p className="mt-1 text-[20px] font-extrabold tabular-nums text-pprimary">+{result.xpEarned ?? 0}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center rounded-2xl bg-psurface px-2.5 py-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-pwarning">
                        {tt('rusDarslikLessonStreak')}
                      </span>
                      <p className="mt-1 text-[20px] font-extrabold tabular-nums text-pwarning">
                        {typeof result.dailyStreak === 'number' ? result.dailyStreak : '—'}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3.5 rounded-2xl bg-psurface px-4 py-2 text-[12.5px] font-bold tabular-nums text-pfg">
                    {tt('rusDarslikQuizScore').replace('{score}', String(result.correct)).replace('{total}', String(result.total))}
                    {maxCombo >= 2 ? ' · ' + tt('rusDarslikLessonBestCombo').replace('{count}', String(maxCombo)) : ''}
                  </p>
                  {result.passed && result.alreadyPassed && (result.xpEarned ?? 0) === 0 && (
                    <p className="mt-2.5 max-w-[340px] text-[12px] leading-relaxed text-pmuted">{tt('rusDarslikLessonAlreadyPassedHint')}</p>
                  )}
                  {result.passed && (result.xpEarned ?? 0) > 0 && (
                    <p className="mt-2.5 max-w-[340px] text-[12px] leading-relaxed text-pmuted">{tt('rusDarslikLessonXpHint')}</p>
                  )}
                  {!result.passed && (
                    <p className="mt-2.5 max-w-[340px] text-[12px] leading-relaxed text-pmuted">{tt('rusDarslikCheckNeedAll')}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3.5 rounded-2xl bg-psurface px-4 py-2.5 text-[15px] font-bold tabular-nums text-pfg">
                    {tt('rusDarslikQuizScore').replace('{score}', String(result.correct)).replace('{total}', String(result.total))}
                  </p>
                  <p className="mt-2.5 max-w-[330px] text-[12.5px] leading-relaxed text-pmuted">
                    {result.passed ? tt('rusDarslikQuizPassHint') : tt('rusDarslikCheckNeedAll')}
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <p className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-psubtle">
                {tt('rusDarslikReviewTitle')}
              </p>
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
                    {lesson && !correct && item?.correctAnswer && (
                      <p className="mt-1 text-[12px] font-semibold leading-relaxed text-psuccess">
                        {tt('rusDarslikQuizCorrectAnswer')}: {item.correctAnswer}
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
          </div>
        </div>

        <div className="border-t border-pline bg-pcanvas px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
          <div className="mx-auto w-full max-w-[460px]">
            {result.passed ? (
              <div className="flex flex-col gap-2">
                {lesson && hasNext && onNext ? (
                  <Button size="lg" block onClick={onNext}>{tt('rusDarslikLessonContinue')}</Button>
                ) : hasNext && onNext ? (
                  <Button size="lg" block onClick={onNext}>{tt('rusDarslikQuizNextTopic')}</Button>
                ) : (
                  <Button size="lg" block onClick={onClose}>{tt('rusDarslikQuizBackToTopic')}</Button>
                )}
                <Button size="sm" variant="secondary" block onClick={retry}>{tt('rusDarslikQuizRetry')}</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button size="lg" block onClick={retry}>{tt('rusDarslikQuizRetry')}</Button>
                <Button size="sm" variant="secondary" block onClick={onClose}>{tt('rusDarslikQuizBackToTopic')}</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (lesson) {
    if (!current) return null
    const isLast = index + 1 >= check.questions.length
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-pcanvas"
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

            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-xl bg-[rgb(var(--p-primary-rgb)/0.12)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-pprimary">
                {tt(EXERCISE_LABEL[current.kind])}
              </span>
              <span className="text-[11px] font-semibold text-pmuted">{tt('rusDarslikLessonSource')}</span>
            </div>

            {/* Mascot Avatar + Speech Bubble Prompt */}
            <div className="mb-5 flex items-start gap-3">
              <div className="relative mt-0.5 size-12 shrink-0 rounded-2xl bg-[rgb(var(--p-primary-rgb)/0.10)] p-1.5 shadow-2xs">
                <PathMascot
                  key={phase === 'feedback' ? `${current.id}:${feedback?.correct ? 'happy' : 'oops'}` : `${current.id}:idle`}
                  variant="avatar"
                  animation={phase === 'feedback' ? (feedback?.correct ? 'happy' : 'oops') : 'idle'}
                />
              </div>

              <div className="relative min-w-0 flex-1 rounded-2xl bg-pcard px-4 py-3.5 shadow-xs">
                <span
                  aria-hidden="true"
                  className="absolute -left-1.5 top-5 size-3 rotate-45 bg-pcard"
                />
                <h3
                  id="lesson-runner-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="relative text-[17px] font-bold leading-snug text-pfg focus-visible:outline-none sm:text-[18px]"
                >
                  {current.prompt}
                </h3>
              </div>
            </div>

            <div>
              <LessonExercise
                key={current.id}
                exercise={current}
                value={answers[current.id] ?? answerOrEmpty(current)}
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

        {/* Duolingo Bottom Dock: Check CTA or Slide-up Feedback Drawer */}
        <div
          className={cn(
            'border-t px-4 py-3.5 pb-[calc(0.875rem+var(--safe-bottom,0px))] transition-colors',
            phase === 'feedback' && feedback
              ? feedback.correct
                ? 'border-[rgb(var(--p-success-rgb)/0.35)] bg-[rgb(var(--p-success-rgb)/0.10)]'
                : 'border-[rgb(var(--p-danger-rgb)/0.35)] bg-[rgb(var(--p-danger-rgb)/0.09)]'
              : 'border-pline bg-pcanvas',
          )}
        >
          <div className="mx-auto w-full max-w-[460px]">
            {phase === 'feedback' && feedback && (
              <div
                ref={feedbackRef}
                data-testid="lesson-feedback"
                data-correct={feedback.correct ? 'true' : 'false'}
                role="status"
                aria-live="polite"
                className="mb-3.5"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-white shadow-xs',
                      feedback.correct ? 'bg-psuccess' : 'bg-pdanger',
                    )}
                  >
                    {feedback.correct ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <XCircle size={18} strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-[16px] font-extrabold leading-tight', feedback.correct ? 'text-psuccess' : 'text-pdanger')}>
                        {feedback.correct ? tt('rusDarslikLessonCorrect') : tt('rusDarslikLessonWrong')}
                      </p>
                      {feedback.correct && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-[rgb(var(--p-success-rgb)/0.16)] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-psuccess">
                          +{combo >= 3 ? 5 : 3} XP
                        </span>
                      )}
                    </div>
                    {!feedback.correct && (
                      <p className="mt-1 text-[13px] font-semibold leading-snug text-pfg">
                        {tt('rusDarslikQuizCorrectAnswer')}: <span className="font-bold text-psuccess">{feedback.correctAnswer}</span>
                      </p>
                    )}
                    <p className="mt-1 text-[12.5px] leading-relaxed text-pfg opacity-85">{feedback.explanation}</p>
                  </div>
                </div>
              </div>
            )}

            {phase === 'exercise' ? (
              <Button
                size="lg"
                block
                onClick={() => { void checkAnswer() }}
                disabled={!currentAnswered || checking}
                className="shadow-[0_4px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)] transition-all active:translate-y-[2px] active:shadow-none disabled:shadow-none"
              >
                {checking ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
              </Button>
            ) : (
              <Button
                size="lg"
                block
                onClick={continueLesson}
                disabled={submitting}
                className={cn(
                  'text-white transition-all active:translate-y-[2px] active:shadow-none',
                  feedback?.correct
                    ? 'bg-psuccess hover:bg-psuccess shadow-[0_4px_0_color-mix(in_srgb,var(--p-success)_65%,#0f172a)]'
                    : 'bg-pdanger hover:bg-pdanger shadow-[0_4px_0_color-mix(in_srgb,var(--p-danger)_65%,#0f172a)]',
                )}
              >
                {submitting
                  ? tt('rusDarslikCheckSubmitting')
                  : isLast
                    ? tt('rusDarslikLessonFinish')
                    : tt('rusDarslikLessonContinue')}
              </Button>
            )}
          </div>
        </div>
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
