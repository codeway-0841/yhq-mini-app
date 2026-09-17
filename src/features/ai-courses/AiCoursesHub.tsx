/**
 * AI Kurslar — HUB sahifasi (/ai-kurslar).
 * Mening kurslarim (progress bilan) + yaratish CTA.
 * Ma'lumot: GET /api/ai-courses (server, no-store).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Plus, CheckCircle2, BookOpen, Lightbulb, Compass } from 'lucide-react'
import { api } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Progress } from '../../shared/components/ui/progress'
import { track } from '../../shared/lib/analytics'

interface HubCourse {
  id: number
  title: string
  topic: string
  inputKind: string
  language: string
  totalLessons: number
  completedLessons: number
  createdAt: string
}

interface HubLimit {
  used: number
  total: number
  premium: boolean
}

/** Kurs vizual ID'si — id hash'idan deterministik yumshoq tint + ikonka */
const TINTS = [
  { bg: '--p-purple-rgb', fg: 'text-ppurple', Icon: Sparkles },
  { bg: '--p-blue-rgb', fg: 'text-pblue', Icon: BookOpen },
  { bg: '--p-gold-rgb', fg: 'text-pgold', Icon: Lightbulb },
  { bg: '--p-success-rgb', fg: 'text-psuccess', Icon: Compass },
] as const

function tintFor(id: number): (typeof TINTS)[number] {
  return TINTS[Math.abs(id) % TINTS.length]
}

export default function AiCoursesHub() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const tt = useT(settings.language)

  const [courses, setCourses] = useState<HubCourse[] | null>(null)
  const [limit, setLimit] = useState<HubLimit | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getAiCourses()
      .then((r) => {
        if (cancelled) return
        setCourses(r.courses)
        setLimit(r.limit)
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  const limitLine = limit
    ? tt('aiCourseLimitLine')
      .replace('{used}', String(limit.used))
      .replace('{total}', String(limit.total))
    : null

  return (
    <div className="px-4 pb-4">
      <PageHeader title={tt('aiCourseTitle')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] text-pmuted">{tt('aiCourseMeta')}</p>
        {limitLine && (
          <p className="shrink-0 rounded-full bg-psurface px-2.5 py-1 text-[11px] font-bold text-pmuted shadow-2xs">
            {limitLine}
          </p>
        )}
      </div>

      {courses === null && !error && (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-ppurple border-t-transparent animate-spin" />
        </div>
      )}

      {(error || (courses !== null && courses.length === 0)) && (
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
          <Sparkles size={28} strokeWidth={1.75} className="mx-auto mb-2 text-ppurple" />
          <p className="text-[14px] text-pmuted">{error ? tt('aiCourseLoadError') : tt('aiCourseEmpty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {courses?.map((c) => {
          const done = c.completedLessons >= c.totalLessons && c.totalLessons > 0
          const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0
          const tint = tintFor(c.id)
          const TintIcon = done ? CheckCircle2 : tint.Icon
          return (
            <button
              key={c.id}
              onClick={() => { track('ai_course_open', { id: c.id }); navigate(`/ai-kurslar/${c.id}`) }}
              className="rounded-2xl bg-pcard w-full p-4 text-left shadow-xs transition-all hover:bg-psurface active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `rgb(var(${tint.bg}) / 0.14)` }}
                >
                  <TintIcon size={22} strokeWidth={1.75} className={done ? 'text-psuccess' : tint.fg} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-pfg">{c.title}</p>
                  <p className="mt-0.5 text-[12px] text-pmuted">
                    {c.completedLessons}/{c.totalLessons} {tt('aiCourseLessonsWord')}
                    {done ? ` · ${tt('aiCourseDone')}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Progress value={pct} />
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => { track('ai_course_create_start'); navigate('/ai-kurslar/yangi') }}
        className="btn-premium mt-4 flex w-full items-center justify-center gap-2"
      >
        <Plus size={18} strokeWidth={2} />
        {tt('aiCourseCreate')}
      </button>
    </div>
  )
}
