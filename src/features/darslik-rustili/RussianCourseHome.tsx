import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import { DARSLIK_BLOCKS, getBlockOutline } from '../../content/darslik-rustili'
import { getTelegramWebApp, syncTelegramTheme } from '../../platform/telegram'
import { scrollPageToTop } from '../../shared/lib/page-scroll'
import { playSound } from '../../shared/lib/sounds'
import { useAppStore } from '../../shared/store/useAppStore'
import { BrilliantHeroIllustration, BrilliantLessonRowIcon, DarslikTopPills, getBrilliantTheme, LessonLaunch, lessonLaunchOrigin, type LaunchOrigin } from '../lessons'
import { sectionKey } from './progress'
import { useDarslikMastery } from './useDarslikMastery'
import CourseMapPage from './CourseMapPage'
import './russian-course-home.css'

const VISIBLE_DOTS = 5

export default function RussianCourseHome() {
  const sheenId1 = useId()
  const sheenId2 = useId()
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const themeSetting = useAppStore((s) => s.settings.theme)
  const noAnimation = useAppStore((s) => s.settings.noAnimation)
  const mastery = useDarslikMastery()
  const refreshMastery = mastery.refresh
  const [selected, setSelected] = useState<number | null>(null)
  const [launch, setLaunch] = useState<{ blockId: number; origin: LaunchOrigin } | null>(null)
  const dragStart = useRef<{ x: number; time: number } | null>(null)
  const dragDistance = useRef(0)
  const suppressClick = useRef(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const activeRow = useRef<HTMLDivElement>(null)
  const wasMap = useRef(false)
  const current = DARSLIK_BLOCKS.find((block) => getBlockOutline(block.id).some((_, idx) => !mastery.passed.has(sectionKey(block.id, idx)))) ?? DARSLIK_BLOCKS[DARSLIK_BLOCKS.length - 1]
  const searchParams = new URLSearchParams(location.search)
  const requestedBlock = Number(searchParams.get('block'))
  const requestedSectionRaw = searchParams.get('section')
  const requestedSection = requestedSectionRaw !== null && Number.isInteger(Number(requestedSectionRaw))
    ? Number(requestedSectionRaw)
    : undefined
  const mapBlock = DARSLIK_BLOCKS.find((block) => block.id === requestedBlock)
  const index = selected ?? DARSLIK_BLOCKS.findIndex((block) => block.id === current.id)
  const block = DARSLIK_BLOCKS[index]
  const theme = getBrilliantTheme(((block.id - 1) % 8) + 1)
  const outline = getBlockOutline(block.id)
  const firstIncomplete = outline.findIndex((_, idx) => !mastery.passed.has(sectionKey(block.id, idx)))
  const first = firstIncomplete < 0 ? Math.max(0, outline.length - 2) : Math.min(firstIncomplete, Math.max(0, outline.length - 2))
  const ru = lang === 'ru'
  const dotShift = Math.max(0, Math.min(DARSLIK_BLOCKS.length - VISIBLE_DOTS, index - Math.floor(VISIBLE_DOTS / 2)))

  const start = (node: HTMLElement) => {
    if (mastery.loading || launch) return
    if (noAnimation || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      navigate({ pathname: location.pathname, search: `?block=${block.id}` })
    } else {
      const source = activeRow.current ?? node
      const rect = source.getBoundingClientRect()
      const origin = lessonLaunchOrigin(source)
      if (!source.querySelector('.learning-mascot')) {
        origin.x = rect.left + Math.min(28, rect.width / 2)
        origin.y = rect.top + rect.height / 2
      }
      setLaunch({ blockId: block.id, origin })
    }
  }
  const change = (next: number) => setSelected(Math.max(0, Math.min(DARSLIK_BLOCKS.length - 1, next)))
  const beginDrag = (x: number) => { dragStart.current = { x, time: performance.now() }; dragDistance.current = 0; suppressClick.current = false; setDragging(true) }
  const moveDrag = (x: number) => {
    if (!dragStart.current) return
    const dx = x - dragStart.current.x
    dragDistance.current = dx
    setDragOffset((index === 0 && dx > 0) || (index === DARSLIK_BLOCKS.length - 1 && dx < 0) ? dx * .25 : dx)
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
    if (!cancelled && (Math.abs(dx) >= 38 || (Math.abs(dx) > 15 && velocity > .32))) {
      const next = Math.max(0, Math.min(DARSLIK_BLOCKS.length - 1, index + (dx < 0 ? 1 : -1)))
      if (next !== index) { change(next); playSound('click') }
    }
  }
  useEffect(() => {
    if (mapBlock) setSelected(DARSLIK_BLOCKS.findIndex((item) => item.id === mapBlock.id))
    else if (wasMap.current) {
      scrollPageToTop()
      refreshMastery()
    }
    wasMap.current = Boolean(mapBlock)
  }, [mapBlock, refreshMastery])

  // Tepa (status bar / Back tugmasi osti) va pastki fonni kurs kanvasi bilan sinxron tutish
  useEffect(() => {
    const tg = getTelegramWebApp()
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    const prevMeta = metaTheme?.getAttribute('content')
    const updateTheme = () => {
      const isDark = document.body.dataset.theme === 'dark'
      const background = isDark ? (mapBlock ? '#141414' : '#111111') : '#ffffff'
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
    if (!mapBlock) {
      try { tg?.disableVerticalSwipes?.() } catch {}
    } else {
      try { tg?.enableVerticalSwipes?.() } catch {}
    }

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
  }, [themeSetting, mapBlock])

  return <>
    {mapBlock ? <CourseMapPage key={`${mapBlock.id}:${requestedSection ?? ''}`} initialBlockId={mapBlock.id} initialSectionIdx={requestedSection} onBackHome={() => navigate({ pathname: location.pathname }, { replace: true })} /> :
      <main className="rus-home yhq-home" style={{ '--yhq-accent': theme.accent } as CSSProperties} data-testid="russian-course-home" onClick={(event) => { if ((event.target as HTMLElement).closest('button')) playSound('click') }}>
        <div className="rus-home-inner">
          <header className="rus-home-header">
            <DarslikTopPills
              subjectId={RUSSIAN_SUBJECT_ID}
              completedCount={mastery.passed.size}
              className="rus-home-status"
            />
            <div
              className="rus-home-title-btn"
              role="button"
              tabIndex={0}
              onClick={(event) => start(event.currentTarget)}
              onKeyDown={(e) => { if (e.key === 'Enter') start(e.currentTarget) }}
              aria-label={ru ? 'Начать блок' : 'Bobni boshlash'}
            >
              <h1>{ru ? block.titleRu : block.titleUz}</h1>
              <div className="rus-home-level">{ru ? 'БЛОК' : 'BOB'} {block.id}</div>
            </div>
          </header>
          <div className="rus-home-hero">
            <div className="rus-home-stage" data-dragging={dragging ? 'true' : undefined}
              onTouchStart={(event) => { if (event.touches[0]) beginDrag(event.touches[0].clientX) }}
              onTouchMove={(event) => { if (event.touches[0]) moveDrag(event.touches[0].clientX) }}
              onTouchEnd={(event) => endDrag(event.changedTouches[0]?.clientX)}
              onTouchCancel={() => endDrag(undefined, true)}
              onPointerDown={(event) => { if (event.pointerType === 'mouse') { event.currentTarget.setPointerCapture?.(event.pointerId); beginDrag(event.clientX) } }}
              onPointerMove={(event) => { if (event.pointerType === 'mouse') moveDrag(event.clientX) }}
              onPointerUp={(event) => { if (event.pointerType === 'mouse') endDrag(event.clientX) }}
              onPointerCancel={() => endDrag(undefined, true)}
              onClickCapture={(event) => { if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation() } }}
              onKeyDown={(event) => { if (event.key === 'ArrowRight') change(index + 1); if (event.key === 'ArrowLeft') change(index - 1) }} tabIndex={0} aria-label={ru ? 'Выбор блока' : 'Bob tanlash'}>
              {DARSLIK_BLOCKS.map((item, i) => Math.abs(i - index) <= 2 && (
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
            {/* Brilliant 1:1 sliding 5-dots pagination window */}
            <div className="rus-home-dots" aria-label={ru ? 'Блоки' : 'Boblar'}>
              <div className="rus-home-dots-window">
                <div className="rus-home-dots-track" style={{ '--dot-shift': dotShift } as CSSProperties}>
                  {DARSLIK_BLOCKS.map((item, i) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-label={`${ru ? 'Блок' : 'Bob'} ${item.id}: ${ru ? item.titleRu : item.titleUz}`}
                      aria-current={i === index ? 'true' : undefined}
                      onClick={() => change(i)}
                    >
                      <span style={{ background: i === index ? (theme.dotColor || '#2862ff') : undefined }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <section className="rus-home-card yhq-home-card" aria-label={ru ? 'Темы блока' : 'Bob mavzulari'}>
            <div className="rus-home-rows">{outline.slice(first, first + 2).map((title, offset) => {
              const idx = first + offset
              const done = mastery.passed.has(sectionKey(block.id, idx))
              const active = !done && idx === firstIncomplete
              return <div className="rus-home-row" key={idx} ref={active ? activeRow : undefined}><BrilliantLessonRowIcon state={done ? 'done' : active ? 'current' : 'upcoming'} accentColor={theme.accent} /><span className={active ? 'rus-home-row-title active' : 'rus-home-row-title'}>{title}</span><span className={`rus-home-marker ${done ? 'done' : ''}`} style={done ? { backgroundColor: theme.checkBg } : undefined}>{done ? '✓' : ''}</span></div>
            })}</div>
            <button
              type="button"
              disabled={mastery.loading}
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
              <span className="relative z-10">{ru ? 'Начать' : 'Boshlash'}</span>
            </button>
          </section>
        </div>
      </main>}
    {launch && <LessonLaunch origin={launch.origin} lang={lang} accent={theme.accent} onReveal={() => navigate({ pathname: location.pathname, search: `?block=${launch.blockId}` })} onFinish={() => setLaunch(null)} onCancel={() => setLaunch(null)} />}
  </>
}
