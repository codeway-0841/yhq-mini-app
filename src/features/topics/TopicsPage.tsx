import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { api } from '../../shared/api'
import { config } from '../../shared/config'
import { useT } from '../../shared/i18n'
import { modules } from '../../content/modules'
import { lessons as lessonsData } from '../../content/lessons'
import lessonMap from '../../content/lessonMap.yhq.json'
import {
  DARSLIK_BLOCKS,
  getBlockOutline,
} from '../../content/darslik-rustili'
import {
  RUSADABIYOT_BLOCKS,
  RUSADABIYOT_PROGRESS_MODULE_OFFSET,
  getRusadabiyotBlockOutline,
} from '../../content/darslik-rusadabiyot'
import { useDarslikMastery, sectionKey } from '../darslik-rustili'
import { getBrilliantTheme } from '../lessons'
import { goBack } from '../../shared/lib/navigation'
import { addPageScrollListener, getPageScroller } from '../../shared/lib/page-scroll'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Check, Lock, Star } from 'lucide-react'
import { getTopicChapterId, sortTopicsForTickets } from '../tickets'
import {
  YHQ_BRILLIANT_PATHS,
  getBrilliantTopicImage,
  getDarslikBlockPathMeta,
  getRusadabiyotBlockPathMeta,
  getSubjectChapterPathMeta,
  getSubjectChaptersList,
  parseOutlineTopicHeading,
  type BrilliantPathMeta,
} from './brilliant-courses-data'
import './brilliant-topics.css'

interface LessonMeta {
  idx: number
  title: string
  ids: number[]
}

type LessonState = 'done' | 'active' | 'locked'

interface TopicCardItem {
  key: string | number
  gradeLabel: string
  title: string
  image: string
  done: number
  count: number
  progressPct: number
  state: LessonState
  isNew?: boolean
  onClick: () => void
}

interface PathSectionData {
  meta: BrilliantPathMeta
  headingTitle: string
  items: TopicCardItem[]
  doneCount: number
  totalCount: number
}

type BrilliantSectionTone = 'blue' | 'amber' | 'purple'

function getSectionTone(index: number): BrilliantSectionTone {
  const accent = getBrilliantTheme((index % 8) + 1).accent.toLowerCase()
  if (accent === '#f6b31f') return 'amber'
  if (accent === '#8a4cff') return 'purple'
  return 'blue'
}

const PINNED_PATH_STORAGE_PREFIX = 'kivvi-pinned-path:'

function readPinnedPath(subjectId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(`${PINNED_PATH_STORAGE_PREFIX}${subjectId}`)
  } catch {
    return null
  }
}

function usePinnedPath(subjectId: string, sections: PathSectionData[]) {
  const [pinnedId, setPinnedId] = useState<string>(() => readPinnedPath(subjectId) ?? '')

  useEffect(() => {
    const stored = readPinnedPath(subjectId)
    if (stored && sections.some((s) => s.meta.id === stored)) {
      setPinnedId(stored)
      return
    }
    const firstIncomplete =
      sections.find((s) => s.totalCount > 0 && s.doneCount < s.totalCount)?.meta.id ??
      sections[0]?.meta.id ??
      ''
    setPinnedId(firstIncomplete)
  }, [subjectId, sections])

  const togglePin = useCallback(
    (id: string) => {
      setPinnedId((prev) => {
        const next = prev === id ? '' : id
        if (typeof window !== 'undefined') {
          try {
            const key = `${PINNED_PATH_STORAGE_PREFIX}${subjectId}`
            if (next) window.localStorage.setItem(key, next)
            else window.localStorage.removeItem(key)
          } catch {
            // ignore storage errors
          }
        }
        return next
      })
    },
    [subjectId],
  )

  return { pinnedId, togglePin }
}

/**
 * Haqiqiy vertikal scroll konteynerini aniqlash:
 * Desktop (>=1024px) rejimda `.route-page`, mobil rejimda `window`/`document`.
 */
function getActiveScrollElement(): HTMLElement | null {
  const scroller = getPageScroller()
  if (scroller) return scroller
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const routeEl = document.querySelector('.route-page')
    if (routeEl instanceof HTMLElement) {
      const style = window.getComputedStyle?.(routeEl)
      if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
        return routeEl
      }
    }
  }
  return null
}

function getVerticalScrollTop(): number {
  const el = getActiveScrollElement()
  if (el) return el.scrollTop
  if (typeof window === 'undefined') return 0
  return window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0
}

