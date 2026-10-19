import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2, ChevronLeft, Flame, Lock, RefreshCw, XCircle, Zap,
} from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
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
      const graded = await api.submitDarslikCheck(topicId, answers)
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
      const graded = await api.checkDarslikExercise(topicId, current.id, value)
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
      setAnswerError(true)
    } finally {
      setChecking(false)
    }
  }, [answers, checking, combo, current, currentAnswered, index, phase, topicId])

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

  const header = (
    <div className="flex items-center gap-2 border-b border-pline px-3 py-2.5 pt-[calc(0.625rem+var(--safe-top,0px))]">
      <button
        type="button"
        onClick={onClose}
        aria-label={tt('rusDarslikQuizClose')}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg active:scale-95"
      >
        <ChevronLeft size={22} strokeWidth={2.25} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold leading-tight text-pfg">
            {lesson ? tt('rusDarslikLessonTitle') : tt('rusDarslikQuizTitle')}
          </h2>
          {lesson && combo >= 2 && (
            <span
              data-testid="lesson-combo"
              className="flex shrink-0 items-center gap-1 rounded-full bg-[rgb(var(--p-warning-rgb)/0.16)] px-2 py-0.5 text-[11px] font-bold text-pwarning"
            >
              <Flame size={11} strokeWidth={2.5} />
              {tt('rusDarslikLessonCombo').replace('{count}', String(combo))}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] font-medium text-pmuted">{title}</p>
      </div>
      {lesson && check && (
        <span className="shrink-0 rounded-full bg-psurface px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-pmuted">
          {Math.min(index + 1, total)}/{total}
        </span>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-pcanvas" data-testid="topic-check" role="dialog" aria-modal="true" aria-busy="true">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[rgb(var(--p-primary-rgb)/0.12)]">
            <span className="size-7 animate-spin rounded-full border-2 border-pprimary border-t-transparent" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-pfg">{tt('rusDarslikCheckLoading')}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-pmuted">{tt('rusDarslikCheckLoadingHint')}</p>
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
            'grid size-16 place-items-center rounded-full',
            locked ? 'bg-psurface text-pmuted' : 'bg-[rgb(var(--p-warning-rgb)/0.12)] text-pwarning',
          )}>
            {locked ? <Lock size={30} strokeWidth={2} /> : <XCircle size={30} strokeWidth={2} />}
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
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-pcanvas"
        data-testid={lesson ? 'lesson-result' : 'topic-check'}
        data-result={result.passed ? 'passed' : 'failed'}
        role="dialog"
        aria-modal="true"
      >
        {header}
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(5rem+var(--safe-bottom,0px))]">
          <div className="flex flex-col items-center text-center">
            {lesson && result.passed ? (
              <span className="relative -mb-6 block size-24" data-testid="lesson-result-mascot">
                <PathMascot animation="celebrate" />
              </span>
            ) : (
              <span className={cn(
                'grid size-20 place-items-center rounded-full',
                result.passed
                  ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess'
                  : 'bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger',
              )}>
                {result.passed ? <CheckCircle2 size={40} strokeWidth={2} /> : <XCircle size={40} strokeWidth={2} />}
              </span>
            )}
            <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-pfg">
              {result.passed
                ? (lesson ? tt('rusDarslikLessonPassed') : tt('rusDarslikQuizPassed'))
                : (lesson ? tt('rusDarslikLessonFailed') : tt('rusDarslikQuizFailed'))}
            </h3>
            <p className="mt-1 text-sm font-semibold text-pmuted">{title}</p>

            {lesson ? (
              <>
                <div className="mt-4 grid w-full max-w-[360px] grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-pcard px-2 py-3 shadow-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-psubtle">{tt('rusDarslikLessonAccuracy')}</p>
                    <p className="mt-1 text-[19px] font-bold tabular-nums text-pfg">
                      {Math.round((result.correct / Math.max(1, result.total)) * 100)}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-pcard px-2 py-3 shadow-xs">
                    <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-psubtle">
                      <Zap size={10} strokeWidth={2.5} /> XP
                    </p>
                    <p className="mt-1 text-[19px] font-bold tabular-nums text-pprimary">+{result.xpEarned ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-pcard px-2 py-3 shadow-xs">
                    <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-psubtle">
                      <Flame size={10} strokeWidth={2.5} /> {tt('rusDarslikLessonStreak')}
                    </p>
                    <p className="mt-1 text-[19px] font-bold tabular-nums text-pfg">
                      {typeof result.dailyStreak === 'number' ? result.dailyStreak : '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 rounded-2xl bg-pcard px-4 py-2.5 text-[13px] font-semibold tabular-nums text-pfg shadow-xs">
                  {tt('rusDarslikQuizScore').replace('{score}', String(result.correct)).replace('{total}', String(result.total))}
                  {maxCombo >= 2 ? ' · ' + tt('rusDarslikLessonBestCombo').replace('{count}', String(maxCombo)) : ''}
                </p>
                {result.passed && result.alreadyPassed && (result.xpEarned ?? 0) === 0 && (
                  <p className="mt-2 max-w-[330px] text-[12px] leading-relaxed text-pmuted">{tt('rusDarslikLessonAlreadyPassedHint')}</p>
                )}
                {result.passed && (result.xpEarned ?? 0) > 0 && (
                  <p className="mt-2 max-w-[330px] text-[12px] leading-relaxed text-pmuted">{tt('rusDarslikLessonXpHint')}</p>
                )}
                {!result.passed && (
                  <p className="mt-2 max-w-[330px] text-[12px] leading-relaxed text-pmuted">{tt('rusDarslikCheckNeedAll')}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 rounded-2xl bg-pcard px-4 py-3 text-[15px] font-bold tabular-nums text-pfg shadow-xs">
                  {tt('rusDarslikQuizScore').replace('{score}', String(result.correct)).replace('{total}', String(result.total))}
                </p>
                <p className="mt-3 max-w-[330px] text-[12.5px] leading-relaxed text-pmuted">
                  {result.passed ? tt('rusDarslikQuizPassHint') : tt('rusDarslikCheckNeedAll')}
                </p>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {check.questions.map((question, questionIndex) => {
              const item = result.feedback.find((entry) => entry.id === question.id)
              const correct = item?.correct ?? false
              return (
                <div key={question.id} className="rounded-2xl bg-pcard p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-psubtle">
                    {questionIndex + 1}/{check.questions.length} · {tt(EXERCISE_LABEL[question.kind])}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-pfg">{question.prompt}</p>
                  <p className={cn('mt-1.5 text-[12px] font-bold', correct ? 'text-psuccess' : 'text-pdanger')}>
                    {correct ? tt('rusDarslikQuizCorrect') : tt('rusDarslikQuizWrong')}
                  </p>
                  {!correct && (
                    <p className="mt-1 text-[12px] leading-relaxed text-pmuted">
                      {tt('rusDarslikCheckYourAnswer')}: {answerText(question, answers[question.id])}
                    </p>
                  )}
                  {lesson && !correct && item?.correctAnswer && (
                    <p className="mt-1 text-[12px] font-semibold leading-relaxed text-psuccess">
                      {tt('rusDarslikQuizCorrectAnswer')}: {item.correctAnswer}
                    </p>
                  )}
                  {item?.explanation && (
                    <p className="mt-1 text-[12px] leading-relaxed text-pmuted">
                      {tt('rusDarslikQuizExplanation')}: {item.explanation}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-pline px-3 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
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

        <div className="h-1.5 bg-psurface" role="progressbar" aria-label={tt('rusDarslikLessonProgress')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (phase === 'feedback' ? 1 : 0)}>
          <div
            className="h-full rounded-r-full bg-pprimary transition-[width] duration-300"
            style={{ width: String(Math.round(((index + (phase === 'feedback' ? 1 : 0)) / Math.max(1, total)) * 100)) + '%' }}
          />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(6.5rem+var(--safe-bottom,0px))]">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="relative block size-11 shrink-0">
                <PathMascot animation={phase === 'feedback' ? (feedback?.correct ? 'happy' : 'oops') : 'idle'} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-pprimary">
                  {tt(EXERCISE_LABEL[current.kind])}
                </p>
                <p className="text-[11px] font-medium text-pmuted">{tt('rusDarslikLessonSource')}</p>
              </div>
            </div>

            <h3
              id="lesson-runner-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-[18px] font-semibold leading-snug text-pfg focus-visible:outline-none"
            >
              {current.prompt}
            </h3>

            <div className="mt-4">
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

            {phase === 'feedback' && feedback && (
              <div
                ref={feedbackRef}
                data-testid="lesson-feedback"
                data-correct={feedback.correct ? 'true' : 'false'}
                role="status"
                aria-live="polite"
                className={cn(
                  'mt-4 rounded-2xl border p-3.5',
                  feedback.correct
                    ? 'border-[rgb(var(--p-success-rgb)/0.35)] bg-[rgb(var(--p-success-rgb)/0.08)]'
                    : 'border-[rgb(var(--p-danger-rgb)/0.35)] bg-[rgb(var(--p-danger-rgb)/0.07)]',
                )}
              >
                <p className={cn('flex items-center gap-1.5 text-[14px] font-bold', feedback.correct ? 'text-psuccess' : 'text-pdanger')}>
                  {feedback.correct ? <CheckCircle2 size={17} strokeWidth={2.5} /> : <XCircle size={17} strokeWidth={2.5} />}
                  {feedback.correct ? tt('rusDarslikLessonCorrect') : tt('rusDarslikLessonWrong')}
                </p>
                {!feedback.correct && (
                  <p className="mt-1.5 text-[13px] font-semibold leading-snug text-pfg">
                    {tt('rusDarslikQuizCorrectAnswer')}: <span className="text-psuccess">{feedback.correctAnswer}</span>
                  </p>
                )}
                <p className="mt-1 text-[12.5px] leading-relaxed text-pmuted">{feedback.explanation}</p>
              </div>
            )}

            {answerError && (
              <p role="alert" className="mt-3 rounded-xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-3 py-2 text-[12.5px] font-medium text-pdanger">
                {tt('rusDarslikLessonAnswerError')}
              </p>
            )}
            {submitError && (
              <p role="alert" className="mt-3 rounded-xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-3 py-2 text-[12.5px] font-medium text-pdanger">
                {tt('rusDarslikCheckSubmitError')}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-pline bg-pcanvas px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
          <div className="mx-auto w-full max-w-[440px]">
            {phase === 'exercise' ? (
              <Button size="lg" block onClick={() => { void checkAnswer() }} disabled={!currentAnswered || checking}>
                {checking ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
              </Button>
            ) : (
              <Button size="lg" block onClick={continueLesson} disabled={submitting}>
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
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-psubtle">
          {tt('rusDarslikCheckCount').replace('{count}', String(check.questions.length))}
        </p>
        <h3 id="rus-check-title" className="text-[17px] font-semibold leading-snug text-pfg">{title}</h3>

        <div className="mt-4 flex flex-col gap-4">
          {check.questions.map((question, questionIndex) => (
            <section key={question.id} className="rounded-2xl bg-pcard p-3.5 shadow-xs" aria-labelledby={'rus-check-q-' + questionIndex}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-psubtle">
                {tt(EXERCISE_LABEL[question.kind])} · {questionIndex + 1}/{check.questions.length}
              </p>
              <h4 id={'rus-check-q-' + questionIndex} className="mt-1 text-[14px] font-semibold leading-snug text-pfg">
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
          <p role="alert" className="mt-4 rounded-xl bg-[rgb(var(--p-danger-rgb)/0.10)] px-3 py-2 text-[12.5px] font-medium text-pdanger">
            {tt('rusDarslikCheckSubmitError')}
          </p>
        )}
        {!legacyAnswered && (
          <p className="mt-4 text-center text-[11.5px] font-medium text-pmuted">{tt('rusDarslikCheckAllRequired')}</p>
        )}
      </div>

      <div className="border-t border-pline px-3 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
        <Button size="lg" block onClick={() => { void submit() }} disabled={!legacyAnswered || submitting}>
          {submitting ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
        </Button>
      </div>
    </div>
  )
}
