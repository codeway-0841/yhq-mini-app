/**
 * AI Kurs darsi (/ai-kurslar/:courseId/dars/:lessonId).
 * 3 tab: Dars (TLDR + sahifalar) / Mashq (4 quiz tipi) / Kartalar.
 * Yakunlash: POST .../complete → ball + coin + bilim kartalari.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUp, ArrowDown, CheckCircle2, Loader2, Lock, RotateCcw } from 'lucide-react'
import { api, ApiError } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
import { useToast } from '../../shared/components/ToastContainer'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../shared/components/ui/tabs'
import { track } from '../../shared/lib/analytics'
import {
  isLessonFullyAnswered,
  type AiCourseAnswers,
  type AiCourseClozePublic,
  type AiCourseGrading,
  type AiCourseKnowledgeCard,
  type AiCourseLessonPublic,
  type AiCourseOrderPublic,
  type AiCoursePage,
} from '../../../shared/ai-courses'

function newClientToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

/** {{c1}} marker'larni qismlarga ajratish */
function splitTemplate(template: string): { text?: string; blank?: string }[] {
  const parts: { text?: string; blank?: string }[] = []
  const re = /\{\{(\w+)\}\}/g
  let last = 0
  for (const m of template.matchAll(re)) {
    if (m.index > last) parts.push({ text: template.slice(last, m.index) })
    parts.push({ blank: m[1] })
    last = m.index + m[0].length
  }
  if (last < template.length) parts.push({ text: template.slice(last) })
  return parts
}

