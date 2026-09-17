/**
 * AI Kurs tafsiloti (/ai-kurslar/:id) — roadmap: Section → Lesson ro'yxati.
 * GET /api/ai-courses/:id (public payload + completedLessonIds).
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Play, Sparkles } from 'lucide-react'
import { api } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Progress } from '../../shared/components/ui/progress'
import { findFirstIncompleteLesson, type AiCoursePayloadPublic } from '../../../shared/ai-courses'

interface DetailCourse extends AiCoursePayloadPublic {
  id: number
  title: string
  topic: string
  totalLessons: number
  completedLessons: number
  completedLessonIds: string[]
}

export default function AiCourseDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const courseId = Number(id)
  const settings = useAppStore((s) => s.settings)
  const tt = useT(settings.language)

  const [course, setCourse] = useState<DetailCourse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!Number.isInteger(courseId) || courseId < 1) { setError(true); return }
    let cancelled = false
    api.getAiCourse(courseId)
      .then((r) => { if (!cancelled) setCourse(r.course) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [courseId])

  // Darsdan qaytganda progress yangilansin (complete o'sha yerda bo'ladi)
  useEffect(() => {
    const onFocus = () => {
      if (!Number.isInteger(courseId) || courseId < 1) return
      api.getAiCourse(courseId).then((r) => setCourse(r.course)).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [courseId])

  if (error) {
    return (
      <div className="px-4 pb-4">
        <PageHeader title={tt('aiCourseTitle')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
          <p className="text-[14px] text-pmuted">{tt('aiCourseLoadError')}</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="px-4 pb-4">
        <PageHeader title={tt('aiCourseTitle')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-ppurple border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  const doneSet = new Set(course.completedLessonIds)
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0
  const nextLessonId = findFirstIncompleteLesson(course, doneSet)

  return (
    <div className="px-4 pb-4">
      <PageHeader title={course.title} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />

      <div className="mb-4 rounded-2xl bg-pcard p-4 shadow-xs">
        <div className="flex items-center gap-2 text-[12px] text-pmuted">
          <Sparkles size={14} strokeWidth={1.75} />
          {course.completedLessons}/{course.totalLessons} {tt('aiCourseLessonsWord')}
        </div>
        <div className="mt-2">
          <Progress value={pct} label={`${pct}%`} />
        </div>
        {nextLessonId && (
          <button
            type="button"
            onClick={() => navigate(`/ai-kurslar/${course.id}/dars/${nextLessonId}`)}
            className="btn-premium mt-3 flex w-full items-center justify-center gap-2"
          >
            <Play size={16} strokeWidth={2} />
            {course.completedLessons === 0 ? tt('aiCourseStartLesson') : tt('aiCourseContinue')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {course.sections.map((s) => (
          <section key={s.id}>
            <h2 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-pmuted">
              {s.title}
            </h2>
            <div className="flex flex-col gap-2">
              {s.lessons.map((l) => {
                const done = doneSet.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/ai-kurslar/${course.id}/dars/${l.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-pcard p-3.5 text-left shadow-xs transition-all hover:bg-psurface active:scale-[0.98]"
                  >
                    {done
                      ? <CheckCircle2 size={22} strokeWidth={1.75} className="shrink-0 text-psuccess" />
                      : <Circle size={22} strokeWidth={1.75} className="shrink-0 text-pmuted" />}
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-pfg">{l.title}</span>
                      <span className="block truncate text-[12px] text-pmuted">
                        {l.practices.length} {tt('aiCoursePractice')} · {l.knowledgeCards.length} {tt('aiCourseCards')}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
