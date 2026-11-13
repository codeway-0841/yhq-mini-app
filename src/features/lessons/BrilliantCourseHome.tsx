import { useId, useRef, useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { getTelegramWebApp, syncTelegramTheme } from '../../platform/telegram'
import { playSound } from '../../shared/lib/sounds'
import { useAppStore } from '../../shared/store/useAppStore'
import { BrilliantHeroIllustration, BrilliantLessonRowIcon, getBrilliantTheme } from './BrilliantLevelsCarousel'
import { DarslikTopPills } from './DarslikTopPills'
import LessonLaunch, { lessonLaunchOrigin, type LaunchOrigin } from './LessonLaunch'
import './learning-path.css'
import './brilliant-course-home.css'

const VISIBLE_DOTS = 5

export interface BrilliantCourseItem {
  key: string | number
  title: string
  done: boolean
  current?: boolean
}

export interface BrilliantCourseLevel {
  id: number
  titleUz: string
  titleRu: string
  levelLabelUz: string
  levelLabelRu: string
  items: BrilliantCourseItem[]
}

interface BrilliantCourseHomeProps {
  subjectId: string
  levels: BrilliantCourseLevel[]
  completedCount: number
  loading?: boolean
  defaultLevelIndex?: number
  onLaunchLevel: (level: BrilliantCourseLevel, activeItem: BrilliantCourseItem | undefined) => void
  emptyFallback?: ReactNode
  testId?: string
  cardLabelUz?: string
  cardLabelRu?: string
  stageLabelUz?: string
  stageLabelRu?: string
  startLabelUz?: string
  startLabelRu?: string
}

/**
 * Brilliant uslubidagi yagona 1:1 kurs bosh sahifasi (barcha fanlar uchun SSOT):
 * - Yuqori global Streak / Battery / Keys status pilllari (`DarslikTopPills`)
 * - 3D swipe karusel (`BrilliantHeroIllustration`)
 * - 5-nuqtali suriluvchi indikator
 * - 2 qatorli progress kartasi + SVG sheenli "Boshlash" tugmasi + `LessonLaunch` nurli o'tish
 */
export function BrilliantCourseHome({
  subjectId,
  levels,
  completedCount,
  loading = false,
  defaultLevelIndex = 0,
  onLaunchLevel,
  emptyFallback,
  testId = 'brilliant-course-home',
  cardLabelUz = 'Bob mavzulari',
  cardLabelRu = 'Темы блока',
  stageLabelUz = 'Bob tanlash',
  stageLabelRu = 'Выбор блока',
  startLabelUz = 'Boshlash',
  startLabelRu = 'Начать',
}: BrilliantCourseHomeProps) {
  const sheenId1 = useId()
  const sheenId2 = useId()
  const lang = useAppStore((s) => s.settings.language)
  const themeSetting = useAppStore((s) => s.settings.theme)
  const noAnimation = useAppStore((s) => s.settings.noAnimation)
  const ru = lang === 'ru'

  const [selected, setSelected] = useState<number | null>(null)
  const [launch, setLaunch] = useState<{
    level: BrilliantCourseLevel
    activeItem: BrilliantCourseItem | undefined
    origin: LaunchOrigin
  } | null>(null)
  const dragStart = useRef<{ x: number; time: number } | null>(null)
  const dragDistance = useRef(0)
  const suppressClick = useRef(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const activeRow = useRef<HTMLDivElement>(null)

  // Subject almashganda selected carousel indeksini reset qilamiz
  useEffect(() => {
    setSelected(null)
    setLaunch(null)
  }, [subjectId])

  // Tepa (status bar) va pastki fonni kurs kanvasi bilan sinxron tutish
  useEffect(() => {
    const tg = getTelegramWebApp()
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    const prevMeta = metaTheme?.getAttribute('content')
    const updateTheme = () => {
      const isDark = document.body.dataset.theme === 'dark'
      const background = isDark ? '#141414' : '#ffffff'
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
      try { tg?.enableVerticalSwipes?.() } catch {}
    }
  }, [themeSetting])

  if (levels.length === 0) {
    return (
      <main className="rus-home yhq-home" data-testid={testId}>
        <div className="rus-home-inner">
          <header className="rus-home-header">
            <DarslikTopPills subjectId={subjectId} completedCount={completedCount} className="rus-home-status" />
          </header>
          <div className="flex-1 flex items-center justify-center py-10">
            {emptyFallback ?? (
              loading ? (
                <div className="w-8 h-8 border-2 border-pprimary border-t-transparent rounded-full animate-spin" aria-label={ru ? 'Загрузка' : 'Yuklanmoqda'} />
              ) : (
                <p className="text-sm text-center" style={{ color: 'var(--yhq-muted)' }}>
                  {ru ? 'Темы пока не добавлены' : 'Mavzular hali qo‘shilmagan'}
                </p>
              )
            )}
          </div>
        </div>
      </main>
    )
  }

  const clampedDefault = Math.max(0, Math.min(levels.length - 1, defaultLevelIndex))
  const index = selected === null ? clampedDefault : Math.max(0, Math.min(levels.length - 1, selected))
  const level = levels[index]
  const theme = getBrilliantTheme(((level.id - 1) % 8) + 1)

  const items = level.items
  const explicitCurrentIdx = items.findIndex((item) => item.current)
  const firstIncompleteIdx = explicitCurrentIdx >= 0
    ? explicitCurrentIdx
    : items.findIndex((item) => !item.done)
  const windowStart = firstIncompleteIdx < 0
    ? Math.max(0, items.length - 2)
    : Math.min(firstIncompleteIdx, Math.max(0, items.length - 2))
  const visibleItems = items.slice(windowStart, windowStart + 2)
  const activeItem = (firstIncompleteIdx >= 0 ? items[firstIncompleteIdx] : items[0]) ?? visibleItems[0]

  const dotShift = Math.max(0, Math.min(Math.max(0, levels.length - VISIBLE_DOTS), index - Math.floor(VISIBLE_DOTS / 2)))

  const start = (node: HTMLElement) => {
    if (loading || launch || items.length === 0) return
    if (noAnimation || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onLaunchLevel(level, activeItem)
      return
    }
    const source = activeRow.current ?? node
    const rect = source.getBoundingClientRect()
    const origin = lessonLaunchOrigin(source)
    if (!source.querySelector('.learning-mascot')) {
      origin.x = rect.left + Math.min(28, rect.width / 2)
      origin.y = rect.top + rect.height / 2
    }
    setLaunch({ level, activeItem, origin })
  }

  const change = (next: number) => setSelected(Math.max(0, Math.min(levels.length - 1, next)))
  const beginDrag = (x: number) => {
    dragStart.current = { x, time: performance.now() }
    dragDistance.current = 0
    suppressClick.current = false
    setDragging(true)
  }
  const moveDrag = (x: number) => {
    if (!dragStart.current) return
    const dx = x - dragStart.current.x
    dragDistance.current = dx
    setDragOffset((index === 0 && dx > 0) || (index === levels.length - 1 && dx < 0) ? dx * 0.25 : dx)
  }
  const endDrag = (x?: number, cancelled = false) => {
    if (!dragStart.current) return
    const dx = x === undefined ? dragDistance.current : x - dragStart.current.x
    const elapsed = Math.max(16, performance.now() - dragStart.current.time)
    const velocity = Math.abs(dx) / elapsed
    dragStart.current = null
    setDragging(false)
    setDragOffset(0)
    suppressClick.current = Math.abs(dx) > 8
    if (!cancelled && (Math.abs(dx) >= 38 || (Math.abs(dx) > 15 && velocity > 0.32))) {
      const next = Math.max(0, Math.min(levels.length - 1, index + (dx < 0 ? 1 : -1)))
      if (next !== index) {
        change(next)
        playSound('click')
      }
    }
  }

  return (
    <>
      <main
        className="rus-home yhq-home"
        style={{ '--yhq-accent': theme.accent } as CSSProperties}
        data-testid={testId}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) playSound('click')
        }}
      >
        <div className="rus-home-inner">
          <header className="rus-home-header">
            <DarslikTopPills
              subjectId={subjectId}
              completedCount={completedCount}
              className="rus-home-status"
            />
            <div
              className="rus-home-title-btn"
              role="button"
              tabIndex={0}
              onClick={(event) => start(event.currentTarget)}
              onKeyDown={(e) => { if (e.key === 'Enter') start(e.currentTarget) }}
              aria-label={ru ? level.titleRu : level.titleUz}
            >
              <h1>{ru ? level.titleRu : level.titleUz}</h1>
              <div className="rus-home-level">{ru ? level.levelLabelRu : level.levelLabelUz}</div>
            </div>
          </header>

          <div className="rus-home-hero">
            <div
              className="rus-home-stage"
              data-dragging={dragging ? 'true' : undefined}
              onTouchStart={(event) => { if (event.touches[0]) beginDrag(event.touches[0].clientX) }}
              onTouchMove={(event) => { if (event.touches[0]) moveDrag(event.touches[0].clientX) }}
              onTouchEnd={(event) => endDrag(event.changedTouches[0]?.clientX)}
              onTouchCancel={() => endDrag(undefined, true)}
              onPointerDown={(event) => {
                if (event.pointerType === 'mouse') {
                  event.currentTarget.setPointerCapture?.(event.pointerId)
                  beginDrag(event.clientX)
                }
              }}
              onPointerMove={(event) => { if (event.pointerType === 'mouse') moveDrag(event.clientX) }}
              onPointerUp={(event) => { if (event.pointerType === 'mouse') endDrag(event.clientX) }}
              onPointerCancel={() => endDrag(undefined, true)}
              onClickCapture={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  event.preventDefault()
                  event.stopPropagation()
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') change(index + 1)
                if (event.key === 'ArrowLeft') change(index - 1)
              }}
              tabIndex={0}
              aria-label={ru ? stageLabelRu : stageLabelUz}
            >
              {levels.map((item, i) => Math.abs(i - index) <= 2 && (
                <button
                  key={item.id}
                  type="button"
                  className="rus-home-art"
                  style={{ '--offset': i - index, '--drag': `${dragOffset}px` } as CSSProperties}
                  onClick={(event) => {
                    if (i === index) start(event.currentTarget)
                    else change(i)
                  }}
                  aria-label={ru ? item.titleRu : item.titleUz}
                  aria-current={i === index ? 'true' : undefined}
                >
                  <BrilliantHeroIllustration moduleId={item.id} className="rus-home-illustration" />
                </button>
              ))}
            </div>

            {levels.length > 1 && (
              <div className="rus-home-dots" aria-label={ru ? stageLabelRu : stageLabelUz}>
                <div className="rus-home-dots-window" style={levels.length < VISIBLE_DOTS ? { width: `${levels.length * 15}px` } : undefined}>
                  <div className="rus-home-dots-track" style={{ '--dot-shift': dotShift } as CSSProperties}>
                    {levels.map((item, i) => (
                      <button
                        type="button"
                        key={item.id}
                        aria-label={ru ? item.titleRu : item.titleUz}
                        aria-current={i === index ? 'true' : undefined}
                        onClick={() => change(i)}
                      >
                        <span style={{ background: i === index ? (theme.dotColor || '#2862ff') : undefined }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <section className="rus-home-card yhq-home-card" aria-label={ru ? cardLabelRu : cardLabelUz}>
            <div className="rus-home-rows">
              {visibleItems.map((item, offset) => {
                const idx = windowStart + offset
                const active = !item.done && (item.current || idx === firstIncompleteIdx)
                return (
                  <div className="rus-home-row" key={item.key} ref={active ? activeRow : undefined}>
                    <BrilliantLessonRowIcon
                      state={item.done ? 'done' : active ? 'current' : 'upcoming'}
                      accentColor={theme.accent}
                    />
                    <span className={active ? 'rus-home-row-title active' : 'rus-home-row-title'}>
                      {item.title}
                    </span>
                    <span
                      className={`rus-home-marker ${item.done ? 'done' : ''}`}
                      style={item.done ? { backgroundColor: theme.checkBg } : undefined}
                    >
                      {item.done ? '✓' : ''}
                    </span>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              disabled={loading || items.length === 0}
              className="rus-home-start"
              style={{
                background: theme.buttonBg,
                color: theme.buttonText,
                boxShadow: `inset 0 -4px 0 ${theme.buttonShadow}`,
              }}
              onClick={(event) => start(event.currentTarget)}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] select-none z-0">
                <span className="absolute top-0 left-0 w-[150px] h-full animate-brilliant-sheen">
                  <svg viewBox="0 0 150 56" width="150" height="56" fill="none" className="h-full w-[150px]" aria-hidden="true">
                    <defs>
                      <linearGradient id={sheenId1} x1="100.5" y1="-58.6328" x2="100.5" y2="91.3672" gradientUnits="userSpaceOnUse">
                        <stop offset="0.27" stopColor="#F5EFFF" />
                        <stop offset="0.71" stopColor="white" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id={sheenId2} x1="140.826" y1="-28.1328" x2="140.826" y2="121.867" gradientUnits="userSpaceOnUse">
                        <stop offset="0.081302" stopColor="#F5EFFF" />
                        <stop offset="0.570844" stopColor="white" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <rect opacity="0.4" x="75" y="-58.6328" width="51" height="150" transform="rotate(30 75 -58.6328)" fill={`url(#${sheenId1})`} />
                    <rect opacity="0.4" x="127.826" y="-28.1328" width="26" height="150" transform="rotate(30 127.826 -28.1328)" fill={`url(#${sheenId2})`} />
                  </svg>
                </span>
              </span>
              <span className="relative z-10">{ru ? startLabelRu : startLabelUz}</span>
            </button>
          </section>
        </div>
      </main>

      {launch && (
        <LessonLaunch
          origin={launch.origin}
          lang={lang}
          accent={theme.accent}
          onReveal={() => onLaunchLevel(launch.level, launch.activeItem)}
          onFinish={() => setLaunch(null)}
          onCancel={() => setLaunch(null)}
        />
      )}
    </>
  )
}
