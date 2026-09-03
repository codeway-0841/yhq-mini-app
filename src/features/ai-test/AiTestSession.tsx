/**
 * AI Kunlik Test — SESSIYA sahifasi (/ai-test/:id).
 *
 * 45 topshiriq (4 bo'lim, global raqamlash 1..45), vaqt limitisiz.
 * Javoblar persist-store'da (resume xavfsiz). Submit idempotent (clientToken).
 * Natija rejimi: bo'limlar kesimi + reveal (grading + public payload).
 *
 * Xavfsizlik: correctAnswer FAQAT submit'dan keyin server javobidan (grading).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Sparkles, Lock, AlertTriangle } from 'lucide-react'
import { api, ApiError } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { track } from '../../shared/lib/analytics'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import DialogOverlay from '../../shared/components/DialogOverlay'
import Confetti from '../../shared/components/Confetti'
import {
  AI_TEST_SECTIONS, AI_TEST_TOTAL_TASKS, AI_TEST_GRADED_TASKS,
  type AiTestAnswers, type AiTestGrading, type AiTestPublicPayload,
} from '../../../shared/ai-daily-test'
import { useAiTestStore, countAnsweredTasks } from './useAiTestStore'
import { McqTaskView, MatchingTaskView, ShortTaskView, EssayTaskView } from './components/TaskCards'

type Phase = 'loading' | 'error' | 'premium' | 'session' | 'submitting' | 'result'

type TestData = AiTestPublicPayload & { id: number; slot: number; date: string }

interface ResultState {
  grading: AiTestGrading
  answers: AiTestAnswers
  coinsAwarded: number
}

function newClientToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* eski WebView */ }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export default function AiTestSession() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const testId = Number(params.id)

  const settings  = useAppStore((s) => s.settings)
  const tt = useT(settings.language)
  const lang = settings.language

  const answers  = useAiTestStore((s) => s.answers)
  const start    = useAiTestStore((s) => s.start)
  const setMcq   = useAiTestStore((s) => s.setMcq)
  const setMatching = useAiTestStore((s) => s.setMatching)
  const setShort = useAiTestStore((s) => s.setShort)
  const setEssay = useAiTestStore((s) => s.setEssay)
  const resetSession = useAiTestStore((s) => s.reset)

  const [phase, setPhase] = useState<Phase>('loading')
  const [test, setTest] = useState<TestData | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  // clientToken — sessiya boshida 1 marta; retry'lar o'sha token bilan (idempotency)
  const clientTokenRef = useRef<string>(newClientToken())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await api.getAiTest(testId)
        if (cancelled) return
        setTest(r.test)
        start(testId)
        setPhase('session')
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 409) {
          // Allaqachon yechilgan — natijani ko'rsatamiz
          try {
            const rr = await api.getAiTestResult(testId)
            if (cancelled) return
            setTest(rr.test)
            setResult({ grading: rr.attempt.grading, answers: rr.attempt.answers, coinsAwarded: rr.attempt.coinsAwarded })
            setPhase('result')
          } catch { if (!cancelled) setPhase('error') }
        } else if (e instanceof ApiError && e.status === 403) {
          setPhase('premium')
        } else {
          setPhase('error')
        }
      }
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  const answeredCount = useMemo(
    () => (test ? countAnsweredTasks(answers, test) : 0),
    [answers, test],
  )
  const unanswered = test ? AI_TEST_TOTAL_TASKS - answeredCount : 0

  async function submit() {
    if (!test) return
    setConfirmOpen(false)
    setPhase('submitting')
    track('ai_test_submit', { slot: test.slot })
    try {
      const r = await api.submitAiTest(test.id, { answers, clientToken: clientTokenRef.current })
      playSound('win')
      haptics.notify('success')
      setResult({ grading: r.grading, answers, coinsAwarded: r.coinsAwarded })
      resetSession()
      setPhase('result')
      window.scrollTo({ top: 0 })
    } catch {
      haptics.notify('error')
      setSubmitError(true)
      setPhase('session')
    }
  }

  // ── Yuklanish / xato / premium holatlari ─────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="grid place-items-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-ppurple border-t-transparent animate-spin" />
      </div>
    )
  }

  if (phase === 'premium') {
    return (
      <div className="px-4 pt-16 text-center">
        <Lock size={36} strokeWidth={1.75} className="mx-auto mb-3" style={{ color: 'var(--p-purple)' }} />
        <p className="text-[16px] font-semibold text-pfg mb-4">{tt('aiTestPremiumCta')}</p>
        <button onClick={() => navigate('/premium')} className="btn-premium">Premium</button>
        <button onClick={() => goBack(navigate)} className="block mx-auto mt-3 text-[13px] text-psubtle">{tt('backWord')}</button>
      </div>
    )
  }

  if (phase === 'error' || !test) {
    return (
      <div className="px-4 pt-16 text-center">
        <AlertTriangle size={32} strokeWidth={1.75} className="mx-auto mb-3 text-pwarning" />
        <p className="text-[15px] text-pmuted mb-4">{tt('aiTestLoadError')}</p>
        <button onClick={() => goBack(navigate)} className="btn-premium-secondary">{tt('backWord')}</button>
      </div>
    )
  }

  const sectionLabel = (kind: string) =>
    AI_TEST_SECTIONS.find((s) => s.kind === kind)?.label[lang] ?? kind

  // ── Topshiriqlar ro'yxati (session + result umumiy renderer) ──────────────
  const renderTasks = (review: boolean) => {
    const shownContexts = new Set<string>()
    let currentKind = ''
    const out: React.ReactNode[] = []

    test.tasks.forEach((task, idx) => {
      const num = idx + 1
      if (task.kind !== currentKind) {
        currentKind = task.kind
        out.push(
          <div key={`sec-${task.kind}`} className="mt-5 mb-1 px-1">
            <p className="text-[12px] font-bold uppercase tracking-wide text-psubtle">{sectionLabel(task.kind)}</p>
          </div>,
        )
      }
      switch (task.kind) {
        case 'mcq':
          out.push(
            <McqTaskView key={task.id} task={task} num={num}
              value={result?.answers.mcq[task.id] ?? answers.mcq[task.id]}
              onChange={review ? undefined : (oid) => { playSound('click'); setMcq(task.id, oid) }}
              review={review ? result?.grading.mcq[task.id] : undefined} />,
          )
          break
        case 'matching':
          out.push(
            <MatchingTaskView key={task.id} task={task} num={num}
              value={result?.answers.matching[task.id] ?? answers.matching[task.id]}
              onChange={review ? undefined : (lid, rid) => { playSound('click'); setMatching(task.id, lid, rid) }}
              review={review ? result?.grading.matching[task.id] : undefined}
              hint={tt('aiTestMatchingHint')} />,
          )
          break
        case 'short': {
          if (!shownContexts.has(task.contextId)) {
            shownContexts.add(task.contextId)
            const ctx = test.contexts.find((c) => c.id === task.contextId)
            if (ctx) {
              out.push(
                <div key={`ctx-${ctx.id}`} className="rounded-2xl bg-psurface p-4 shadow-xs">
                  <p className="text-[14px] text-pmuted leading-relaxed whitespace-pre-wrap">{ctx.text}</p>
                </div>,
              )
            }
          }
          out.push(
            <ShortTaskView key={task.id} task={task} num={num}
              value={result?.answers.short[task.id] ?? answers.short[task.id]}
              onChange={review ? undefined : (v) => setShort(task.id, v)}
              review={review ? result?.grading.short[task.id] : undefined}
              yourAnswerLabel={tt('aiTestYourAnswer')}
              correctAnswerLabel={tt('aiTestCorrectAnswer')} />,
          )
          break
        }
        case 'essay':
          out.push(
            <EssayTaskView key={task.id} task={task} num={num}
              value={result?.answers.essay ?? answers.essay}
              onChange={review ? undefined : setEssay}
              review={review ? result?.grading.essay : undefined}
              placeholder={tt('aiTestEssayPlaceholder')}
              wordsLabel={tt('aiTestWords')} />,
          )
          break
      }
    })
    return out
  }

  // ── NATIJA ─────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const g = result.grading
    return (
      <div className="px-4 pb-4">
        {result.coinsAwarded > 0 && <Confetti />}
        <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
          <button onClick={() => navigate('/ai-test')} aria-label={tt('backWord')}
            className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <h1 className="text-xl font-semibold truncate">{tt('aiTestResultTitle')} · {test.title}</h1>
        </header>

        {/* Xulosa kartasi */}
        <div className="rounded-2xl bg-pcard p-5 mb-4 text-center shadow-xs">
          <p className="text-[34px] font-bold leading-none"
            style={{ color: 'var(--p-purple)' }}>
            {g.correctCount}<span className="text-[18px] text-psubtle">/{AI_TEST_GRADED_TASKS}</span>
          </p>
          <p className="text-[12.5px] text-psubtle mt-1">{tt('aiTestCorrectWord')} · 1–3 {tt('aiTestTaskWord').toLowerCase()}</p>
          <div className="mt-3 flex items-center justify-center gap-4 text-[13px] font-semibold">
            <span className="text-pfg">{tt('aiTestEssayScore')}: {g.essay ? `${g.essayScore}/10` : '—'}</span>
            <span style={{ color: 'var(--p-gold)' }}>+{result.coinsAwarded} 🪙</span>
          </div>
          {g.essay === null && (
            <p className="mt-2 text-[12px] text-pwarning">{tt('aiTestEssayUngraded')}</p>
          )}
        </div>

        <p className="text-[12px] font-bold uppercase tracking-wide text-psubtle mb-2 px-1">{tt('aiTestReviewTitle')}</p>
        <div className="flex flex-col gap-3">
          {renderTasks(true)}
        </div>

        <button onClick={() => navigate('/ai-test')} className="btn-premium w-full mt-5">
          {tt('aiTestBackToList')}
        </button>
      </div>
    )
  }

  // ── SESSIYA ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-28">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
            className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold truncate">{test.title}</h1>
          </div>
          <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--p-purple)' }}>
            {answeredCount}/{AI_TEST_TOTAL_TASKS}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-psurface overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(answeredCount / AI_TEST_TOTAL_TASKS) * 100}%`, background: 'var(--p-purple)' }} />
        </div>
      </header>

      {submitError && (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-2xl bg-[rgb(var(--p-warning-rgb)/0.12)] px-3.5 py-2.5 text-[12.5px] font-medium text-pfg shadow-xs">
          <AlertTriangle size={15} strokeWidth={2} className="text-pwarning flex-shrink-0" />
          {tt('authGenericError')}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {renderTasks(false)}
      </div>

      {/* Pastki submit paneli (safe-bottom qoidasi 13a) */}
      <div className="fixed inset-x-4 bottom-[calc(0.75rem+var(--safe-bottom,0px))] z-40">
        <button
          onClick={() => { setSubmitError(false); if (unanswered > 0) setConfirmOpen(true); else void submit() }}
          disabled={phase === 'submitting'}
          className="btn-premium w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {phase === 'submitting' ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-ponprimary border-t-transparent animate-spin" />
              {tt('aiTestSubmitting')}
            </>
          ) : (
            <>
              <Sparkles size={17} strokeWidth={2} />
              {tt('aiTestSubmit')}
              {unanswered > 0 && <span className="opacity-75">({answeredCount}/{AI_TEST_TOTAL_TASKS})</span>}
            </>
          )}
        </button>
      </div>

      {/* Tasdiq sheet'i — javobsiz topshiriqlar qolganda */}
      {confirmOpen && (
        <DialogOverlay onClose={() => setConfirmOpen(false)} labelId="ai-test-confirm-title">
          <div className="p-5">
            <h2 id="ai-test-confirm-title" className="text-[17px] font-bold text-pfg mb-2">{tt('aiTestConfirmTitle')}</h2>
            <p className="text-[14px] text-pmuted mb-1">
              {unanswered} {tt('aiTestUnansweredLeft')}
            </p>
            <p className="text-[13px] text-psubtle mb-4">{tt('aiTestConfirmNote')}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="btn-premium-secondary flex-1">{tt('aiTestCancel')}</button>
              <button onClick={() => void submit()} className="btn-premium flex-1">{tt('aiTestSubmit')}</button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  )
}
