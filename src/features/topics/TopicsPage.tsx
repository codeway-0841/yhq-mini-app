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
  getRusadabiyotBlockOutline,
} from '../../content/darslik-rusadabiyot'
import { useDarslikMastery, sectionKey } from '../darslik-rustili'
import { goBack } from '../../shared/lib/navigation'
import { pageScrollOffsetOf, scrollPageTo } from '../../shared/lib/page-scroll'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Check, Lock } from 'lucide-react'
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

function scrollToPathSection(id: string) {
  const el = document.getElementById(`br-path-${id}`)
  if (!el) return
  const targetY = pageScrollOffsetOf(el, -135)
  scrollPageTo(targetY, 'smooth')
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {}
}

function usePathScrollSpy(
  sections: PathSectionData[],
  activeId: string,
  onActivate: (id: string) => void,
) {
  const isClicking = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerScrollTo = useCallback((id: string) => {
    isClicking.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    scrollToPathSection(id)
    timerRef.current = setTimeout(() => {
      isClicking.current = false
    }, 850)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
    if (sections.length <= 1) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (isClicking.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          const sectionId = visible[0].target.id.replace('br-path-', '')
          if (sectionId && sectionId !== activeId) {
            onActivate(sectionId)
          }
        }
      },
      {
        rootMargin: '-120px 0px -40% 0px',
        threshold: [0, 0.1, 0.25],
      },
    )

    for (const sec of sections) {
      const el = document.getElementById(`br-path-${sec.meta.id}`)
      if (el) observer.observe(el)
    }

    return () => {
      observer.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sections, activeId, onActivate])

  return { triggerScrollTo }
}

