import { memo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { type Lang, useT } from '../../../shared/i18n'
import { SUBJECTS } from '../../../shared/config/subjects'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { modules } from '../../../content/modules'

// ── Subject slide ───────────────────────────────────────────────────────────
const SubjectSlide = memo(function SubjectSlide({ subjectId, lang, done, total, active, onOpen }: {
  subjectId: string
  lang: Lang
  done: number
  total: number
  active: boolean
  onOpen: () => void
}) {
  const s = SUBJECTS.find((x) => x.id === subjectId) ?? SUBJECTS[0]
  const Icon = s.icon
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const tt = useT(lang)

  return (
    <div className="relative w-full h-full card-premium rounded-[24px] p-4 cursor-pointer select-none"
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}>
      {/* Ghost icon — top-right dekor */}
      <Icon size={22} className="absolute top-3.5 right-3.5 opacity-25" style={{ color: s.color }} aria-hidden />

      <div className="flex items-center gap-3.5">
        {/* Icon tile */}
        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(145deg, ${s.color}, ${s.colorDark})`, boxShadow: `0 4px 12px ${s.color}40` }}>
          <Icon size={22} className="text-white" />
        </div>

        {/* Title + progress */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-pfg leading-tight truncate">
            {lang === 'ru' ? s.nameRu : s.name}
          </p>
          {s.demoData ? (
            <p className="text-[11px] font-medium text-psubtle mt-0.5">
              {lang === 'ru' ? 'Демо-режим · база скоро' : 'Demo rejim · baza tez orada'}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-psubtle mt-0.5 tabular-nums">
              {done} / {total} {tt('lessonWord')}
            </p>
          )}
          {!s.demoData && (
            <div className="h-1.5 rounded-full bg-pline overflow-hidden mt-2">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, background: s.color }} />
            </div>
          )}
        </div>

        {/* CTA */}
        <button type="button"
          className="btn-premium btn-premium-sm flex items-center gap-1 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onOpen() }}>
          {tt('continueLearn')}
          <ChevronRight size={14} />
        </button>
      </div>

      {active && (
        <span className="absolute bottom-3.5 left-4 text-[10px] font-semibold text-psubtle tabular-nums">
          {lang === 'ru' ? 'Текущий предмет' : 'Joriy fan'}
        </span>
      )}
    </div>
  )
})

// ── Main Carousel — native scroll-snap (JS gesture-math YO'Q) ───────────────
export const Carousel = memo(function Carousel({ lang, onContinue }: {
  lang: Lang
  onContinue?: () => void
}) {
  const navigate = useNavigate()
  const userId   = useAppStore((s) => s.user?.id)
  const subject  = useSubjectStore((s) => s.subject)
  const setSubject = useSubjectStore((s) => s.setSubject)
  const byUser   = useLessonsStore((s) => s.byUser)

  const slides = SUBJECTS.filter((s) => s.available)
  const trackRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  // Dars progressi — hozircha kontent FAQAT yhq uchun; demolar 0 ko'rsatadi
  const doneMap = byUser[userId ?? '0'] ?? {}
  const lessonsTotal = modules.reduce((n, m) => n + m.lessonCount, 0)
  const lessonsDone  = modules.reduce((n, m) => n + (doneMap[m.id]?.length ?? 0), 0)

  const openSubject = useCallback((id: string) => {
    if (id !== subject.id) setSubject(id)
    if (id === 'yhq') (id === subject.id ? onContinue?.() : navigate('/darslik'))
    else navigate('/testlar')
  }, [subject.id, setSubject, navigate, onContinue])

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || el.children.length === 0) return
    const slideW = (el.children[0] as HTMLElement).offsetWidth + 12 // gap-3
    setCurrent(Math.min(slides.length - 1, Math.max(0, Math.round(el.scrollLeft / slideW))))
  }, [slides.length])

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    if (!el || !el.children[i]) return
    const slideW = (el.children[i] as HTMLElement).offsetWidth + 12
    el.scrollTo({ left: i * slideW, behavior: 'smooth' })
  }, [])

  return (
    <div className="mb-4">
      <div ref={trackRef} onScroll={onScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth-x px-5 pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}>
        {slides.map((s) => (
          <div key={s.id} className="w-full flex-shrink-0 snap-center min-h-[120px]">
            <SubjectSlide subjectId={s.id} lang={lang}
              done={s.id === 'yhq' ? lessonsDone : 0}
              total={s.id === 'yhq' ? lessonsTotal : 0}
              active={s.id === subject.id}
              onOpen={() => openSubject(s.id)} />
          </div>
        ))}
      </div>
      {/* Pagination dots */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        {slides.map((_, i) => (
          <button key={i} type="button" onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            className="transition-all duration-300 cursor-pointer"
            style={{
              width: i === current ? 16 : 6,
              height: 6,
              borderRadius: 3,
              background: i === current ? 'var(--p-primary)' : 'var(--p-line)',
              boxShadow: i === current ? '0 0 8px var(--p-glow)' : 'none',
            }} />
        ))}
      </div>
    </div>
  )
})
