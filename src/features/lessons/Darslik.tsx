import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { Check, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { modules, MODULE_TOPICS } from '../../content/modules'
import { lessons } from '../../content/lessons'
import lessonMap from '../../../shared/lesson-map.yhq.json'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { getTelegramWebApp, syncTelegramTheme } from '../../platform/telegram'
import { haptics } from '../../platform/haptics'
import { type PathSelection } from './LearningPath'
import LessonLaunch, { lessonLaunchOrigin, type LaunchOrigin } from './LessonLaunch'
import { canReadLesson } from './lesson-access'
import LessonReader from './LessonReader'
import ModuleComplete, { type CompletedModule } from './ModuleComplete'
import {
  BrilliantHeroIllustration,
  BrilliantLessonRowIcon,
  getBrilliantTheme,
} from './BrilliantLevelsCarousel'
import { useT } from '../../shared/i18n'
import './learning-path.css'

type Mod = typeof modules[number]

export default function Darslik() {
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const doneFor = useLessonsStore((s) => s.byUser[userId] ?? {})
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)

  const [reader, setReader] = useState<{ mod: Mod; idx: number } | null>(() => {
    const st = location.state as { moduleId?: number; lessonIdx?: number } | null
    if (st?.moduleId != null && st?.lessonIdx != null) {
      const mod = modules.find((m) => m.id === st.moduleId)
      if (mod) return { mod, idx: Math.min(Math.max(0, st.lessonIdx), mod.lessonCount - 1) }
    }
    return null
  })

  const [moduleId, setModuleId] = useState(() => {
    const st = location.state as { moduleId?: number } | null
    return modules.find((m) => m.id === st?.moduleId)?.id
      ?? modules.find((m) => (lessons[m.id] ?? []).some((_, i) => !doneFor[m.id]?.includes(i)))?.id
      ?? modules[0].id
  })

  const [completion, setCompletion] = useState<CompletedModule | null>(null)
  const [selected, setSelected] = useState<PathSelection | null>(null)
  const [launch, setLaunch] = useState<{ mod: Mod; idx: number; origin: LaunchOrigin } | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef<number | null>(null)
  const dragStartTime = useRef<number>(0)
  const dragOffsetRef = useRef(0)
  const selectedTrigger = useRef<HTMLButtonElement | null>(null)
  const pendingFocusModId = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const tt = useT(settings.language)
  const ru = settings.language === 'ru'
  const subjectId = useSubjectStore((s) => s.subjectId)
  const streak = useDailyStore((s) => s.streaks[subjectId] ?? 0)
  const totalDone = modules.reduce((sum, m) => sum + (lessons[m.id] ?? []).filter((_, i) => doneFor[m.id]?.includes(i)).length, 0)
  const markDone = useLessonsStore((s) => s.markDone)

  const currentModIdx = Math.max(0, modules.findIndex((m) => m.id === moduleId))
  const activeMod = modules[currentModIdx] ?? modules[0]
  const prevMod = currentModIdx > 0 ? modules[currentModIdx - 1] : null
  const nextMod = currentModIdx < modules.length - 1 ? modules[currentModIdx + 1] : null
  const theme = getBrilliantTheme(activeMod.id)

  const activeLessons = lessons[activeMod.id] ?? []
  const activeDoneList = doneFor[activeMod.id] ?? []
  const firstUnreadIdx = activeLessons.findIndex((_, i) => !activeDoneList.includes(i))
  const defaultLessonIdx = firstUnreadIdx >= 0 ? firstUnreadIdx : 0
  const activeLessonIdx = selected?.moduleId === activeMod.id && !selected.check
    ? selected.idx
    : defaultLessonIdx

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const requestPremium = () => {
    setReader(null)
    setLaunch(null)
    navigate('/premium')
  }

  const switchToModuleIndex = useCallback((nextIdx: number) => {
    const clamped = Math.max(0, Math.min(modules.length - 1, nextIdx))
    const targetMod = modules[clamped]
    if (!targetMod || targetMod.id === moduleId) return
    setModuleId(targetMod.id)
    setSelected(null)
    haptics.selection()
  }, [moduleId])

  const continueModule = useCallback(() => {
    if (!completion?.next) return
    pendingFocusModId.current = completion.next.id
    setModuleId(completion.next.id)
    setCompletion(null)
  }, [completion])

  useEffect(() => {
    if (pendingFocusModId.current === activeMod.id && !reader) {
      pendingFocusModId.current = null
      document.getElementById(`lesson-module-title-${activeMod.id}`)?.focus({ preventScroll: true })
    }
  }, [activeMod.id, reader])

  // Keep the native chrome in sync with the course canvas.
  useEffect(() => {
    const tg = getTelegramWebApp()
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    const prevMeta = metaTheme?.getAttribute('content')
    const updateTheme = () => {
      const background = document.body.dataset.theme === 'dark' ? '#111111' : '#ffffff'
      try {
        tg?.setHeaderColor?.(background)
        tg?.setBackgroundColor?.(background)
      } catch {}
      if (metaTheme) metaTheme.setAttribute('content', background)
      document.documentElement.style.backgroundColor = background
      document.body.style.backgroundColor = background
    }
    updateTheme()
    const themeObserver = new MutationObserver(updateTheme)
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
    try { tg?.disableVerticalSwipes?.() } catch {}

    return () => {
      themeObserver.disconnect()
      syncTelegramTheme(document.body.dataset.theme === 'dark')
      if (metaTheme && prevMeta) metaTheme.setAttribute('content', prevMeta)
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
      try {
        tg?.enableVerticalSwipes?.()
      } catch {}
    }
  }, [settings.theme])

  // The card shows a two-row window (previous + current lesson), as in the video.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = Math.max(0, activeLessonIdx - 1) * 68
  }, [activeMod.id, activeLessonIdx])

  const practiceLesson = (mod: Mod, lessonIdx: number) => {
    if (!canReadLesson(isPremium, mod.id, lessonIdx)) { requestPremium(); return }
    const map = lessonMap as Record<string, number[]>
    const lessonQuestionIds = map[`${mod.id}:${lessonIdx}`]
    if (lessonQuestionIds && lessonQuestionIds.length > 0) {
      const lessonTitle = (lessons[mod.id] && lessons[mod.id][lessonIdx])
        ? (ru ? lessons[mod.id][lessonIdx].titleRu : lessons[mod.id][lessonIdx].titleUz)
        : `${lessonIdx + 1}-dars`
      navigate('/test/1', {
        state: {
          questionIds: lessonQuestionIds,
          mode: 'lesson',
          serverSelector: { type: 'lesson', moduleId: mod.id, lessonIndex: lessonIdx },
          title: `${lessonTitle} — ${ru ? 'практика' : 'mashq'}`,
        },
      })
      return
    }
    practiceModule(mod)
  }

  const practiceModule = (mod: Mod) => {
    if (!isPremium) { requestPremium(); return }
    const map = lessonMap as Record<string, number[]>
    const curatedIds = [...new Set((lessons[mod.id] ?? []).flatMap((_, idx) => map[`${mod.id}:${idx}`] ?? []))]
    if (curatedIds.length) {
      navigate('/test/1', {
        state: {
          questionIds: curatedIds,
          mode: 'module',
          serverSelector: { type: 'module', moduleId: mod.id },
          title: `${ru ? mod.titleRu : mod.title} — ${tt('pathLevelCheck')}`,
        },
      })
      return
    }
    const slugs = MODULE_TOPICS[mod.id] ?? []
    const topicIds = topics.filter((t) => slugs.includes(t.slug)).map((t) => t.id)
    const ids = questions.filter((q) => q.topicId != null && topicIds.includes(q.topicId)).map((q) => q.id)
    if (ids.length === 0) {
      showToast(tt('darslikNoQuestions'))
      return
    }
    navigate('/test/1', { state: { questionIds: ids, title: `${ru ? mod.titleRu : mod.title} — ${ru ? 'практика' : 'mashq'}` } })
  }

  const openLessonAt = (mod: Mod, idx: number, triggerEl?: HTMLButtonElement | null) => {
    if (launch) return
    if (!canReadLesson(isPremium, mod.id, idx)) {
      requestPremium()
      return
    }
    const target = { mod, idx }
    if (settings.noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReader(target)
    } else {
      setLaunch({ ...target, origin: lessonLaunchOrigin(triggerEl ?? selectedTrigger.current) })
    }
  }

  // Horizontal touch / pointer swipe handlers matching Brilliant Android carousel physics
  const handleSwipeStart = (clientX: number) => {
    dragStartX.current = clientX
    dragStartTime.current = performance.now()
    dragOffsetRef.current = 0
    setIsDragging(true)
  }

  const handleSwipeMove = (clientX: number) => {
    if (dragStartX.current === null) return
    const dx = clientX - dragStartX.current
    // Rubber-band resistance at the ends (0.22 factor)
    const effectiveDx =
      (currentModIdx === 0 && dx > 0) || (currentModIdx === modules.length - 1 && dx < 0)
        ? dx * 0.22
        : dx
    dragOffsetRef.current = effectiveDx
    setDragOffset(effectiveDx)
  }

  const handleSwipeEnd = () => {
    if (dragStartX.current === null) return
    const dx = dragOffsetRef.current
    const dt = Math.max(16, performance.now() - dragStartTime.current)
    const velocity = (dx / dt) * 1000 // pixels per second

    dragStartX.current = null
    dragOffsetRef.current = 0
    setIsDragging(false)
    setDragOffset(0)

    // Velocity-sensitive flick (>320px/s) OR distance drag (>38px)
    const isFlingLeft = velocity < -320 || dx <= -38
    const isFlingRight = velocity > 320 || dx >= 38

    if (isFlingLeft && currentModIdx < modules.length - 1) {
      switchToModuleIndex(currentModIdx + 1)
    } else if (isFlingRight && currentModIdx > 0) {
      switchToModuleIndex(currentModIdx - 1)
    }
  }

  const activeTitle = ru ? activeMod.titleRu : activeMod.title

  return (
    <div className="yhq-home fixed inset-0 z-20 w-full h-full flex flex-col items-center overflow-hidden overscroll-none select-none lg:relative lg:inset-auto lg:z-auto">
      <div
        data-testid="brilliant-darslik-screen"
        style={{ '--yhq-accent': theme.accent } as CSSProperties}
        className="yhq-home-screen w-full flex-1 h-full max-h-full flex flex-col px-4 pt-[max(0.5rem,var(--safe-top,0px))] pb-[max(0.35rem,var(--safe-bottom,0px))] mx-auto max-w-[430px] select-none overflow-y-auto"
      >
        {/* Top: Status bar + Header */}
        <div className="yhq-home-header flex flex-col shrink-0">
          {/* 1. Top status bar: left [ n key ] and right [ n lightning ] */}
          <div className="yhq-home-status flex items-center justify-between">
            <button
              type="button"
              onClick={() => goBack(navigate)}
              aria-label={tt('darslikBack')}
              className="yhq-home-pill inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-full border-2 px-3.5 transition-transform active:scale-95"
            >
              <ChevronLeft className="hidden lg:block" size={20} aria-hidden="true" />
              <span className="text-[15px] font-extrabold tabular-nums lg:hidden">
                {Math.max(1, totalDone)}
              </span>
              {/* Golden key icon */}
              <svg viewBox="0 0 16 24" className="h-[19px] w-3 shrink-0 lg:hidden" aria-hidden="true">
                <path d="M8 1.5 V13" stroke="#f6b31f" strokeWidth="3" strokeLinecap="round" />
                <path d="M8 4 H12 M8 8 H11.5" stroke="#f6b31f" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M8 11 L13.5 14 V20 L8 23 L2.5 20 V14 Z" fill="#f6b31f" />
                <circle cx="8" cy="17" r="2" fill="#fff" />
              </svg>
            </button>

            <div
              data-testid="brilliant-streak-pill"
              className="yhq-home-pill inline-flex h-[38px] items-center gap-1.5 rounded-full border-2 px-3.5"
            >
              {streak > 0 && (
                <span className="text-[15px] font-extrabold tabular-nums">
                  {streak}
                </span>
              )}
              {/* Lightning icon: lime when the streak is alive, faint outline at 0 */}
              <svg viewBox="0 0 18 22" className="size-4 shrink-0" aria-hidden="true">
                {streak > 0 ? (
                  <polygon points="10,1 2,12 8.5,12 7,21 16,9.5 9.5,9.5" fill="#d4e82a" stroke="#b9cf1c" strokeWidth="1.1" strokeLinejoin="round" />
                ) : (
                  <polygon points="10,1 2,12 8.5,12 7,21 16,9.5 9.5,9.5" fill="none" stroke="#dddddd" strokeWidth="1.3" strokeLinejoin="round" />
                )}
              </svg>
            </div>
          </div>

          {/* 2. Centered header matching Brilliant Android: Title + LEVEL / RECOMMENDED subtitle */}
          <div className="flex flex-col items-center text-center px-4 mt-2">
            <h1
              id={`lesson-module-title-${activeMod.id}`}
              tabIndex={-1}
              className="font-display text-[24px] sm:text-[26px] font-bold tracking-tight leading-tight focus-visible:outline-none"
            >
              {activeTitle}
            </h1>

            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[12px] font-extrabold uppercase tracking-widest">
              <span
                data-testid="brilliant-level-subtitle"
                className="yhq-home-accent"
              >
                LEVEL {activeMod.id}
              </span>
              {theme.recommended && (
                <>
                  <span className="yhq-home-accent opacity-40">·</span>
                  <span
                    data-testid="brilliant-recommended-badge"
                    className="yhq-home-accent"
                  >
                    RECOMMENDED
                  </span>
                </>
              )}
            </div>
            <div className="yhq-home-progress" role="progressbar" aria-label={tt('pathProgress')} aria-valuemin={0} aria-valuemax={activeLessons.length} aria-valuenow={activeLessons.filter((_, idx) => activeDoneList.includes(idx)).length}>
              <span style={{ width: `${activeLessons.length ? activeLessons.filter((_, idx) => activeDoneList.includes(idx)).length / activeLessons.length * 100 : 0}%`, background: theme.accent }} />
            </div>
          </div>
        </div>

        {/* Center: 3D Hero Carousel Track (Floating vertically in the middle with generous breathing space) */}
        <div className="yhq-home-hero my-auto flex flex-col items-center justify-center py-2 shrink-0">
          {/* 3. Center hero illustration swipe stage with generous lateral breathing room */}
          <div
            data-testid="brilliant-swipe-stage"
            onPointerDown={(e) => {
              if (e.pointerType === 'touch' || (e.target as HTMLElement).closest('button')) return
              ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
              handleSwipeStart(e.clientX)
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'touch') return
              handleSwipeMove(e.clientX)
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'touch') return
              handleSwipeEnd()
            }}
            onPointerCancel={(e) => {
              if (e.pointerType === 'touch') return
              handleSwipeEnd()
            }}
            onTouchStart={(e) => { if (!(e.target as HTMLElement).closest('button') && e.touches[0]) handleSwipeStart(e.touches[0].clientX) }}
            onTouchMove={(e) => { if (e.touches[0]) handleSwipeMove(e.touches[0].clientX) }}
            onTouchEnd={handleSwipeEnd}
            onTouchCancel={handleSwipeEnd}
            className="relative flex h-[clamp(160px,26dvh,220px)] w-[calc(100%+2rem)] cursor-grab items-center justify-center overflow-hidden touch-pan-y active:cursor-grabbing select-none"
          >
            {/* The neighboring illustrations remain partially visible at the edges. */}
            {modules.map((m, i) => {
              const offset = (i - currentModIdx) * 215 + dragOffset
              const dist = Math.abs(offset)
              const scale = Math.max(0.7, 1 - (dist / 215) * 0.3)
              const opacity = Math.max(0, 1 - (dist / 215) * 0.2)
              const isFar = dist > 430

              return (
                <div
                  key={m.id}
                  data-testid={`brilliant-hero-${m.id}`}
                  aria-hidden={i !== currentModIdx}
                  className="yhq-home-hero-item absolute pointer-events-none select-none flex items-center justify-center"
                  style={{
                    transform: `translate3d(${offset}px, 0, 0) scale(${scale})`,
                    opacity: isFar ? 0 : opacity,
                    zIndex: isFar ? 0 : 10 - Math.min(9, Math.round(dist / 25)),
                    visibility: isFar ? 'hidden' : 'visible',
                    '--yhq-desktop-x': `${(i - currentModIdx) * 105 + dragOffset}px`,
                    '--yhq-desktop-scale': i === currentModIdx ? 0.8 : 0.25,
                    transition: isDragging
                      ? 'none'
                      : 'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  } as CSSProperties}
                >
                  <BrilliantHeroIllustration moduleId={m.id} className="w-[250px] h-[220px]" />
                </div>
              )
            })}

            {/* Subtle Left / Right Edge Chevrons */}
            {prevMod && (
              <button
                type="button"
                aria-label="Oldingi daraja"
                onClick={(e) => { e.stopPropagation(); switchToModuleIndex(currentModIdx - 1) }}
                className="yhq-home-previous absolute left-0 top-1/2 z-20 grid h-24 w-20 -translate-y-1/2 cursor-pointer place-items-center text-transparent focus-visible:text-[#b8b8b8]"
              >
                <ChevronLeft size={14} strokeWidth={2.25} />
              </button>
            )}
            {nextMod && (
              <button
                type="button"
                aria-label="Keyingi daraja"
                onClick={(e) => { e.stopPropagation(); switchToModuleIndex(currentModIdx + 1) }}
                className="yhq-home-next absolute right-0 top-1/2 z-20 grid h-24 w-20 -translate-y-1/2 cursor-pointer place-items-center text-transparent focus-visible:text-[#b8b8b8]"
              >
                <ChevronRight size={14} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Group: Centered Pagination Dots + Rounded Card */}
        <div className="yhq-home-card-group mt-auto shrink-0 flex flex-col w-full">
          {/* 4. Centered Pagination Dots (sal teparoq, start karta ustida nafas bilan) */}
          <div
            className="yhq-home-dots mb-[18px] flex items-center justify-center gap-2.5"
            role="tablist"
            aria-label="Darajalar"
          >
            {modules.map((m, idx) => {
              const isActive = idx === currentModIdx
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`LEVEL ${m.id}`}
                  onClick={() => switchToModuleIndex(idx)}
                  className="p-1 cursor-pointer flex items-center justify-center"
                >
                  <span
                    className={`block rounded-full transition-all duration-300 ${
                      isActive ? 'size-2' : 'size-1.5'
                    }`}
                    style={{
                      backgroundColor: isActive ? theme.dotColor : 'var(--yhq-dot)',
                    }}
                  />
                </button>
              )
            })}
          </div>

          {/* Bottom: Rounded Card Container (Pinned to the bottom, thumb-reachable Start button) */}
          <section
            id={`lesson-module-${activeMod.id}`}
            aria-labelledby={`lesson-module-title-${activeMod.id}`}
            className="yhq-home-card w-full rounded-[28px] border px-5 pt-3.5 pb-3"
          >
        <div
          key={activeMod.id}
          ref={listRef}
          role="list"
          className="h-[126px] overflow-y-auto no-scrollbar scroll-smooth space-y-2.5"
        >
          {activeLessons.map((lesson, idx) => {
            const isDone = activeDoneList.includes(idx)
            const isStepCurrent = idx === firstUnreadIdx
            const isSelected = selected?.moduleId === activeMod.id && selected.idx === idx
            const isHighlighted = idx === activeLessonIdx
            const rowState = isDone ? 'done' : isHighlighted ? 'current' : 'upcoming'
            const lessonTitle = ru ? lesson.titleRu : lesson.titleUz

            return (
              <div
                key={idx}
                role="listitem"
                style={{ animationDelay: `${idx * 50}ms` }}
                className="brilliant-lesson-row-stagger"
              >
                <button
                  type="button"
                  data-path-node
                  data-module={activeMod.id}
                  data-lesson={idx}
                  aria-current={isStepCurrent ? 'step' : undefined}
                  aria-pressed={isSelected}
                  onClick={(e) => {
                    selectedTrigger.current = e.currentTarget
                    setSelected({ moduleId: activeMod.id, idx, check: false })
                    haptics.selection()
                  }}
                  className="yhq-home-row flex h-[58px] w-full cursor-pointer items-center gap-3.5 px-2 text-left rounded-2xl transition-colors"
                >
                  <BrilliantLessonRowIcon state={rowState} accentColor={theme.accent} />

                  <span
                    className={
                      isHighlighted && !isDone
                        ? 'min-w-0 flex-1 text-[16px] font-bold leading-snug'
                        : 'min-w-0 flex-1 text-[16px] font-medium leading-snug text-[var(--yhq-muted)]'
                    }
                  >
                    {lessonTitle}
                  </span>

                  {isDone ? (
                    <span
                      className="grid size-5 shrink-0 place-items-center rounded-full text-white"
                      style={{ backgroundColor: theme.checkBg }}
                    >
                      <Check size={12} strokeWidth={3.2} />
                    </span>
                  ) : (
                    <span
                      className="size-4 shrink-0 rounded-full"
                      style={{ backgroundColor: isHighlighted ? 'var(--yhq-dot-active)' : 'var(--yhq-dot)' }}
                    />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* 1-to-1 56px Pill Start Button matching Brilliant */}
        <button
          type="button"
          data-testid="brilliant-start-button"
          onClick={(e) => openLessonAt(activeMod, activeLessonIdx, e.currentTarget)}
          className="relative mt-3.5 flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-full text-[17px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] shadow-sm"
          style={{
            backgroundColor: theme.buttonBg,
            color: theme.buttonText,
            boxShadow: `inset 0 -4px 0 ${theme.buttonShadow}`,
          }}
        >
          <span aria-hidden="true" className="brilliant-start-sheen pointer-events-none absolute inset-y-0 left-0 w-full">
            <span className="absolute inset-y-0 left-[56%] w-[13%] -skew-x-[28deg] bg-white/30" />
            <span className="absolute inset-y-0 left-[72%] w-[4%] -skew-x-[28deg] bg-white/30" />
          </span>
          <span className="relative z-10">Start</span>
        </button>
      </section>
      </div>

      {launch && (
        <LessonLaunch
          origin={launch.origin}
          lang={settings.language}
          onReveal={() => {
            if (!canReadLesson(isPremium, launch.mod.id, launch.idx)) { requestPremium(); return }
            setReader({ mod: launch.mod, idx: launch.idx })
          }}
          onFinish={() => setLaunch(null)}
          onCancel={() => { setLaunch(null); setReader(null) }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-[calc(5rem+var(--safe-bottom,0px))] left-5 right-5 z-40 flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--p-warning-rgb)/0.15)] px-4 py-3 text-center text-[13px] font-medium text-pfg shadow-lg">
          <AlertTriangle size={15} strokeWidth={1.75} className="flex-none text-pwarning" />
          {toast}
        </div>
      )}

      {reader && (
        <LessonReader
          mod={reader.mod}
          lessonIdx={reader.idx}
          onClose={() => {
            pendingFocusModId.current = reader.mod.id
            setModuleId(reader.mod.id)
            setReader(null)
            setLaunch(null)
          }}
          onPremium={requestPremium}
          onDone={(idx) => {
            if (!canReadLesson(useAppStore.getState().tariff === 'premium', reader.mod.id, idx)) { requestPremium(); return }
            const finished = reader.mod
            const list = lessons[finished.id] ?? []
            const previous = useLessonsStore.getState().byUser[userId]?.[finished.id] ?? []
            const wasDone = list.every((_, i) => previous.includes(i))
            markDone(userId, reader.mod.id, idx)
            if (!wasDone && list.every((_, i) => i === idx || previous.includes(i))) {
              const progress = useLessonsStore.getState().byUser[userId] ?? {}
              const courseDone = modules.every((m) => (lessons[m.id] ?? []).every((_, i) => progress[m.id]?.includes(i)))
              setReader(null)
              setCompletion({ finished, next: courseDone ? undefined : modules[modules.findIndex((m) => m.id === finished.id) + 1], courseDone })
            }
            void useDailyStore.getState().touchActivity(
              userId, todayStr(), useSubjectStore.getState().subjectId,
            )
          }}
          onPractice={(idx) => practiceLesson(reader.mod, idx)}
        />
      )}

      {completion && (
        <ModuleComplete
          completion={completion}
          lang={settings.language}
          onContinue={continueModule}
          onStay={() => setCompletion(null)}
        />
      )}
      </div>
    </div>
  )
}