/**
 * Brilliant App 1:1 Yuqori Gorizontal Tablar (Math, Basic Algebra, Algebra...)
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

  useEffect(() => {
    if (!stripRef.current || !activeId) return
    const btn = stripRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeId])

  if (sections.length <= 1) return null

  return (
    <nav className="br-path-strip" aria-label={lang === 'ru' ? 'Разделы курса' : "O'quv bo'limlari"}>
      <div ref={stripRef} className="br-path-strip-scroll">
        {sections.map(({ meta }, idx) => {
          const isActive = meta.id === activeId
          const label = lang === 'ru' ? meta.shortTabRu : meta.shortTabUz

          return (
            <div key={meta.id} className="br-path-tab-wrap">
              {idx > 0 && <div className="br-path-tab-divider" aria-hidden="true" />}
              <button
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
  open,
  onToggle,
}: {
  section: PathSectionData
  lang: 'uz' | 'ru'
  open: boolean
  onToggle: () => void
}) {
  const { meta, headingTitle, items } = section
  const eyebrow = lang === 'ru' ? meta.eyebrowRu : meta.eyebrowUz
  const desc = lang === 'ru' ? meta.descRu : meta.descUz
  const newLabel = 'NEW'

  return (
    <section id={`br-path-${meta.id}`} className="br-path-section">
      {/* ── Path Header Hero: Sarlavha chapda, 3D rasm o'ngda, sariq yulduzcha ⭐ ── */}
      <div className="br-path-hero-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="w-full text-left max-w-[580px] mx-auto br-path-hero-flex bg-transparent border-none p-0 cursor-pointer"
        >
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[11px] font-bold tracking-wider text-psubtle uppercase">
              {eyebrow}
            </span>
            <h2 className="mt-1 text-[22px] font-extrabold tracking-tight text-pfg leading-snug">
              {headingTitle}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-pmuted leading-relaxed line-clamp-2">
              {desc}
            </p>
          </div>

          <div className="br-path-hero-art">
            <span className="br-path-star-badge" aria-hidden="true">★</span>
            <img
              src={meta.pathImage}
              alt=""
              className="max-w-[76px] max-h-[76px] object-contain drop-shadow-sm select-none pointer-events-none"
            />
          </div>
        </button>
      </div>

      {/* ── Connected Topic Cards Stack (Skrinshotdagi kabi 1:1 toza va nozik) ── */}
      {open && (
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

                    {/* Nozik 3.5px progress chizig'i */}
                    <div className="br-card-progress-track">
                      <div
                        className="br-card-progress-bar"
                        style={{
                          width: isDone ? '100%' : `${item.progressPct}%`,
                          background: isDone ? 'var(--br-green)' : 'var(--br-blue)',
                        }}
                      />
                    </div>
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
      )}
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
          progressPct: isDone ? 100 : (i === 0 ? 15 : 0),
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

  const { triggerScrollTo } = usePathScrollSpy(sections, activePathId, setActivePathId)

  const toggleSection = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }))
    setActivePathId(id)
  }

  const handleSelectTab = (id: string) => {
    setActivePathId(id)
    setCollapsedMap((prev) => ({ ...prev, [id]: false }))
    triggerScrollTo(id)
  }

  return (
    <div className="br-courses-page pb-16 min-h-screen">
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

      <div className="flex flex-col gap-6">
        {sections.map((sec) => (
          <BrilliantCourseSection
            key={sec.meta.id}
            section={sec}
            lang={lang}
            open={!collapsedMap[sec.meta.id]}
            onToggle={() => toggleSection(sec.meta.id)}
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
            gradeLabel: `GR ${Math.min(11, 4 + Math.floor(block.id / 3))}`,
            title: parsed.cleanTitle,
            image: img,
            done: isPassed ? 1 : 0,
            count: 1,
            progressPct: isPassed ? 100 : (itemIdx === 0 ? 20 : 0),
            state: isPassed ? 'done' : 'active',
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => navigate(`/darslik/rus-tili?block=${block.id}&section=${itemIdx}`),
          }
        })

        return {
          meta: {
            ...meta,
            eyebrowUz: `GRADES ${Math.min(11, 4 + Math.floor(block.id / 3))}`,
            eyebrowRu: `GRADES ${Math.min(11, 4 + Math.floor(block.id / 3))}`,
          },
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
        const headingTitle = lang === 'ru' ? `Блок ${block.id}. ${block.titleRu}` : `${block.id}-blok. ${block.titleUz}`

        const items: TopicCardItem[] = outline.map((rawTopicTitle, itemIdx) => {
          const parsed = parseOutlineTopicHeading(rawTopicTitle, block.id, itemIdx, lang)
          const img = getBrilliantTopicImage(parsed.cleanTitle, globalImgIdx++)

          return {
            key: `rusadabiyot-${block.id}-${itemIdx}`,
            gradeLabel: `ERA ${block.id}`,
            title: parsed.cleanTitle,
            image: img,
            done: 0,
            count: 1,
            progressPct: itemIdx === 0 ? 15 : 0,
            state: 'active',
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => navigate(`/darslik/rus-adabiyot?block=${block.id}`),
          }
        })

        return {
          meta: {
            ...meta,
            eyebrowUz: `ERA ${block.id}`,
            eyebrowRu: `ЭПОХА ${block.id}`,
          },
          headingTitle,
          items,
          doneCount: 0,
          totalCount: outline.length,
        }
      })
    }

    return []
  }, [subjectId, lang, darslikMastery.passed, navigate])

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
        const items: TopicCardItem[] = chRows.map(({ topic, ids, done, count }, itemIdx) => {
          const name = lang === 'ru' ? topic.nameRu || topic.nameUz : topic.nameUz || topic.nameRu
          const shownDone = Math.min(done, count)
          if (shownDone >= count && count > 0) doneTopics++
          const st: LessonState = shownDone >= count && count > 0 ? 'done' : 'active'
          const img = getBrilliantTopicImage(name, globalIdx++, topic.slug)
          const pct = count > 0 ? Math.round((shownDone / count) * 100) : 0

          return {
            key: `topic-${topic.id}`,
            gradeLabel: `GR ${Math.min(12, 4 + itemIdx)}`,
            title: name,
            image: img,
            done: shownDone,
            count,
            progressPct: pct,
            state: st,
            isNew: itemIdx === 0 && meta.isNew,
            onClick: () => startTopic(topic.id, name, ids),
          }
        })

        return {
          meta: {
            ...meta,
            eyebrowUz: `GRADES 7–9`,
            eyebrowRu: `GRADES 7–9`,
          },
          headingTitle,
          items,
          doneCount: doneTopics,
          totalCount: chRows.length,
        }
      })
      .filter((s): s is PathSectionData => s !== null)
  }, [rows, subjectId, lang, startTopic])

  const allSections = useMemo(
    () => [...curriculumSections, ...practiceSections],
    [curriculumSections, practiceSections],
  )

  const [activePathId, setActivePathId] = useState<string>('')
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  const { triggerScrollTo } = usePathScrollSpy(allSections, activePathId, setActivePathId)

  useEffect(() => {
    if (allSections.length > 0 && !allSections.some((s) => s.meta.id === activePathId)) {
      setActivePathId(allSections[0].meta.id)
    }
  }, [allSections, activePathId])

  const toggleSection = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }))
    setActivePathId(id)
  }

  const handleSelectTab = (id: string) => {
    setActivePathId(id)
    setCollapsedMap((prev) => ({ ...prev, [id]: false }))
    triggerScrollTo(id)
  }

  return (
    <div className="br-courses-page pb-16 min-h-screen">
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

      <div className="flex flex-col gap-6">
        {curriculumSections.length > 0 && (
          <div className="flex flex-col gap-6">
            {curriculumSections.map((sec) => (
              <BrilliantCourseSection
                key={sec.meta.id}
                section={sec}
                lang={lang}
                open={!collapsedMap[sec.meta.id]}
                onToggle={() => toggleSection(sec.meta.id)}
              />
            ))}
          </div>
        )}

        {practiceSections.length > 0 && curriculumSections.length > 0 && (
          <div className="w-full max-w-[580px] mx-auto pt-8 pb-2 px-4">
            <h3 className="text-[20px] font-extrabold text-pfg tracking-tight">
              {lang === 'ru' ? 'Практические тесты по темам' : 'Mavzulashtirilgan amaliy testlar'}
            </h3>
          </div>
        )}

        {practiceSections.length > 0 && (
          <div className="flex flex-col gap-6">
            {practiceSections.map((sec) => (
              <BrilliantCourseSection
                key={sec.meta.id}
                section={sec}
                lang={lang}
                open={!collapsedMap[sec.meta.id]}
                onToggle={() => toggleSection(sec.meta.id)}
              />
            ))}
          </div>
        )}
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