function VisualBlock({ page }: { page: Extract<AiCoursePage, { kind: 'visual' }> }) {
  const max = Math.max(1, ...page.items.map((i) => i.value))
  if (page.style === 'cycle') {
    return (
      <div className="flex flex-col gap-2">
        {page.items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-3 rounded-xl bg-psurface p-3 shadow-2xs">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pprimary text-[13px] font-bold text-ponprimary">
              {i + 1}
            </span>
            <span className="text-[13.5px] font-semibold text-pfg">{it.label}</span>
          </div>
        ))}
      </div>
    )
  }
  if (page.style === 'pie-chart') {
    const total = page.items.reduce((n, i) => n + i.value, 0) || 1
    let acc = 0
    const stops = page.items.map((it, i) => {
      const from = (acc / total) * 360
      acc += it.value
      const to = (acc / total) * 360
      const colors = ['var(--p-primary)', 'var(--p-gold)', 'var(--p-blue)', 'var(--p-purple)', 'var(--p-success)', 'var(--p-warning)']
      return `${colors[i % colors.length]} ${from}deg ${to}deg`
    })
    return (
      <div className="flex items-center gap-4">
        <div
          className="size-24 shrink-0 rounded-full shadow-xs"
          style={{ background: `conic-gradient(${stops.join(', ')})` }}
          role="img"
          aria-label={page.heading}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          {page.items.map((it) => (
            <div key={it.label} className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="truncate text-pmuted">{it.label}</span>
              <span className="font-bold text-pfg">{Math.round((it.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {page.items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-[12.5px]">
            <span className="text-pmuted">{it.label}</span>
            <span className="font-bold text-pfg">{it.value}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-psurface">
            <div className="h-full rounded-full bg-pprimary" style={{ width: `${Math.round((it.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AiCourseLesson() {
  const navigate = useNavigate()
  const { courseId: courseIdRaw, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const courseId = Number(courseIdRaw)
  const language = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const { error: showError } = useToast()
  const tt = useT(language)

  const [lesson, setLesson] = useState<AiCourseLessonPublic | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [answers, setAnswers] = useState<AiCourseAnswers>({ flashcard: {}, mcq: {}, cloze: {}, order: {} })
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ grading: AiCourseGrading; coins: number; cards: AiCourseKnowledgeCard[] } | null>(null)
  const tokenRef = useRef<string>(newClientToken())

  useEffect(() => {
    if (!Number.isInteger(courseId) || courseId < 1 || !lessonId) { setLoadError(true); return }
    let cancelled = false
    api.getAiCourse(courseId)
      .then((r) => {
        if (cancelled) return
        const found = r.course.sections.flatMap((s) => s.lessons).find((l) => l.id === lessonId)
        if (!found) { setLoadError(true); return }
        setLesson(found)
        setCourseTitle(r.course.title)
        setAlreadyDone(r.course.completedLessonIds.includes(lessonId))
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [courseId, lessonId])

  const complete = async () => {
    if (!lesson || busy) return
    if (!isLessonFullyAnswered(lesson.practices, answers)) {
      showError(tt('aiCourseIncomplete'))
      return
    }
    setBusy(true)
    try {
      track('ai_course_lesson_complete', { course: courseId })
      const r = await api.completeAiCourseLesson(courseId, lesson.id, {
        answers, clientToken: tokenRef.current,
      })
      setResult({ grading: r.grading, coins: r.coinsAwarded, cards: r.knowledgeCards ?? [] })
      setAlreadyDone(true)
      // Dars yakunlash ham kunlik faollik — streak yoziladi (Darslik pattern'i)
      void useDailyStore.getState().touchActivity(
        userId, todayStr(), useSubjectStore.getState().subjectId,
      )
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'LESSON_INCOMPLETE')) showError(tt('aiCourseLoadError'))
      // Javob o'zgartirib qayta urinish — yangi idempotency token (eski javob bilan bog'lanmasligi uchun)
      tokenRef.current = newClientToken()
      setBusy(false)
    }
  }

  const tabDefault = useMemo(() => 'read', [])

  if (loadError) {
    return (
      <div className="px-4 pb-4">
        <PageHeader title={tt('aiCourseTitle')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
          <p className="text-[14px] text-pmuted">{tt('aiCourseLoadError')}</p>
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="px-4 pb-4">
        <PageHeader title={tt('aiCourseTitle')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-ppurple border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4">
      <PageHeader title={lesson.title} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />

      <Tabs defaultValue={tabDefault}>
        <TabsList className="mb-3 grid w-full grid-cols-3">
          <TabsTrigger value="read">{tt('aiCourseTldr')}</TabsTrigger>
          <TabsTrigger value="practice">{tt('aiCoursePractice')}</TabsTrigger>
          <TabsTrigger value="cards">{tt('aiCourseCards')}</TabsTrigger>
        </TabsList>

        <TabsContent value="read">
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-pcard p-4 shadow-xs">
              <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ppurple">{tt('aiCourseTldr')}</p>
              <p className="text-[14px] leading-relaxed text-pfg">{lesson.tldr}</p>
            </div>
            {lesson.pages.map((p, i) => (
              <div key={i} className="rounded-2xl bg-pcard p-4 shadow-xs">
                <p className="mb-2 text-[14px] font-bold text-pfg">{p.heading}</p>
                {p.kind === 'text'
                  ? <p className="text-[14px] leading-relaxed text-pfg">{p.body}</p>
                  : <VisualBlock page={p} />}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="practice">
          <div className="flex flex-col gap-3">
            {lesson.practices.map((p, idx) => (
              <div key={p.id} className="rounded-2xl bg-pcard p-4 shadow-xs">
                <p className="mb-1 text-[12px] font-semibold text-pmuted">{idx + 1} · {tt('aiCoursePractice')}</p>
                <p className="mb-3 text-[14px] font-bold text-pfg">{p.prompt}</p>

                {p.kind === 'flashcard' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setFlipped((f) => ({ ...f, [p.id]: !f[p.id] }))}
                      className="w-full rounded-xl bg-psurface p-3 text-center text-[13.5px] text-pfg shadow-2xs transition-all active:scale-[0.98]"
                    >
                      {flipped[p.id] ? p.answer : <RotateCcw size={18} className="mx-auto text-pmuted" />}
                    </button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['known', 'unknown'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, flashcard: { ...a.flashcard, [p.id]: v } }))}
                          className={`rounded-xl px-2 py-2 text-[13px] font-semibold transition-all active:scale-[0.97] ${
                            answers.flashcard[p.id] === v
                              ? v === 'known' ? 'bg-psuccess text-white shadow-md' : 'bg-pdanger text-white shadow-md'
                              : 'bg-psurface text-pmuted shadow-2xs'
                          }`}
                        >
                          {v === 'known' ? tt('aiCourseFlashKnown') : tt('aiCourseFlashUnknown')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {p.kind === 'mcq' && (
                  <div className="flex flex-col gap-2">
                    {p.options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, mcq: { ...a.mcq, [p.id]: o.id } }))}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-all active:scale-[0.98] ${
                          answers.mcq[p.id] === o.id
                            ? 'bg-pprimary text-ponprimary shadow-md'
                            : 'bg-psurface text-pfg shadow-2xs'
                        }`}
                      >
                        {o.text}
                      </button>
                    ))}
                  </div>
                )}

                {p.kind === 'cloze' && (
                  <ClozePractice
                    practice={p}
                    value={answers.cloze[p.id] ?? {}}
                    onChange={(blankId, text) => setAnswers((a) => ({
                      ...a, cloze: { ...a.cloze, [p.id]: { ...(a.cloze[p.id] ?? {}), [blankId]: text } },
                    }))}
                  />
                )}

                {p.kind === 'order' && (
                  <OrderPractice
                    practice={p}
                    value={answers.order[p.id] ?? p.steps.map((s) => s.id)}
                    onChange={(order) => setAnswers((a) => ({ ...a, order: { ...a.order, [p.id]: order } }))}
                  />
                )}
              </div>
            ))}

            {!result ? (
              <button
                type="button"
                onClick={complete}
                disabled={busy || alreadyDone}
                className="btn-premium flex w-full items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                {busy ? tt('aiCourseCompleting') : alreadyDone ? tt('aiCourseDone') : tt('aiCourseComplete')}
              </button>
            ) : (
              <div className="rounded-2xl bg-pcard p-4 text-center shadow-xs">
                <CheckCircle2 size={32} strokeWidth={1.75} className="mx-auto mb-2 text-psuccess" />
                <p className="text-[16px] font-bold text-pfg">{tt('aiCourseResultTitle')}</p>
                <p className="mt-1 text-[14px] text-pmuted">
                  {tt('aiCourseScore')}: {result.grading.correctCount}/{result.grading.totalCount}
                  {' · '}+{result.coins} {tt('aiCourseCoinsEarned')}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/ai-kurslar/${courseId}`)}
                  className="btn-premium mt-3 w-full"
                >
                  {tt('aiCourseBackToCourse')}
                </button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cards">
          {!alreadyDone && !result ? (
            <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
              <Lock size={24} className="mx-auto mb-2 text-pmuted" />
              <p className="text-[14px] text-pmuted">{tt('aiCourseComplete')} — {tt('aiCourseCards')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(result?.cards ?? lesson.knowledgeCards).map((c) => (
                <div key={c.id} className="rounded-2xl bg-pcard p-4 shadow-xs">
                  <p className="mb-1 text-[14px] font-bold text-pgold">{c.title}</p>
                  <p className="text-[13.5px] leading-relaxed text-pfg">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-3 text-center text-[11px] text-psubtle">{courseTitle}</p>
    </div>
  )
}

function ClozePractice({
  practice, value, onChange,
}: {
  practice: AiCourseClozePublic
  value: Record<string, string>
  onChange: (blankId: string, text: string) => void
}) {
  return (
    <p className="text-[14px] leading-loose text-pfg">
      {splitTemplate(practice.template).map((part, i) =>
        part.blank ? (
          <select
            key={i}
            value={value[part.blank] ?? ''}
            onChange={(e) => onChange(part.blank as string, e.target.value)}
            className="mx-1 inline-block max-w-full rounded-lg bg-psurface px-2 py-1 text-[13px] font-semibold text-pprimary shadow-2xs"
            aria-label={part.blank}
          >
            <option value="">···</option>
            {practice.pool.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  )
}

function OrderPractice({
  practice, value, onChange,
}: {
  practice: AiCourseOrderPublic
  value: string[]
  onChange: (order: string[]) => void
}) {
  const byId = new Map(practice.steps.map((s) => [s.id, s]))
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2">
      {value.map((id, idx) => (
        <div key={id} className="flex items-center gap-2 rounded-xl bg-psurface p-2.5 shadow-2xs">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pprimary text-[12px] font-bold text-ponprimary">
            {idx + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-pfg">{byId.get(id)?.text ?? id}</span>
          <button type="button" aria-label="up" onClick={() => move(idx, -1)} className="p-1 text-pmuted active:scale-90">
            <ArrowUp size={16} />
          </button>
          <button type="button" aria-label="down" onClick={() => move(idx, 1)} className="p-1 text-pmuted active:scale-90">
            <ArrowDown size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