function setVerticalScrollTop(y: number): void {
  const next = Math.max(0, y)
  const el = getActiveScrollElement()
  if (el) {
    el.scrollTop = next
    return
  }
  if (typeof window !== 'undefined') {
    window.scrollTo(0, next)
  }
  if (typeof document !== 'undefined') {
    if (document.scrollingElement) document.scrollingElement.scrollTop = next
    if (document.documentElement) document.documentElement.scrollTop = next
  }
}

function getSectionTargetY(sectionId: string): number | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById(`br-path-${sectionId}`)
  if (!el) return null

  const header = document.querySelector('.page-header')
  const rect = el.getBoundingClientRect()
  const scroller = getActiveScrollElement()

  if (scroller) {
    const srect = scroller.getBoundingClientRect()
    const headerHeight = header ? header.getBoundingClientRect().height : 148
    return Math.max(0, scroller.scrollTop + (rect.top - srect.top) - headerHeight - 4)
  }

  const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 148
  const currentY = getVerticalScrollTop()
  return Math.max(0, currentY + rect.top - headerBottom - 4)
}

/**
 * Senior-level Ikki Tomonlama Scroll Engine (Tab <-> Content Sync):
 * 1. Tepadagi gorizontal tab bosilganda: maxsus requestAnimationFrame (720ms easeInOutCubic)
 *    bilan sahifani o'sha bobning boshiga silliq olib boradi (OS/brauzer smooth-scroll
 *    cheklo'vlariga bog'liq emas va scrollIntoView tomonidan bekor qilinmaydi).
 * 2. Foydalanuvchi pastga/tepaga scroll qilganda: Scroll-Spy joriy bobni aniqlab,
 *    yuqoridagi tabni avtomatik faollashtiradi va markazga silliq suradi.
 */
