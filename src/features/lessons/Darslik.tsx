import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { goBack, registerModal } from '../../shared/lib/navigation'
import { config } from '../../shared/config'
import { Play, Check, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { modules, MODULE_TOPICS } from '../../content/modules'
import { lessons, type Lesson } from '../../content/lessons'
import lessonMap from '../../../shared/lesson-map.yhq.json'
import videosData from '../../content/videos.yhq.json'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useDailyStore, todayStr } from '../../shared/store/useDailyStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { getTelegramWebApp, openTelegramLink, syncTelegramTheme } from '../../platform/telegram'
import { haptics } from '../../platform/haptics'
import { type PathSelection } from './LearningPath'
import LessonLaunch, { lessonLaunchOrigin, type LaunchOrigin } from './LessonLaunch'
import { canReadLesson } from './lesson-access'
import ModuleComplete, { type CompletedModule } from './ModuleComplete'
import {
  BrilliantHeroIllustration,
  BrilliantLessonRowIcon,
  getBrilliantTheme,
} from './BrilliantLevelsCarousel'
import { useT } from '../../shared/i18n'
import './learning-path.css'

type Mod = typeof modules[number]

interface VideoInfo {
  vimeoId: string
  poster: string
  title: string
  topicName?: string
}

// ── Lesson screen (telefon ilovasidagi dizayn kabi) ─────────────────────────
function LessonScreen({ mod, lessonIdx, onClose, onDone, onPractice, onPremium }: {
  mod: Mod
  lessonIdx: number
  onClose: () => void
  onDone: (idx: number) => void
  onPractice: (idx: number) => void
  onPremium: () => void
}) {
  const [idx, setIdx] = useState(lessonIdx)
  const [isPlaying, setIsPlaying] = useState(false)
  const settings = useAppStore((s) => s.settings)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const list = lessons[mod.id] ?? []
  const lesson: Lesson | undefined = list[idx]
  const ru = settings.language === 'ru'
  const tt = useT(settings.language)
  const ordinal = tt('darslikLessonOrdinal').replace('{n}', String(idx + 1))
  const videoInfo: VideoInfo | undefined = (videosData as Record<string, VideoInfo | undefined>)[`${mod.id}:${idx}`]
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onPremiumRef = useRef(onPremium)
  onPremiumRef.current = onPremium
  const allowed = canReadLesson(isPremium, mod.id, idx)
  useEffect(() => {
    if (!allowed) onPremiumRef.current()
  }, [allowed])

  useEffect(() => {
    const id = Symbol('lesson-reader')
    const unregister = registerModal(id, () => {
      onCloseRef.current()
    })
    return () => {
      unregister()
    }
  }, [])

  useEffect(() => {
    setIsPlaying(false)
  }, [idx])

  if (!lesson || !allowed) return null

  const advance = (i: number) => {
    onDone(i)
    if (i < list.length - 1) {
      if (!canReadLesson(isPremium, mod.id, i + 1)) { onPremium(); return }
      setIdx(i + 1)
    }
    else onClose()
  }

  return (
    <div className="lesson-reader fixed inset-0 z-50 bg-pcanvas flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-pline safe-top">
        <button onClick={onClose} aria-label={tt('darslikClose')}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-psurface text-pfg shadow-2xs active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary cursor-pointer">
          <ChevronLeft size={21} strokeWidth={2.25} />
        </button>
        <span className="text-base font-semibold text-pfg">{ordinal}</span>
        <span className="text-xs font-semibold tabular-nums text-pmuted bg-psurface px-2.5 py-1 rounded-xl shadow-2xs">
          {idx + 1}/{list.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+var(--safe-bottom,0px))]">
        <div className="rounded-2xl bg-psurface aspect-video flex items-center justify-center relative overflow-hidden mb-4 shadow-sm">
          {videoInfo?.vimeoId && isPlaying ? (
            <iframe
              src={`https://player.vimeo.com/video/${videoInfo.vimeoId}?autoplay=1&title=0&byline=0&portrait=0`}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={videoInfo.title || lesson.titleUz}
            />
          ) : (
            <div
              role={videoInfo?.vimeoId ? 'button' : undefined}
              tabIndex={videoInfo?.vimeoId ? 0 : undefined}
              aria-label={videoInfo?.vimeoId ? tt('darslikPlayVideo') : undefined}
              onClick={() => {
                if (videoInfo?.vimeoId) setIsPlaying(true)
              }}
              onKeyDown={(e) => {
                if (videoInfo?.vimeoId && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setIsPlaying(true) }
              }}
              className="w-full h-full relative flex items-center justify-center cursor-pointer group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              {videoInfo?.poster ? (
                <img
                  src={videoInfo.poster}
                  alt={ru ? lesson.titleRu : lesson.titleUz}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-black/60 backdrop-blur-md shadow-xl transition-transform group-hover:scale-110 group-active:scale-95">
                  <Play size={24} strokeWidth={2} className="ml-0.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-white/95 line-clamp-1 drop-shadow-sm">
                  {ru ? lesson.titleRu : lesson.titleUz}
                </p>
                {videoInfo?.vimeoId && (
                  <span className="text-[11px] font-medium text-white/90 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs shadow-2xs">
                    {tt('darslikWatchHd')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <h2 className="text-base font-semibold mb-3">
          {ordinal}. {ru ? lesson.titleRu : lesson.titleUz}
        </h2>

        <div className="flex flex-col gap-3 mb-5">
          {(ru ? lesson.bodyRu : lesson.bodyUz).map((p, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-none size-5 rounded-full text-[10px] font-semibold flex items-center justify-center mt-0.5 bg-[rgb(var(--p-primary-rgb)/0.15)] text-pprimary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-pmuted">{p}</p>
            </div>
          ))}
        </div>

        <button onClick={() => onPractice(idx)}
          className="w-full rounded-2xl bg-pcard p-4 text-left active:scale-[0.98] transition-all shadow-xs hover:bg-psurface">
          <p className="text-sm font-semibold mb-1 text-pfg">
            {tt('darslikPracticeTitle')}
          </p>
          <p className="text-xs text-pmuted">
            {tt('darslikPracticeHint')}
          </p>
        </button>
      </div>

      <div className="flex gap-2.5 px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))] border-t border-pline bg-pcanvas">
        <button onClick={() => openTelegramLink(`https://t.me/${config.botUsername}`)}
          className="flex-1 py-3.5 px-3 rounded-2xl bg-psurface text-pfg hover:bg-pcard font-semibold flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-[0.98] cursor-pointer">
          {tt('darslikAsk')}
        </button>
        <button onClick={() => advance(idx)}
          className="flex-[1.5] py-3.5 px-4 rounded-2xl text-ponprimary font-semibold flex items-center justify-center gap-2 bg-pprimary shadow-md transition-all active:scale-[0.98] cursor-pointer">
          <Check size={16} />
          {idx < list.length - 1 ? tt('darslikReadNext') : tt('darslikFinishModule')}
        </button>
      </div>

      <div className="h-1 bg-psurface">
        <div className="h-full transition-all" style={{ width: `${((idx + 1) / list.length) * 100}%`, background: 'var(--p-primary)' }} />
      </div>
    </div>
  )
}

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

  // Brilliant Darslik immersive pure white canvas: sync Telegram header & document background
  useEffect(() => {
    const tg = getTelegramWebApp()
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    const prevMeta = metaTheme?.getAttribute('content')

    try {
      tg?.setHeaderColor?.('#ffffff')
      tg?.setBackgroundColor?.('#ffffff')
    } catch {}
    if (metaTheme) metaTheme.setAttribute('content', '#ffffff')
    document.documentElement.style.backgroundColor = '#ffffff'
    document.body.style.backgroundColor = '#ffffff'

    return () => {
      syncTelegramTheme(settings.theme === 'dark')
      if (metaTheme && prevMeta) metaTheme.setAttribute('content', prevMeta)
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
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
    <div className="flex-1 w-full min-h-[100dvh] bg-white flex flex-col items-center">
      <div
        data-testid="brilliant-darslik-screen"
        className="w-full flex-1 min-h-[100dvh] bg-white text-[#0b0b0f] flex flex-col justify-between px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] mx-auto max-w-[430px] select-none"
      >
        {/* Top: Status bar + Header */}
        <div className="flex flex-col shrink-0">
          {/* 1. Top status bar: left [ n key ] and right [ n lightning ] */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goBack(navigate)}
              aria-label={tt('darslikBack')}
              className="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-full border-2 border-[#e8e8e8] bg-white px-3.5 transition-transform active:scale-95"
            >
              <span className="text-[15px] font-extrabold tabular-nums text-[#0b0b0f]">
                {Math.max(1, totalDone)}
              </span>
              {/* Golden key icon */}
              <svg viewBox="0 0 16 24" className="h-[19px] w-3 shrink-0" aria-hidden="true">
                <path d="M8 1.5 V13" stroke="#f6b31f" strokeWidth="3" strokeLinecap="round" />
                <path d="M8 4 H12 M8 8 H11.5" stroke="#f6b31f" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M8 11 L13.5 14 V20 L8 23 L2.5 20 V14 Z" fill="#f6b31f" />
                <circle cx="8" cy="17" r="2" fill="#fff" />
              </svg>
            </button>

            <div
              data-testid="brilliant-streak-pill"
              className="inline-flex h-[38px] items-center gap-1.5 rounded-full border-2 border-[#e8e8e8] bg-white px-3.5"
            >
              {streak > 0 && (
                <span className="text-[15px] font-extrabold tabular-nums text-[#0b0b0f]">
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
          <div className="flex flex-col items-center text-center px-4 mt-3">
            <h1
              id={`lesson-module-title-${activeMod.id}`}
              tabIndex={-1}
              className="font-display text-[26px] font-bold tracking-tight text-[#0b0b0f] leading-tight focus-visible:outline-none"
            >
              {activeTitle}
            </h1>

            <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px] font-extrabold uppercase tracking-widest">
              <span
                data-testid="brilliant-level-subtitle"
                style={{ color: theme.accent }}
              >
                LEVEL {activeMod.id}
              </span>
              {theme.recommended && (
                <>
                  <span className="opacity-40" style={{ color: theme.accent }}>·</span>
                  <span
                    data-testid="brilliant-recommended-badge"
                    style={{ color: theme.accent }}
                  >
                    RECOMMENDED
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: 3D Hero Carousel Track + Pagination Dots (Floating vertically in the middle) */}
        <div className="my-auto flex flex-col items-center justify-center py-2 shrink-0">
          {/* 3. Center hero illustration swipe stage with generous lateral breathing room */}
          <div
            data-testid="brilliant-swipe-stage"
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return
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
            onTouchStart={(e) => { if (e.touches[0]) handleSwipeStart(e.touches[0].clientX) }}
            onTouchMove={(e) => { if (e.touches[0]) handleSwipeMove(e.touches[0].clientX) }}
            onTouchEnd={handleSwipeEnd}
            onTouchCancel={handleSwipeEnd}
            className="relative mt-2 flex h-[196px] w-full cursor-grab items-center justify-center overflow-hidden touch-pan-y active:cursor-grabbing select-none"
          >
            {/* Continuous 3D Hero Carousel Track matching Android Compose HorizontalPager with 240px pitch */}
            {modules.map((m, i) => {
              const offset = (i - currentModIdx) * 240 + dragOffset
              const dist = Math.abs(offset)
              const scale = Math.max(0.64, 1 - (dist / 240) * 0.36)
              const opacity = Math.max(0, 1 - (dist / 240) * 0.55)
              const isFar = dist > 480

              return (
                <div
                  key={m.id}
                  data-testid={`brilliant-hero-${m.id}`}
                  aria-hidden={i !== currentModIdx}
                  className="absolute pointer-events-none select-none flex items-center justify-center"
                  style={{
                    transform: `translate3d(${offset}px, 0, 0) scale(${scale})`,
                    opacity: isFar ? 0 : opacity,
                    zIndex: isFar ? 0 : 10 - Math.min(9, Math.round(dist / 25)),
                    visibility: isFar ? 'hidden' : 'visible',
                    transition: isDragging
                      ? 'none'
                      : 'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <BrilliantHeroIllustration moduleId={m.id} />
                </div>
              )
            })}

            {/* Subtle Left / Right Edge Chevrons */}
            {prevMod && (
              <button
                type="button"
                aria-label="Oldingi daraja"
                onClick={(e) => { e.stopPropagation(); switchToModuleIndex(currentModIdx - 1) }}
                className="absolute left-0 top-1/2 z-20 grid size-6 -translate-y-1/2 cursor-pointer place-items-center text-[#b8b8b8] opacity-0 transition-opacity focus-visible:opacity-100"
              >
                <ChevronLeft size={14} strokeWidth={2.25} />
              </button>
            )}
            {nextMod && (
              <button
                type="button"
                aria-label="Keyingi daraja"
                onClick={(e) => { e.stopPropagation(); switchToModuleIndex(currentModIdx + 1) }}
                className="absolute right-0 top-1/2 z-20 grid size-6 -translate-y-1/2 cursor-pointer place-items-center text-[#b8b8b8] opacity-0 transition-opacity focus-visible:opacity-100"
              >
                <ChevronRight size={14} strokeWidth={2.25} />
              </button>
            )}
          </div>

          {/* 4. Centered Pagination Dots (directly under hero, matching Brilliant) */}
          <div
            className="mt-4 flex items-center justify-center gap-2.5"
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
                      backgroundColor: isActive ? theme.dotColor : '#d1d5db',
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom: Rounded Card Container (Pinned to the bottom, thumb-reachable Start button) */}
        <section
          id={`lesson-module-${activeMod.id}`}
          aria-labelledby={`lesson-module-title-${activeMod.id}`}
          className="mt-auto shrink-0 rounded-[28px] border border-[#e5e7eb] bg-white px-5 pt-5 pb-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
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
                  className="flex h-[58px] w-full cursor-pointer items-center gap-3.5 px-2 text-left rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <BrilliantLessonRowIcon state={rowState} accentColor={theme.accent} />

                  <span
                    className={
                      isHighlighted && !isDone
                        ? 'min-w-0 flex-1 text-[16px] font-bold leading-snug text-[#0b0b0f]'
                        : 'min-w-0 flex-1 text-[16px] font-medium leading-snug text-[#9ca3af]'
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
                      style={{ backgroundColor: isHighlighted ? '#9ca3af' : '#e5e7eb' }}
                    />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* 1-to-1 56px Pill Start Button matching Brilliant with generous breathing space */}
        <button
          type="button"
          data-testid="brilliant-start-button"
          onClick={(e) => openLessonAt(activeMod, activeLessonIdx, e.currentTarget)}
          className="relative mt-6 flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-full text-[17px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] shadow-sm"
          style={{
            backgroundColor: theme.buttonBg,
            color: theme.buttonText,
          }}
        >
          <span aria-hidden="true" className="brilliant-start-sheen pointer-events-none absolute inset-y-0 left-0 w-full">
            <span className="absolute inset-y-0 left-[56%] w-[13%] -skew-x-[28deg] bg-white/30" />
            <span className="absolute inset-y-0 left-[72%] w-[4%] -skew-x-[28deg] bg-white/30" />
          </span>
          <span className="relative z-10">Start</span>
        </button>
      </section>

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
        <LessonScreen
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
