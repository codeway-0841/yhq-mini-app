import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
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
  DARSLIK_BLOCK_STATS,
  getBlockOutline,
} from '../../content/darslik-rustili'
import {
  RUSADABIYOT_BLOCKS,
  RUSADABIYOT_BLOCK_STATS,
  getRusadabiyotBlockOutline,
} from '../../content/darslik-rusadabiyot'
import { useDarslikMastery, sectionKey } from '../darslik-rustili'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Lock, Check, ChevronDown, ChevronRight, ChevronLeft, BookOpen, ClipboardCheck } from 'lucide-react'
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
  eyebrow: string
  shortEyebrow: string
  title: string
  image: string
  done: number
  count: number
  showFractionAlways?: boolean
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

/**
 * Brilliant.org /courses/ 1:1 Path Section:
 * - Mobile (< 1024px): Eyebrow + H3 + NEW badge + description + vertical connected 3D cards
 * - Desktop (>= 1024px): 72x72 3D Path Icon + Eyebrow + H3 + Chevron + collapsible #f5f5f5 tray with horizontal 164x164 square cards
 */
function BrilliantPathSection({
  section,
  lang,
  open,
  onToggle,
}: {
  section: PathSectionData
  lang: 'uz' | 'ru'
  open: boolean
  onToggle: () => void
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(section.items.length > 5)

  const { meta, headingTitle, items, doneCount, totalCount } = section
  const eyebrow = lang === 'ru' ? meta.eyebrowRu : meta.eyebrowUz
  const desc = lang === 'ru' ? meta.descRu : meta.descUz
  const newLabel = lang === 'ru' ? 'НОВОЕ' : 'YANGI'

  const updateScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 12)
    setCanScrollRight(maxScroll - el.scrollLeft > 12)
  }, [])

  useEffect(() => {
    if (!open) return
    updateScrollState()
    const el = trackRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [open, items.length, updateScrollState])

  const scrollTrack = (dir: -1 | 1) => {
    if (!trackRef.current) return
    trackRef.current.scrollBy({ left: dir * 540, behavior: 'smooth' })
  }

  return (
    <section
      id={`br-path-${meta.id}`}
      data-path-id={meta.id}
      className="scroll-mt-36 py-7 first:pt-3 border-b border-pline last:border-b-0"
    >
      {/* Path Header — Bosilganda ochiladi/yopiladi */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="br-path-header-btn group"
      >
        {/* Desktop 72x72 3D Path Icon */}
        <div className="hidden lg:flex size-[72px] shrink-0 items-center justify-center select-none">
          <img
            src={meta.pathImage}
            alt=""
            className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="br-path-eyebrow">
              {eyebrow}
            </span>
            {totalCount > 0 && doneCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-psurface px-2 py-0.5 text-[10.5px] font-bold text-pprimary tabular-nums">
                {doneCount}/{totalCount}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2.5 flex-wrap">
            <h3 className="text-[20px] lg:text-[20px] font-bold tracking-tight text-pfg leading-snug">
              {headingTitle}
            </h3>
            {meta.isNew && <span className="br-new-badge">{newLabel}</span>}
            <ChevronDown
              size={17}
              strokeWidth={2.25}
              className={`text-psubtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </div>

          <p className="mt-1 br-path-desc max-w-3xl">
            {desc}
          </p>
        </div>
      </button>

      {/* Mavzular / Darslar zanjiri */}
      {open && (
        <div className="br-topics-tray">
          {canScrollLeft && items.length > 5 && (
            <>
              <div className="hidden lg:block br-tray-fade-left" aria-hidden="true" />
              <button
                type="button"
                onClick={() => scrollTrack(-1)}
                aria-label={lang === 'ru' ? 'Прокрутить влево' : 'Chapga surish'}
                className="hidden lg:grid br-tray-nav-btn left-3"
              >
                <ChevronLeft size={18} strokeWidth={2.25} />
              </button>
            </>
          )}

          <div ref={trackRef} className="br-topics-track">
            {items.map((item, idx) => {
              const isLocked = item.state === 'locked'
              const isDone = item.state === 'done'
              const pct = item.count > 0 ? Math.round((Math.min(item.done, item.count) / item.count) * 100) : 0

              return (
                <div key={item.key} className="br-topic-node">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && item.onClick()}
                    className="br-topic-card"
                  >
                    {/* Mobile top-right corner badge (NEW or Lock) matching Brilliant 1:1 */}
                    {item.isNew && !isDone && !isLocked && (
                      <span className="br-new-badge lg:hidden absolute top-3 right-3.5">
                        {newLabel}
                      </span>
                    )}
                    {isLocked && (
                      <Lock
                        size={14}
                        strokeWidth={2}
                        className="text-pmuted lg:hidden absolute top-3.5 right-3.5"
                      />
                    )}

                    {/* Visual Square (Desktop 164x164 box / Mobile 72x72 left icon container) */}
                    <div className="br-topic-square shrink-0">
                      {/* Desktop Top Meta Row inside Square */}
                      <div className="hidden lg:flex w-full items-center justify-between gap-1">
                        <span className="text-[10.5px] font-bold tracking-wider text-psubtle uppercase truncate">
                          {item.shortEyebrow}
                        </span>
                        {isDone ? (
                          <span
                            className="grid size-5 place-items-center rounded-full text-white shrink-0"
                            style={{ background: 'var(--br-green)' }}
                          >
                            <Check size={12} strokeWidth={2.75} />
                          </span>
                        ) : isLocked ? (
                          <Lock size={13} strokeWidth={2} className="text-pmuted shrink-0" />
                        ) : item.isNew ? (
                          <span className="br-new-badge">{newLabel}</span>
                        ) : null}
                      </div>

                      {/* 3D Brilliant Topic Illustration */}
                      <div className="relative size-[72px] lg:size-[86px] flex items-center justify-center my-auto select-none">
                        <img
                          src={item.image}
                          alt=""
                          className="max-w-full max-h-full object-contain pointer-events-none select-none"
                          loading="lazy"
                        />
                        {isDone && (
                          <span
                            className="lg:hidden absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-white shadow-xs"
                            style={{ background: 'var(--br-green)' }}
                          >
                            <Check size={12} strokeWidth={2.75} />
                          </span>
                        )}
                      </div>

                      {/* Desktop Bottom Mini Progress Bar inside Square (only when progress started) */}
                      {pct > 0 ? (
                        <div className="hidden lg:flex w-full items-center gap-1.5 pt-1">
                          <div className="h-1.5 flex-1 rounded-full bg-plineStrong overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: 'var(--br-green)' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="hidden lg:block h-1.5 w-full" aria-hidden="true" />
                      )}
                    </div>

                    {/* Text & Progress Block */}
                    <div className="min-w-0 flex-1 lg:w-full pr-10 lg:pr-0">
                      {/* Mobile Top Eyebrow */}
                      <div className="flex items-center gap-2 lg:hidden mb-1">
                        <span className="text-[11.5px] font-bold tracking-wider text-psubtle uppercase">
                          {item.eyebrow}
                        </span>
                      </div>

                      {/* Topic / Lesson Title */}
                      <p className="text-[16px] lg:text-[13.5px] font-semibold lg:font-medium text-pfg leading-snug line-clamp-2">
                        {item.title}
                      </p>

                      {/* Progress Bar & Fraction (shown for practice test topics or when started) */}
                      {(item.showFractionAlways || item.done > 0) && item.count > 1 && (
                        <div className="mt-2 lg:mt-1 flex items-center lg:justify-center gap-2">
                          <div className="h-1.5 flex-1 lg:hidden rounded-full bg-plineStrong overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: 'var(--br-blue)' }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-pmuted tabular-nums shrink-0">
                            {Math.min(item.done, item.count)}/{item.count}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Connector Line (Vertical on Mobile, Horizontal on Desktop) */}
                  {idx < items.length - 1 && (
                    <div className="br-connector" aria-hidden="true" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop Right Horizontal Scroll Arrow + Gradient Fade */}
          {canScrollRight && items.length >= 5 && (
            <>
              <div className="hidden lg:block br-tray-fade-right" aria-hidden="true" />
              <button
                type="button"
                onClick={() => scrollTrack(1)}
                aria-label={lang === 'ru' ? 'Прокрутить вправо' : "O'ngga surish"}
                className="hidden lg:grid br-tray-nav-btn right-3"
              >
                <ChevronRight size={18} strokeWidth={2.25} />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Tepa gorizontal Learning Path Icon Strip (Mobil < 1024px uchun, Brilliant 1:1).
 */
function MobilePathStrip({
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

  useEffect(() => {
    if (!stripRef.current || !activeId) return
    const btn = stripRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeId])

  if (sections.length <= 1) return null
  return (
    <nav className="br-path-strip lg:hidden" aria-label={lang === 'ru' ? 'Разделы курса' : "O'quv bo'limlari"}>
      <div ref={stripRef} className="br-path-strip-scroll">
        {sections.map(({ meta }) => {
          const isActive = meta.id === activeId
          const label = lang === 'ru' ? meta.shortTabRu : meta.shortTabUz
          return (
            <button
              key={meta.id}
              type="button"
              data-tab-id={meta.id}
              data-active={isActive ? 'true' : undefined}
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
          )
        })}
      </div>
    </nav>
  )
}

/** YHQ — barcha 8 modul va ularning barcha darslari (Brilliant /courses/ 1:1 formatida). */
function YhqTopics() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const user = useAppStore((s) => s.user)
  const tt = useT(settings.language)
  const lang = settings.language
  const uid = user?.id ?? '0'
  const lessonsProg = useLessonsStore((s) => s.byUser[uid])

  /** Har modul uchun barcha darslar */
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
        const st: LessonState = doneIdx.includes(l.idx)
          ? 'done'
          : l.idx === 0 || doneIdx.includes(l.idx - 1)
            ? 'active'
            : 'locked'
        const img = getBrilliantTopicImage(l.title, globalLessonIdx++, '')
        return {
          key: `${mod.id}:${l.idx}`,
          eyebrow:
            lang === 'ru'
              ? `УРОК ${l.idx + 1} · ${l.ids.length} ВОПР.`
              : `${l.idx + 1}-DARS · ${l.ids.length} SAVOL`,
          shortEyebrow: lang === 'ru' ? `УРОК ${l.idx + 1}` : `${l.idx + 1}-DARS`,
          title: lang === 'ru' ? `Урок ${l.idx + 1}. ${l.title}` : `${l.idx + 1}-dars. ${l.title}`,
          image: img,
          done: st === 'done' ? l.ids.length : 0,
          count: l.ids.length,
          showFractionAlways: false,
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
          eyebrowUz: pMeta.eyebrowUz,
          eyebrowRu: pMeta.eyebrowRu,
          titleUz: mod.title,
          titleRu: mod.titleRu,
          descUz: pMeta.descUz,
          descRu: pMeta.descRu,
          pathImage: pMeta.pathImage,
          isNew: pMeta.isNew,
          categoryGroupUz: pMeta.categoryGroupUz,
          categoryGroupRu: pMeta.categoryGroupRu,
          kind: 'curriculum',
        },
        headingTitle: modTitle,
        items,
        doneCount,
        totalCount: lessons.length,
      })
    }
    return result
  }, [visibleByMod, lessonsProg, lang, startLesson])

  const [activePathId, setActivePathId] = useState<string>(() => sections[0]?.meta.id ?? '1')
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  const toggleSection = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }))
    setActivePathId(id)
  }

  const handleSelectTab = (id: string) => {
    setActivePathId(id)
    setCollapsedMap((prev) => ({ ...prev, [id]: false }))
    const el = document.getElementById(`br-path-${id}`)
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="br-courses-page px-4 pb-12 max-w-6xl mx-auto">
      <PageHeader
        title={tt('topics')}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="-mx-4 mb-2"
      >
        <MobilePathStrip
          sections={sections}
          activeId={activePathId}
          lang={lang}
          onSelect={handleSelectTab}
        />
      </PageHeader>

      <div className="flex flex-col">
        {sections.map((sec, idx) => {
          const prevGroup =
            idx > 0
              ? lang === 'ru'
                ? sections[idx - 1].meta.categoryGroupRu
                : sections[idx - 1].meta.categoryGroupUz
              : null
          const curGroup = lang === 'ru' ? sec.meta.categoryGroupRu : sec.meta.categoryGroupUz
          const showGroupHeading = curGroup && curGroup !== prevGroup

          return (
            <div key={sec.meta.id}>
              {showGroupHeading && (
                <h2 className="text-[22px] lg:text-[24px] font-bold tracking-tight text-pfg mt-8 mb-1 first:mt-4">
                  {curGroup}
                </h2>
              )}
              <BrilliantPathSection
                section={sec}
                lang={lang}
                open={!collapsedMap[sec.meta.id]}
                onToggle={() => toggleSection(sec.meta.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Rus tili, Rus adabiyoti va boshqa fanlar:
 * 1) O'quv kurslari / Darslik bloklari (Rus tilida barcha 24 blok va 537 mavzu; Rus adabiyotida barcha 9 davr va 79 mavzu)
 * 2) Alohida ajratilgan "Mavzulashtirilgan amaliy testlar" bo'limi (useQuestionsStore.topics -> /test/1)
 */
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

  const isV2 = config.testSessionsV2Enabled
  const [topicsFailed, setTopicsFailed] = useState(false)
  const [topicsRetry, setTopicsRetry] = useState(0)
  const [filterMode, setFilterMode] = useState<'all' | 'curriculum' | 'practice'>('all')

  useEffect(() => {
    setFilterMode('all')
  }, [subjectId])

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

  // v2 progress agregati (server, question-level mapping'siz)
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

  // ── 1-BO'LIM: DARSLIK BLOKLARI VA BARCHA MAVZULARI (Rus tili: 24 blok, Rus adabiyoti: 9 blok) ──
  const curriculumSections = useMemo<PathSectionData[]>(() => {
    if (subjectId === 'rustili') {
      let globalImgIdx = 0
      return DARSLIK_BLOCKS.map((block, bIdx) => {
        const outline = getBlockOutline(block.id)
        const stats = DARSLIK_BLOCK_STATS[block.id]
        const meta = getDarslikBlockPathMeta(block, bIdx, outline.length, stats?.minutes ?? 15)
        const headingTitle =
          lang === 'ru'
            ? `Блок ${block.id}. ${block.titleRu}`
            : `${block.id}-blok. ${block.titleUz}`

        let doneTopics = 0
        const items: TopicCardItem[] = outline.map((rawTopicTitle, itemIdx) => {
          const isPassed = darslikMastery.passed.has(sectionKey(block.id, itemIdx))
          if (isPassed) doneTopics++
          const parsed = parseOutlineTopicHeading(rawTopicTitle, block.id, itemIdx, lang)
          const img = getBrilliantTopicImage(parsed.cleanTitle, globalImgIdx++)

          return {
            key: `rustili-${block.id}-${itemIdx}`,
            eyebrow: parsed.fullEyebrow,
            shortEyebrow: parsed.shortCode,
            title: parsed.cleanTitle,
            image: img,
            done: isPassed ? 1 : 0,
            count: 1,
            showFractionAlways: false,
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
      let globalImgIdx = 12
      return RUSADABIYOT_BLOCKS.map((block, bIdx) => {
        const outline = getRusadabiyotBlockOutline(block.id)
        const stats = RUSADABIYOT_BLOCK_STATS[block.id]
        const meta = getRusadabiyotBlockPathMeta(block, bIdx, outline.length, stats?.minutes ?? 45)
        const headingTitle =
          lang === 'ru'
            ? `Эпоха ${block.id}. ${block.titleRu}`
            : `${block.id}-davr. ${block.titleUz}`

        const items: TopicCardItem[] = outline.map((rawTopicTitle, itemIdx) => {
          const parsed = parseOutlineTopicHeading(rawTopicTitle, block.id, itemIdx, lang)
          const img = getBrilliantTopicImage(parsed.cleanTitle, globalImgIdx++)

          return {
            key: `rusadabiyot-${block.id}-${itemIdx}`,
            eyebrow:
              lang === 'ru'
                ? `ЭПОХА ${block.id} · ТЕМА ${itemIdx + 1}`
                : `${block.id}-DAVR · ${itemIdx + 1}-MAVZU`,
            shortEyebrow: parsed.shortCode,
            title: parsed.cleanTitle,
            image: img,
            done: 0,
            count: 1,
            showFractionAlways: false,
            state: 'active',
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => navigate(`/darslik/rus-adabiyot?block=${block.id}`),
          }
        })

        return {
          meta,
          headingTitle,
          items,
          doneCount: 0,
          totalCount: outline.length,
        }
      })
    }

    return []
  }, [subjectId, lang, darslikMastery.passed, navigate])

  // ── 2-BO'LIM: MAVZULASHTIRILGAN AMALIY TESTLAR (useQuestionsStore.topics) ──
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

  const startTopic = useCallback(
    (topicId: number, title: string, ids: number[]) => {
      navigate(
        '/test/1',
        isV2
          ? { state: { mode: 'topic', serverSelector: { type: 'topic', topicId }, title } }
          : { state: { questionIds: ids, title } },
      )
    },
    [isV2, navigate],
  )

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
              ? [{ id: 'other', labelUz: "Qo'shimcha test mavzulari", labelRu: 'Дополнительные темы тестов' }]
              : []),
          ]
        : [{ id: 'main', labelUz: 'Asosiy testlar', labelRu: 'Основные тесты' }]

    const finalDefs =
      orderedChapterDefs.length > 0
        ? orderedChapterDefs
        : [{ id: 'other', labelUz: 'Asosiy testlar', labelRu: 'Основные тесты' }]

    let globalIdx = curriculumSections.length > 0 ? 35 : 0
    return finalDefs
      .map((ch, chIdx) => {
        const chRows = grouped.get(ch.id) ?? rows
        if (chRows.length === 0) return null
        const meta = getSubjectChapterPathMeta(subjectId, ch.id, chIdx, ch.labelUz, ch.labelRu, chRows.length)
        const headingTitle = lang === 'ru' ? meta.titleRu : meta.titleUz

        let doneTopics = 0
        const items: TopicCardItem[] = chRows.map(({ topic, ids, done, count }, itemIdx) => {
          const name = lang === 'ru' ? topic.nameRu || topic.nameUz : topic.nameUz || topic.nameRu
          const shownDone = Math.min(done, count)
          if (shownDone >= count && count > 0) doneTopics++
          const st: LessonState = shownDone >= count && count > 0 ? 'done' : 'active'
          const img = getBrilliantTopicImage(name, globalIdx++, topic.slug)

          return {
            key: `test-topic-${topic.id}`,
            eyebrow:
              lang === 'ru'
                ? `ТЕСТ ${itemIdx + 1} · ${count} ВОПР.`
                : `${itemIdx + 1}-TEST · ${count} SAVOL`,
            shortEyebrow: lang === 'ru' ? `ТЕСТ ${itemIdx + 1}` : `${itemIdx + 1}-TEST`,
            title: name,
            image: img,
            done: shownDone,
            count,
            showFractionAlways: true,
            state: st,
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => startTopic(topic.id, name, ids),
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
  }, [rows, subjectId, lang, startTopic, curriculumSections.length])

  const hasCurriculum = curriculumSections.length > 0
  const hasPractice = practiceSections.length > 0

  const displayedCurriculumSections = useMemo(
    () => (filterMode === 'practice' ? [] : curriculumSections),
    [filterMode, curriculumSections],
  )
  const displayedPracticeSections = useMemo(
    () => (filterMode === 'curriculum' ? [] : practiceSections),
    [filterMode, practiceSections],
  )
  const allDisplayedSections = useMemo(
    () => [...displayedCurriculumSections, ...displayedPracticeSections],
    [displayedCurriculumSections, displayedPracticeSections],
  )

  const [activePathId, setActivePathId] = useState<string>('')
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (allDisplayedSections.length > 0 && !allDisplayedSections.some((s) => s.meta.id === activePathId)) {
      setActivePathId(allDisplayedSections[0].meta.id)
    }
  }, [allDisplayedSections, activePathId])

  const toggleSection = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }))
    setActivePathId(id)
  }

  const handleSelectTab = (id: string) => {
    setActivePathId(id)
    setCollapsedMap((prev) => ({ ...prev, [id]: false }))
    const el = document.getElementById(`br-path-${id}`)
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const totalCurriculumTopics = useMemo(
    () => curriculumSections.reduce((sum, s) => sum + s.totalCount, 0),
    [curriculumSections],
  )

  return (
    <div className="br-courses-page px-4 pb-12 max-w-6xl mx-auto">
      <PageHeader
        title={tt('topics')}
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="-mx-4 mb-2"
      >
        <MobilePathStrip
          sections={allDisplayedSections}
          activeId={activePathId}
          lang={lang}
          onSelect={handleSelectTab}
        />
      </PageHeader>

      {/* Darslik va Amaliy Testlarni ajratib ko'rsatuvchi filtr + tezkor o'tish paneli */}
      {hasCurriculum && (
        <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-pcard p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={lang === 'ru' ? 'Фильтр разделов' : "Bo'limlar filtri"}>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'all'}
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-bold transition-colors ${
                filterMode === 'all'
                  ? 'bg-pprimary text-ponprimary shadow-xs'
                  : 'bg-psurface text-pmuted hover:text-pfg'
              }`}
            >
              {lang === 'ru' ? 'Все разделы' : "Barcha bo'limlar"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'curriculum'}
              onClick={() => setFilterMode('curriculum')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold transition-colors ${
                filterMode === 'curriculum'
                  ? 'bg-pprimary text-ponprimary shadow-xs'
                  : 'bg-psurface text-pmuted hover:text-pfg'
              }`}
            >
              <BookOpen size={15} strokeWidth={2.2} />
              <span>
                {lang === 'ru'
                  ? `Учебные блоки (${curriculumSections.length} блоков · ${totalCurriculumTopics} тем)`
                  : `O'quv bloklari (${curriculumSections.length} ta blok · ${totalCurriculumTopics} ta mavzu)`}
              </span>
            </button>
            {hasPractice && (
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'practice'}
                onClick={() => setFilterMode('practice')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold transition-colors ${
                  filterMode === 'practice'
                    ? 'bg-pprimary text-ponprimary shadow-xs'
                    : 'bg-psurface text-pmuted hover:text-pfg'
                }`}
              >
                <ClipboardCheck size={15} strokeWidth={2.2} />
                <span>
                  {lang === 'ru'
                    ? `Практические тесты (${rows.length})`
                    : `Amaliy testlar (${rows.length} ta)`}
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(subjectId === 'rustili' ? '/darslik/rus-tili' : '/darslik/rus-adabiyot')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[rgb(var(--p-primary-rgb)/0.1)] text-pprimary text-[13px] font-bold hover:opacity-90 active:scale-[0.99] transition-all"
          >
            <span>
              {subjectId === 'rustili'
                ? tt('rusDarslikTitle')
                : lang === 'ru'
                  ? 'Открыть учебник литературы'
                  : 'Adabiyot darsligini ochish'}
            </span>
            <ChevronRight size={16} strokeWidth={2.25} />
          </button>
        </div>
      )}

      {/* 1-BO'LIM: DARSLIK O'QUV BLOKLARI VA BARCHA MAVZULARI */}
      {displayedCurriculumSections.length > 0 && (
        <div className="flex flex-col">
          {displayedCurriculumSections.map((sec, idx) => {
            const prevGroup =
              idx > 0
                ? lang === 'ru'
                  ? displayedCurriculumSections[idx - 1].meta.categoryGroupRu
                  : displayedCurriculumSections[idx - 1].meta.categoryGroupUz
                : null
            const curGroup = lang === 'ru' ? sec.meta.categoryGroupRu : sec.meta.categoryGroupUz
            const showGroupHeading = curGroup && curGroup !== prevGroup

            return (
              <div key={sec.meta.id}>
                {showGroupHeading && (
                  <h2 className="text-[22px] lg:text-[24px] font-bold tracking-tight text-pfg mt-8 mb-1 first:mt-2">
                    {curGroup}
                  </h2>
                )}
                <BrilliantPathSection
                  section={sec}
                  lang={lang}
                  open={!collapsedMap[sec.meta.id]}
                  onToggle={() => toggleSection(sec.meta.id)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* 2-BO'LIM: ALOHIDA AJRATILGAN MAVZULASHTIRILGAN AMALIY TESTLAR */}
      {displayedPracticeSections.length > 0 && (
        <div className={displayedCurriculumSections.length > 0 ? 'mt-12 pt-8 border-t-2 border-pline' : 'flex flex-col'}>
          {hasCurriculum && (
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-pprimary text-ponprimary shrink-0">
                <ClipboardCheck size={20} strokeWidth={2.2} />
              </span>
              <div>
                <h2 className="text-[22px] lg:text-[24px] font-bold tracking-tight text-pfg leading-snug">
                  {lang === 'ru' ? 'Практические тесты по темам' : 'Mavzulashtirilgan amaliy testlar'}
                </h2>
                <p className="text-[13.5px] text-pmuted">
                  {lang === 'ru'
                    ? 'Выберите тему, чтобы сразу начать решение проверочных тестовых вопросов'
                    : "Savollar bazasidan mavzu bo'yicha bilimingizni sinash uchun testni tanlang"}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col">
            {displayedPracticeSections.map((sec) => (
              <BrilliantPathSection
                key={sec.meta.id}
                section={sec}
                lang={lang}
                open={!collapsedMap[sec.meta.id]}
                onToggle={() => toggleSection(sec.meta.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading & Error holatlari */}
      {!hasCurriculum && loading && rows.length === 0 && (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-pprimary border-t-transparent animate-spin" />
        </div>
      )}

      {!hasCurriculum && error && rows.length === 0 && !loading && (
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs mt-4">
          <p className="text-sm text-pmuted mb-3">{tt('qLoadFailed')}</p>
          <button
            type="button"
            onClick={() => void retry(lang, subjectId)}
            className="px-5 min-h-11 inline-flex items-center py-2.5 rounded-xl bg-pprimary text-sm font-semibold text-ponprimary active:scale-[0.98] transition-all"
          >
            {tt('qLoadRetry')}
          </button>
        </div>
      )}

      {!hasCurriculum && loaded && !loading && rows.length === 0 && !error && (
        <p className="text-center text-sm text-pmuted py-16">{tt('topicsEmpty')}</p>
      )}

      {!hasCurriculum && isV2 && rows.length === 0 && !topicsFailed && (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-pprimary border-t-transparent animate-spin" />
        </div>
      )}

      {!hasCurriculum && isV2 && topicsFailed && rows.length === 0 && (
        <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs mt-4">
          <p className="text-sm text-pmuted mb-3">{tt('qLoadFailed')}</p>
          <button
            type="button"
            onClick={() => setTopicsRetry((c) => c + 1)}
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