function useBrilliantScrollNavigation(sections: PathSectionData[]) {
  const [activePathId, setActivePathId] = useState<string>(() => sections[0]?.meta.id ?? '')
  const activePathIdRef = useRef<string>(activePathId)
  const isProgrammaticScrollRef = useRef<boolean>(false)
  const scrollRafRef = useRef<number>(0)

  useEffect(() => {
    activePathIdRef.current = activePathId
  }, [activePathId])

  useEffect(() => {
    if (sections.length > 0 && !sections.some((s) => s.meta.id === activePathId)) {
      const firstId = sections[0].meta.id
      activePathIdRef.current = firstId
      setActivePathId(firstId)
    }
  }, [sections, activePathId])

  const cancelProgrammaticScroll = useCallback(() => {
    if (scrollRafRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
    isProgrammaticScrollRef.current = false
  }, [])

  const handleSelectTab = useCallback(
    (id: string) => {
      cancelProgrammaticScroll()
      activePathIdRef.current = id
      setActivePathId(id)

      if (typeof window === 'undefined' || typeof document === 'undefined') return

      isProgrammaticScrollRef.current = true
      const startY = getVerticalScrollTop()
      const initialTargetY = getSectionTargetY(id)

      if (initialTargetY === null || typeof window.requestAnimationFrame !== 'function') {
        isProgrammaticScrollRef.current = false
        return
      }

      if (Math.abs(initialTargetY - startY) < 2) {
        setVerticalScrollTop(initialTargetY)
        isProgrammaticScrollRef.current = false
        return
      }

      const duration = 720 // ~0.72 sekund silliq animatsiya
      const startTime = performance.now()

      const step = (now: number) => {
        const elapsed = Math.max(0, now - startTime)
        const progress = Math.min(1, elapsed / duration)
        // easeInOutCubic
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2

        const liveTargetY = getSectionTargetY(id) ?? initialTargetY
        const nextY = startY + (liveTargetY - startY) * eased
        setVerticalScrollTop(nextY)

        if (progress < 1) {
          scrollRafRef.current = window.requestAnimationFrame(step)
        } else {
          setVerticalScrollTop(liveTargetY)
          scrollRafRef.current = 0
          window.requestAnimationFrame(() => {
            isProgrammaticScrollRef.current = false
          })
        }
      }

      scrollRafRef.current = window.requestAnimationFrame(step)
    },
    [cancelProgrammaticScroll],
  )

  useEffect(() => {
    if (sections.length <= 1 || typeof window === 'undefined') return

    let spyRaf = 0
    let settleTimer: ReturnType<typeof setTimeout> | null = null
    let lastScrollY = getVerticalScrollTop()

    const detectCurrentSectionId = (): string | undefined => {
      if (sections.length === 0) return undefined
      const currentScroll = getVerticalScrollTop()
      if (currentScroll <= 12) {
        return sections[0].meta.id
      }

      const header = document.querySelector('.page-header')
      const headerBottom = header ? header.getBoundingClientRect().bottom : 148
      const triggerLine = headerBottom + 76

      let candidateId = sections[0].meta.id
      for (const sec of sections) {
        const el = document.getElementById(`br-path-${sec.meta.id}`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= triggerLine) {
          candidateId = sec.meta.id
        } else {
          break
        }
      }
      return candidateId
    }

    const commitActiveSection = () => {
      if (isProgrammaticScrollRef.current) return
      const candidateId = detectCurrentSectionId()
      if (candidateId && candidateId !== activePathIdRef.current) {
        activePathIdRef.current = candidateId
        setActivePathId(candidateId)
      }
    }

    const evaluateOnScrollFrame = () => {
      spyRaf = 0
      if (isProgrammaticScrollRef.current || sections.length === 0) return

      const currentScroll = getVerticalScrollTop()
      const velocity = Math.abs(currentScroll - lastScrollY)
      lastScrollY = currentScroll

      if (settleTimer) {
        clearTimeout(settleTimer)
        settleTimer = null
      }

      // Tez vertikal scroll qilinganda oraliqdagi barcha tablar birma-bir miltillab
      // shovqin yaratmasligi uchun tezlik pasayishini (85ms) kutib silliq o'tkazadi.
      if (velocity > 18) {
        settleTimer = setTimeout(commitActiveSection, 85)
      } else {
        commitActiveSection()
      }
    }

    const onScroll = () => {
      if (isProgrammaticScrollRef.current) return
      if (!spyRaf) {
        spyRaf = window.requestAnimationFrame(evaluateOnScrollFrame)
      }
    }

    const onUserInterrupt = () => {
      if (isProgrammaticScrollRef.current) {
        cancelProgrammaticScroll()
      }
    }

    const removeScrollListener = addPageScrollListener(onScroll)
    window.addEventListener('wheel', onUserInterrupt, { passive: true })
    window.addEventListener('touchstart', onUserInterrupt, { passive: true })

    return () => {
      removeScrollListener()
      window.removeEventListener('wheel', onUserInterrupt)
      window.removeEventListener('touchstart', onUserInterrupt)
      if (spyRaf) window.cancelAnimationFrame(spyRaf)
      if (settleTimer) clearTimeout(settleTimer)
      cancelProgrammaticScroll()
    }
  }, [sections, cancelProgrammaticScroll])

  return {
    activePathId,
    handleSelectTab,
  }
}

/**
 * Brilliant App 1:1 Yuqori Gorizontal Tablar (Math, Basic Algebra, Algebra...)
 * Uzluksiz (continuous) exponential damping (lerp) orqali strip.scrollLeft'ni
 * shovqinsiz, ipakdek silliq markazga olib keladi.
 */
function BrilliantPathTabs({
  sections,
  activeId,
  lang,
  onSelect,
}: {
  sections: PathSectionData[]
  activeId: string
  lang: 'uz' | 'ru'
  onSelect: (id: string) => void
}) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const hScrollRafRef = useRef<number>(0)
  const targetLeftRef = useRef<number | null>(null)

  useEffect(() => {
    const strip = stripRef.current
    if (!strip || !activeId || typeof window === 'undefined') return
    const btn = strip.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
    if (!btn) return

    const stripWidth = strip.clientWidth
    if (stripWidth <= 0) return

    const maxScroll = Math.max(0, strip.scrollWidth - stripWidth)
    const btnCenter = btn.offsetLeft + btn.offsetWidth / 2
    const targetLeft = Math.max(0, Math.min(maxScroll, btnCenter - stripWidth / 2))
    targetLeftRef.current = targetLeft

    if (typeof window.requestAnimationFrame !== 'function') {
      strip.scrollLeft = targetLeft
      return
    }

    // Agar animatsiya allaqachon ishlayotgan bo'lsa, uni qayta noldan boshlamasdan
    // yangi targetLeftRef tomonga uzluksiz (jerk'siz) davom ettiradi.
    if (hScrollRafRef.current) return

    const tick = () => {
      const el = stripRef.current
      const dest = targetLeftRef.current
      if (!el || dest === null) {
        hScrollRafRef.current = 0
        return
      }

      const current = el.scrollLeft
      const diff = dest - current

      if (Math.abs(diff) <= 0.8) {
        el.scrollLeft = dest
        hScrollRafRef.current = 0
        return
      }

      // Critically-damped lerp: shovqinsiz, tabiiy sekinlashuv
      el.scrollLeft = current + diff * 0.16
      hScrollRafRef.current = window.requestAnimationFrame(tick)
    }

    hScrollRafRef.current = window.requestAnimationFrame(tick)
  }, [activeId])

  useEffect(() => {
    return () => {
      if (hScrollRafRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(hScrollRafRef.current)
        hScrollRafRef.current = 0
      }
    }
  }, [])

  if (sections.length <= 1) return null

  return (
    <nav className="br-path-strip" aria-label={lang === 'ru' ? 'Разделы курса' : "O'quv bo'limlari"}>
      <div ref={stripRef} className="br-path-strip-scroll">
        {sections.map(({ meta }, idx) => {
          const isActive = meta.id === activeId
          const label = lang === 'ru' ? meta.shortTabRu : meta.shortTabUz
          const prevMeta = idx > 0 ? sections[idx - 1].meta : null
          const showDivider =
            idx > 0 &&
            ((Boolean(meta.categoryGroupUz) && prevMeta?.categoryGroupUz !== meta.categoryGroupUz) ||
              (Boolean(meta.kind) && prevMeta?.kind !== meta.kind))

          return (
            <div key={meta.id} className="br-path-tab-wrap">
              {showDivider && <div className="br-path-tab-divider" aria-hidden="true" />}
              <button
                type="button"
                data-tab-id={meta.id}
                data-tone={getSectionTone(idx)}
                data-active={isActive ? 'true' : undefined}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(meta.id)}
                className="br-path-tab"
              >
                <div className="br-path-tab-box">
                  <img
                    src={meta.pathImage}
                    alt=""
                    className="size-10 object-contain select-none pointer-events-none"
                  />
                </div>
                <span className="br-path-tab-label">{label}</span>
                <span className="br-path-tab-indicator" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * Brilliant App 1:1 Path Section (Hero + Connected Cards Stack)
 */
function BrilliantCourseSection({
  section,
  lang,
  tone,
  isActiveSection = false,
  isPinned = false,
  onPin,
}: {
  section: PathSectionData
  lang: 'uz' | 'ru'
  tone: BrilliantSectionTone
  isActiveSection?: boolean
  isPinned?: boolean
  onPin: () => void
}) {
  const { meta, headingTitle, items } = section
  const eyebrow = lang === 'ru' ? meta.eyebrowRu : meta.eyebrowUz
  const desc = lang === 'ru' ? meta.descRu : meta.descUz
  const newLabel = 'NEW'
  const pinLabel = lang === 'ru'
    ? (isPinned ? 'Убрать из закреплённых' : 'Закрепить раздел')
    : (isPinned ? "Mahkamlanganlardan olib tashlash" : "Bo'limni mahkamlash")

  return (
    <section
      id={`br-path-${meta.id}`}
      data-tone={tone}
      data-section-active={isActiveSection ? 'true' : undefined}
      className="br-path-section"
    >
      {/* ── Path Header Hero: Eyebrow + Pin tugma tepada, sarlavha chapda, 3D rasm o'ngda ── */}
      <div className="br-path-hero-wrap">
        <div className="w-full max-w-[580px] mx-auto">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider text-psubtle uppercase">
              {eyebrow}
            </span>
            <button
              type="button"
              onClick={onPin}
              aria-pressed={isPinned}
              aria-label={pinLabel}
              className="br-pin-btn"
            >
              <Star size={16} strokeWidth={2.2} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="br-path-hero-flex">
            <div className="min-w-0 flex-1 pr-2">
              <h2 className="text-[22px] font-extrabold tracking-tight text-pfg leading-snug">
                {headingTitle}
              </h2>
              <p className="mt-1.5 text-[13.5px] text-pmuted leading-relaxed line-clamp-2">
                {desc}
              </p>
            </div>

            <div className="br-path-hero-art">
              <img
                src={meta.pathImage}
                alt=""
                className="max-w-[76px] max-h-[76px] object-contain drop-shadow-sm select-none pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Connected Topic Cards Stack (Skrinshotdagi kabi 1:1 toza va nozik) ── */}
      <div className="br-topics-track">
        {items.map((item, idx) => {
          const isLocked = item.state === 'locked'
          const isDone = item.state === 'done'

          return (
            <div key={item.key} className="br-topic-node">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && item.onClick()}
                className="br-topic-card"
              >
                {/* Yashil NEW belgisi (o'ng burchakda) */}
                {item.isNew && !isDone && !isLocked && (
                  <span className="br-new-badge absolute top-3.5 right-4">
                    {newLabel}
                  </span>
                )}

                {/* Qulflangan holat */}
                {isLocked && (
                  <Lock
                    size={14}
                    strokeWidth={2}
                    className="text-pmuted absolute top-4 right-4"
                  />
                )}

                {/* Chap tomondagi 3D Mavzu rasmi */}
                <div className="relative size-[58px] shrink-0 flex items-center justify-center select-none">
                  <img
                    src={item.image}
                    alt=""
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    loading="lazy"
                  />
                  {isDone && (
                    <span
                      className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-white shadow-xs"
                      style={{ background: 'var(--br-green)' }}
                    >
                      <Check size={12} strokeWidth={2.75} />
                    </span>
                  )}
                </div>

                {/* O'ng tomondagi toza matnlar va nozik progress chiziqcha */}
                <div className="min-w-0 flex-1 pr-8">
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-[11px] font-bold text-psubtle uppercase tracking-wider">
                      {item.gradeLabel}
                    </span>
                    {item.count > 1 && item.done > 0 && (
                      <span className="text-[11px] font-semibold text-pmuted tabular-nums">
                        {item.done}/{item.count}
                      </span>
                    )}
                  </div>

                  {/* Qalin mavzu nomi */}
                  <p className="mt-0.5 text-[16px] font-bold text-pfg leading-snug line-clamp-2">
                    {item.title}
                  </p>

                  {/* Nozik 3.5px progress chizig'i — faqat real progress bo'lganda ko'rsatiladi */}
                  {(isDone || item.progressPct > 0) && (
                    <div className="br-card-progress-track">
                      <div
                        className="br-card-progress-bar"
                        style={{
                          width: isDone ? '100%' : `${item.progressPct}%`,
                          background: isDone ? 'var(--br-green)' : 'var(--br-accent)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </button>

              {/* Kartalar orasidagi ingichka markaziy vertikal connector */}
              {idx < items.length - 1 && (
                <div className="br-connector" aria-hidden="true" />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** YHQ — barcha modullar va ularning darslari */
function YhqTopics() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const user = useAppStore((s) => s.user)
  const tt = useT(settings.language)
  const lang = settings.language
  const uid = user?.id ?? '0'
  const lessonsProg = useLessonsStore((s) => s.byUser[uid])

  const visibleByMod = useMemo(() => {
    const perMod: Record<number, LessonMeta[]> = {}
    const map = lessonMap as Record<string, number[]>
    for (const mod of modules) {
      const list = lessonsData[mod.id] ?? []
      const rows = list.map((lesson, idx) => ({
        idx,
        title: lang === 'ru' ? lesson.titleRu : lesson.titleUz,
        ids: map[`${mod.id}:${idx}`] ?? [],
      }))
      const withQuestions = rows.filter((r) => r.ids.length > 0)
      perMod[mod.id] = withQuestions.length > 0 ? withQuestions : rows
    }
    return perMod
  }, [lang])

  const startLesson = useCallback(
    (modId: number, l: LessonMeta) => {
      const lessonTitle = lang === 'ru' ? `Урок ${l.idx + 1}: ${l.title}` : `${l.idx + 1}-dars: ${l.title}`
      navigate(
        '/test/1',
        config.testSessionsV2Enabled
          ? {
              state: {
                mode: 'lesson',
                serverSelector: { type: 'lesson', moduleId: modId, lessonIndex: l.idx },
                title: lessonTitle,
              },
            }
          : {
              state: { questionIds: l.ids, title: lessonTitle },
            },
      )
    },
    [lang, navigate],
  )

  const sections = useMemo<PathSectionData[]>(() => {
    const result: PathSectionData[] = []
    let globalLessonIdx = 0

    for (const mod of modules) {
      const lessons = visibleByMod[mod.id] ?? []
      if (lessons.length === 0) continue
      const doneIdx = lessonsProg?.[mod.id] ?? []
      const doneCount = lessons.filter((l) => doneIdx.includes(l.idx)).length
      const pMeta = YHQ_BRILLIANT_PATHS[mod.id] ?? YHQ_BRILLIANT_PATHS[1]
      const modTitle = lang === 'ru' ? mod.titleRu : mod.title

      const items: TopicCardItem[] = lessons.map((l, i) => {
        const isDone = doneIdx.includes(l.idx)
        const st: LessonState = isDone
          ? 'done'
          : l.idx === 0 || doneIdx.includes(l.idx - 1)
            ? 'active'
            : 'locked'
        const img = getBrilliantTopicImage(l.title, globalLessonIdx++, '')
        return {
          key: `${mod.id}:${l.idx}`,
          gradeLabel: lang === 'ru' ? `УРОК ${l.idx + 1}` : `${l.idx + 1}-DARS`,
          title: l.title,
          image: img,
          done: isDone ? l.ids.length : 0,
          count: l.ids.length,
          progressPct: isDone ? 100 : 0,
          state: st,
          isNew: i === 0 && pMeta.isNew,
          onClick: () => startLesson(mod.id, l),
        }
      })

      result.push({
        meta: {
          id: String(mod.id),
          shortTabUz: pMeta.shortTabUz,
          shortTabRu: pMeta.shortTabRu,
          eyebrowUz: `BOSQICH ${mod.id}`,
          eyebrowRu: `ЭТАП ${mod.id}`,
          titleUz: mod.title,
          titleRu: mod.titleRu,
          descUz: pMeta.descUz,
          descRu: pMeta.descRu,
          pathImage: pMeta.pathImage,
          isNew: pMeta.isNew,
          categoryGroupUz: pMeta.categoryGroupUz,
          categoryGroupRu: pMeta.categoryGroupRu,
        },
        headingTitle: modTitle,
        items,
        doneCount,
        totalCount: lessons.length,
      })
    }
    return result
  }, [visibleByMod, lessonsProg, lang, startLesson])

  const {
    activePathId,
    handleSelectTab,
  } = useBrilliantScrollNavigation(sections)
  const { pinnedId, togglePin } = usePinnedPath('yhq', sections)

  return (
    <div className="br-courses-page pb-16">
      <PageHeader
        title={tt('topics')}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="mb-0"
      >
        <BrilliantPathTabs
          sections={sections}
          activeId={activePathId}
          lang={lang}
          onSelect={handleSelectTab}
        />
      </PageHeader>

      {/* Jami uzun ro'yxat bo'lib qoladi (Brilliant 1:1) */}
      <div className="flex flex-col gap-6">
        {sections.map((sec, idx) => (
          <BrilliantCourseSection
            key={sec.meta.id}
            section={sec}
            lang={lang}
            tone={getSectionTone(idx)}
            isActiveSection={sec.meta.id === activePathId}
            isPinned={sec.meta.id === pinnedId}
            onPin={() => togglePin(sec.meta.id)}
          />
        ))}
      </div>
    </div>
  )
}

/** Rus tili, Rus adabiyoti va fanlar */
function SubjectTopics({ subjectId }: { subjectId: string }) {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const solvedQuestions = useAppStore((s) => s.solvedQuestions ?? [])
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)
  const loaded = useQuestionsStore((s) => s.loaded)
  const loading = useQuestionsStore((s) => s.loading)
  const error = useQuestionsStore((s) => s.error)
  const storedSubjectId = useQuestionsStore((s) => s.subjectId)
  const loadQs = useQuestionsStore((s) => s.load)
  const loadTopics = useQuestionsStore((s) => s.loadTopics)
  const retry = useQuestionsStore((s) => s.retry)
  const tt = useT(settings.language)
  const lang = settings.language
  const userId = useAppStore((s) => s.user?.id)
  const darslikMastery = useDarslikMastery()
  const litByUser = useLessonsStore((s) => s.byUser[userId ?? 'guest'])

  const isV2 = config.testSessionsV2Enabled
  const [topicsFailed, setTopicsFailed] = useState(false)
  const [topicsRetry, setTopicsRetry] = useState(0)

  useEffect(() => {
    if (!isV2) {
      if ((!loaded && !loading && !error) || storedSubjectId !== subjectId) {
        void loadQs(lang, subjectId)
      }
      return
    }
    if (storedSubjectId !== subjectId || topics.length === 0) {
      setTopicsFailed(false)
      void loadTopics(subjectId).catch(() => setTopicsFailed(true))
    }
  }, [isV2, loaded, loading, error, storedSubjectId, lang, subjectId, loadQs, loadTopics, topics.length, topicsRetry])

  const [solvedByTopic, setSolvedByTopic] = useState<Record<number, number>>({})
  useEffect(() => {
    if (!isV2 || !userId || userId === '0') return
    let cancelled = false
    api
      .getTopicProgress(userId, subjectId)
      .then((r) => {
        if (!cancelled) setSolvedByTopic(Object.fromEntries(r.topics.map((t) => [t.topicId, t.solved])))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isV2, userId, subjectId])

  // 1. Darslik o'quv bloklari
  const curriculumSections = useMemo<PathSectionData[]>(() => {
    if (subjectId === 'rustili') {
      let globalImgIdx = 0
      return DARSLIK_BLOCKS.map((block, bIdx) => {
        const outline = getBlockOutline(block.id)
        const meta = getDarslikBlockPathMeta(block, bIdx, outline.length)
        const headingTitle = lang === 'ru' ? `Блок ${block.id}. ${block.titleRu}` : `${block.id}-blok. ${block.titleUz}`

        let doneTopics = 0
        const items: TopicCardItem[] = outline.map((rawTopicTitle, itemIdx) => {
          const isPassed = darslikMastery.passed.has(sectionKey(block.id, itemIdx))
          if (isPassed) doneTopics++
          const parsed = parseOutlineTopicHeading(rawTopicTitle, block.id, itemIdx, lang)
          const img = getBrilliantTopicImage(parsed.cleanTitle, globalImgIdx++)

          return {
            key: `rustili-${block.id}-${itemIdx}`,
            gradeLabel: parsed.shortCode,
            title: parsed.cleanTitle,
            image: img,
            done: isPassed ? 1 : 0,
            count: 1,
            progressPct: isPassed ? 100 : 0,
            state: isPassed ? 'done' : 'active',
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => navigate(`/darslik/rus-tili?block=${block.id}&section=${itemIdx}`),
          }
        })

        return {
          meta,
          headingTitle,
          items,
          doneCount: doneTopics,
          totalCount: outline.length,
        }
      })
    }

    if (subjectId === 'rusadabiyot') {
      let globalImgIdx = 10
      return RUSADABIYOT_BLOCKS.map((block, bIdx) => {
        const outline = getRusadabiyotBlockOutline(block.id)
        const meta = getRusadabiyotBlockPathMeta(block, bIdx, outline.length)
        const headingTitle = lang === 'ru' ? `Эпоха ${block.id}. ${block.titleRu}` : `${block.id}-davr. ${block.titleUz}`
        const isEraDone = (litByUser?.[RUSADABIYOT_PROGRESS_MODULE_OFFSET + block.id]?.length ?? 0) > 0

        const items: TopicCardItem[] = outline.map((rawTopicTitle, itemIdx) => {
          const parsed = parseOutlineTopicHeading(rawTopicTitle, block.id, itemIdx, lang)
          const img = getBrilliantTopicImage(parsed.cleanTitle, globalImgIdx++)

          return {
            key: `rusadabiyot-${block.id}-${itemIdx}`,
            gradeLabel: parsed.shortCode,
            title: parsed.cleanTitle,
            image: img,
            done: isEraDone ? 1 : 0,
            count: 1,
            progressPct: isEraDone ? 100 : 0,
            state: isEraDone ? 'done' : 'active',
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => navigate(`/darslik/rus-adabiyot?block=${block.id}&section=${itemIdx}`),
          }
        })

        return {
          meta,
          headingTitle,
          items,
          doneCount: isEraDone ? outline.length : 0,
          totalCount: outline.length,
        }
      })
    }

    return []
  }, [subjectId, lang, darslikMastery.passed, litByUser, navigate])

  // 2. Amaliy testlar / umumiy fan mavzulari
  const rows = useMemo(() => {
    if (isV2) {
      return sortTopicsForTickets(subjectId, topics)
        .map((t) => {
          const count = t.questionCount ?? 0
          return {
            topic: t,
            ids: [] as number[],
            done: Math.min(solvedByTopic[t.id] ?? 0, count),
            count,
          }
        })
        .filter((r) => r.count > 0)
    }
    const byTopic = new Map<number, number[]>()
    for (const q of questions) {
      if (q.topicId == null) continue
      const list = byTopic.get(q.topicId)
      if (list) list.push(q.id)
      else byTopic.set(q.topicId, [q.id])
    }
    const prefix = `${subjectId}:`
    const solved = new Set<number>()
    for (const k of solvedQuestions) {
      if (!k.startsWith(prefix)) continue
      const id = Number(k.slice(prefix.length))
      if (Number.isInteger(id)) solved.add(id)
    }
    return sortTopicsForTickets(subjectId, topics)
      .map((t) => {
        const ids = (byTopic.get(t.id) ?? []).sort((a, b) => a - b)
        return {
          topic: t,
          ids,
          done: ids.filter((id) => solved.has(id)).length,
          count: ids.length,
        }
      })
      .filter((r) => r.ids.length > 0)
  }, [isV2, solvedByTopic, questions, topics, solvedQuestions, subjectId])

  const practiceSections = useMemo<PathSectionData[]>(() => {
    if (rows.length === 0) return []
    const chapters = getSubjectChaptersList(subjectId)
    const grouped = new Map<string, typeof rows>()

    for (const r of rows) {
      const chId = chapters.length > 0 ? getTopicChapterId(subjectId, r.topic.slug, r.topic.nameUz) : 'main'
      const list = grouped.get(chId)
      if (list) list.push(r)
      else grouped.set(chId, [r])
    }

    const orderedChapterDefs =
      chapters.length > 0
        ? [
            ...chapters.filter((c) => grouped.has(c.id)),
            ...(grouped.has('other')
              ? [{ id: 'other', labelUz: "Qo'shimcha mavzular", labelRu: 'Дополнительные темы' }]
              : []),
          ]
        : [{ id: 'main', labelUz: 'Asosiy dastur', labelRu: 'Основная программа' }]

    let globalIdx = 0
    return orderedChapterDefs
      .map((ch, chIdx) => {
        const chRows = grouped.get(ch.id) ?? rows
        if (chRows.length === 0) return null
        const meta = getSubjectChapterPathMeta(subjectId, ch.id, chIdx, ch.labelUz, ch.labelRu, chRows.length)
        const headingTitle = lang === 'ru' ? meta.titleRu : meta.titleUz

        let doneTopics = 0
        const items: TopicCardItem[] = chRows.map(({ topic, done, count }, itemIdx) => {
          const name = lang === 'ru' ? topic.nameRu || topic.nameUz : topic.nameUz || topic.nameRu
          const shownDone = Math.min(done, count)
          if (shownDone >= count && count > 0) doneTopics++
          const st: LessonState = shownDone >= count && count > 0 ? 'done' : 'active'
          const img = getBrilliantTopicImage(name, globalIdx++, topic.slug)
          const pct = count > 0 ? Math.round((shownDone / count) * 100) : 0

          return {
            key: `topic-${topic.id}`,
            gradeLabel: lang === 'ru' ? `ТЕМА ${itemIdx + 1}` : `${itemIdx + 1}-MAVZU`,
            title: name,
            image: img,
            done: shownDone,
            count,
            progressPct: pct,
            state: st,
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => navigate(`/darslik?block=${chIdx + 1}&section=${itemIdx}`),
          }
        })

        return {
          meta,
          headingTitle,
          items,
          doneCount: doneTopics,
          totalCount: chRows.length,
        }
      })
      .filter((s): s is PathSectionData => s !== null)
  }, [rows, subjectId, lang, navigate])

  const allSections = useMemo(
    () => [...curriculumSections, ...practiceSections],
    [curriculumSections, practiceSections],
  )

  const {
    activePathId,
    handleSelectTab,
  } = useBrilliantScrollNavigation(allSections)
  const { pinnedId, togglePin } = usePinnedPath(subjectId, allSections)

  return (
    <div className="br-courses-page pb-16">
      <PageHeader
        title={tt('topics')}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="mb-0"
      >
        <BrilliantPathTabs
          sections={allSections}
          activeId={activePathId}
          lang={lang}
          onSelect={handleSelectTab}
        />
      </PageHeader>

      {/* Jami uzun ro'yxat bo'lib chiqadi (barcha boblar ketma-ket) */}
      <div className="flex flex-col gap-6">
        {allSections.map((sec, idx) => (
          <BrilliantCourseSection
            key={sec.meta.id}
            section={sec}
            lang={lang}
            tone={getSectionTone(idx)}
            isActiveSection={sec.meta.id === activePathId}
            isPinned={sec.meta.id === pinnedId}
            onPin={() => togglePin(sec.meta.id)}
          />
        ))}
      </div>

      {/* Agar mavzular bo'sh bo'lsa */}
      {allSections.length === 0 && !loading && (
        <div className="grid place-items-center py-24 px-4 text-center">
          <p className="text-sm text-pmuted">{tt('topicsEmpty')}</p>
        </div>
      )}

      {/* Xatolik bo'lsa */}
      {((error && allSections.length === 0) || (isV2 && topicsFailed && allSections.length === 0)) && (
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs mt-8 mx-4">
          <p className="text-sm text-pmuted mb-3">{tt('qLoadFailed')}</p>
          <button
            type="button"
            onClick={() => {
              setTopicsRetry((c) => c + 1)
              void retry(lang, subjectId)
            }}
            className="px-5 min-h-11 inline-flex items-center py-2.5 rounded-xl bg-pprimary text-sm font-semibold text-ponprimary active:scale-[0.98] transition-all"
          >
            {tt('qLoadRetry')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TopicsPage() {
  const subjectId = useSubjectStore((s) => s.subjectId)
  if (subjectId === 'yhq') return <YhqTopics />
  return <SubjectTopics subjectId={subjectId} />
}
