import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getSubject } from '../../shared/config/subjects'
import { config } from '../../shared/config'
import { api, type DbTopic } from '../../shared/api'
import { scrollPageToTop } from '../../shared/lib/page-scroll'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { Button } from '../../shared/components/ui/button'
import { sortTopicsForTickets, getTopicChapterId, SUBJECT_CHAPTERS, type ChapterDef } from '../tickets'
import { BrilliantCourseHome, type BrilliantCourseLevel } from './BrilliantCourseHome'
import { BrilliantCourseMap } from './course-engine/BrilliantCourseMap'
import { courseSectionKey } from './course-engine/course-progress'
import type { CourseBlockMeta } from './course-engine/types'

interface SubjectBrilliantHomeProps {
  subjectId: string
}

/**
 * YHQ dan tashqari barcha test-bankli fanlar (fizika, matematika, kimyo, ingliz, tarix, ...)
 * uchun yagona Brilliant Home + BrilliantCourseMap (Rus tili darajasidagi egri xarita) adapteri.
 * Boblar `SUBJECT_CHAPTERS[subjectId]` bo'yicha guruhlanadi, mavzu tuguni esa `/test/1` da ochiladi.
 */
export default function SubjectBrilliantHome({ subjectId }: SubjectBrilliantHomeProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const ru = lang === 'ru'
  const realUserId = useAppStore((s) => s.user?.id)

  const topics = useQuestionsStore((s) => s.topics)
  const storedSubjectId = useQuestionsStore((s) => s.subjectId)
  const loadTopics = useQuestionsStore((s) => s.loadTopics)
  const loadQuestions = useQuestionsStore((s) => s.load)

  const [loadingTopics, setLoadingTopics] = useState(false)
  const [solvedByTopic, setSolvedByTopic] = useState<Record<number, number>>({})
  const [progressRefreshToken, setProgressRefreshToken] = useState(0)
  const wasMap = useRef(false)

  useEffect(() => {
    let cancelled = false
    setSolvedByTopic({})
    setLoadingTopics(true)
    loadTopics(subjectId)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingTopics(false)
      })
    return () => { cancelled = true }
  }, [subjectId, loadTopics])

  useEffect(() => {
    if (!realUserId) {
      setSolvedByTopic({})
      return
    }
    let cancelled = false
    api.getTopicProgress(realUserId, subjectId)
      .then((res) => {
        if (cancelled) return
        const next: Record<number, number> = {}
        for (const item of res.topics ?? []) {
          next[item.topicId] = item.solved
        }
        setSolvedByTopic(next)
      })
      .catch(() => {
        if (!cancelled) setSolvedByTopic({})
      })
    return () => { cancelled = true }
  }, [realUserId, subjectId, progressRefreshToken])

  const subjectTopics = useMemo(
    () => (storedSubjectId === subjectId ? topics : []),
    [storedSubjectId, subjectId, topics],
  )

  const topicMap = useMemo(() => {
    const map = new Map<number, DbTopic>()
    for (const t of subjectTopics) map.set(t.id, t)
    return map
  }, [subjectTopics])

  const { levels, blocks, passedKeys, completedCount, defaultLevelIndex } = useMemo(() => {
    if (subjectTopics.length === 0) {
      return {
        levels: [] as BrilliantCourseLevel[],
        blocks: [] as CourseBlockMeta[],
        passedKeys: new Set<string>(),
        completedCount: 0,
        defaultLevelIndex: 0,
      }
    }

    const sorted = sortTopicsForTickets(subjectId, subjectTopics)
    const definedChapters: ChapterDef[] = (SUBJECT_CHAPTERS[subjectId] ?? []).filter((c) => c.id !== 'all')
    const grouped = new Map<string, DbTopic[]>()
    const leftover: DbTopic[] = []

    for (const ch of definedChapters) grouped.set(ch.id, [])

    for (const topic of sorted) {
      const chId = definedChapters.length > 0 ? getTopicChapterId(subjectId, topic.slug) : 'all'
      const bucket = grouped.get(chId)
      if (bucket) bucket.push(topic)
      else leftover.push(topic)
    }

    const subjectMeta = getSubject(subjectId)
    const buckets: Array<{ titleUz: string; titleRu: string; topics: DbTopic[] }> = []

    for (const ch of definedChapters) {
      const list = grouped.get(ch.id) ?? []
      if (list.length > 0) {
        buckets.push({ titleUz: ch.labelUz, titleRu: ch.labelRu, topics: list })
      }
    }

    if (leftover.length > 0) {
      buckets.push({
        titleUz: subjectMeta?.name ?? subjectId,
        titleRu: subjectMeta?.nameRu ?? subjectId,
        topics: leftover,
      })
    }

    let doneTotal = 0
    const nextPassed = new Set<string>()
    const builtLevels: BrilliantCourseLevel[] = []
    const builtBlocks: CourseBlockMeta[] = []

    buckets.forEach((bucket, idx) => {
      const levelNumber = idx + 1
      let markedCurrent = false
      const items = bucket.topics.map((topic, sIdx) => {
        const qCount = topic.questionCount ?? 0
        const solved = solvedByTopic[topic.id] ?? 0
        const done = qCount > 0 && solved >= qCount
        if (done) {
          doneTotal += 1
          nextPassed.add(courseSectionKey(levelNumber, sIdx))
        }
        const current = !done && !markedCurrent
        if (current) markedCurrent = true
        return {
          key: topic.id,
          title: ru ? (topic.nameRu || topic.nameUz) : (topic.nameUz || topic.nameRu),
          done,
          current,
        }
      })

      builtLevels.push({
        id: levelNumber,
        titleUz: bucket.titleUz,
        titleRu: bucket.titleRu,
        levelLabelUz: `BOB ${levelNumber}`,
        levelLabelRu: `БЛОК ${levelNumber}`,
        items,
      })
      builtBlocks.push({
        id: levelNumber,
        titleUz: bucket.titleUz,
        titleRu: bucket.titleRu,
        sections: items.map((item) => ({ key: item.key, title: item.title })),
      })
    })

    const firstIncompleteLevel = builtLevels.findIndex((lvl) => lvl.items.some((item) => !item.done))
    return {
      levels: builtLevels,
      blocks: builtBlocks,
      passedKeys: nextPassed,
      completedCount: doneTotal,
      defaultLevelIndex: firstIncompleteLevel >= 0 ? firstIncompleteLevel : Math.max(0, builtLevels.length - 1),
    }
  }, [subjectTopics, subjectId, solvedByTopic, ru])

  const searchParams = new URLSearchParams(location.search)
  const requestedBlock = Number(searchParams.get('block'))
  const requestedSectionRaw = searchParams.get('section')
  const requestedSection = requestedSectionRaw !== null && Number.isInteger(Number(requestedSectionRaw))
    ? Number(requestedSectionRaw)
    : undefined
  const mapBlock = blocks.find((b) => b.id === requestedBlock) ?? null

  useEffect(() => {
    if (!mapBlock && wasMap.current) {
      scrollPageToTop()
    }
    wasMap.current = Boolean(mapBlock)
  }, [mapBlock])

  const launchTopicQuiz = async (topicKey: string | number) => {
    const topicId = Number(topicKey)
    const topic = Number.isFinite(topicId) ? topicMap.get(topicId) : undefined
    if (!topic) return
    const title = ru ? (topic.nameRu || topic.nameUz) : (topic.nameUz || topic.nameRu)
    if (config.testSessionsV2Enabled) {
      navigate('/test/1', {
        state: {
          mode: 'topic',
          serverSelector: { type: 'topic', topicId: topic.id },
          title,
        },
      })
      return
    }
    await loadQuestions(lang, subjectId).catch(() => undefined)
    navigate(`/test/${topic.id}`)
  }

  const subjectMeta = getSubject(subjectId)
  const subjectTitle = ru ? (subjectMeta?.nameRu ?? subjectId) : (subjectMeta?.name ?? subjectId)

  if (mapBlock) {
    return (
      <BrilliantCourseMap
        key={`${subjectId}:${mapBlock.id}:${requestedSection ?? ''}`}
        subjectId={subjectId}
        blocks={blocks}
        progress={{
          passed: passedKeys,
          lockSequential: false,
          loading: loadingTopics && blocks.length === 0,
          error: false,
          refresh: () => setProgressRefreshToken((n) => n + 1),
        }}
        courseTitle={subjectTitle}
        courseSubtitle={ru ? 'Все темы курса' : 'Kursning barcha mavzulari'}
        sectionCountLabel={ru ? 'тем' : 'mavzu'}
        unitLabelUz="BOB"
        unitLabelRu="БЛОК"
        initialBlockId={mapBlock.id}
        initialSectionIdx={requestedSection}
        includeUnitCheck={false}
        onBackHome={() => navigate({ pathname: location.pathname }, { replace: true })}
        onOpenSection={({ section }) => { void launchTopicQuiz(section.key) }}
      />
    )
  }

  return (
    <BrilliantCourseHome
      subjectId={subjectId}
      levels={levels}
      completedCount={completedCount}
      loading={loadingTopics && levels.length === 0}
      defaultLevelIndex={defaultLevelIndex}
      onLaunchLevel={(level) => {
        navigate({ pathname: location.pathname, search: `?block=${level.id}` })
      }}
      testId={`subject-brilliant-home-${subjectId}`}
      emptyFallback={
        loadingTopics ? undefined : (
          <div className="text-center max-w-xs space-y-4">
            <h2 className="text-lg font-extrabold text-pfg">
              {subjectTitle}
            </h2>
            <p className="text-sm text-pdim">
              {subjectMeta && !subjectMeta.available
                ? (ru ? 'Учебные материалы для этого предмета скоро появятся.' : 'Bu fan uchun o‘quv materiallari tez kunda qo‘shiladi.')
                : (ru ? 'Темы этого курса пока не загружены.' : 'Bu kurs mavzulari hozircha topilmadi.')}
            </p>
            <Button variant="primary" size="default" onClick={() => navigate('/testlar')}>
              {ru ? 'Перейти к тестам' : 'Testlarga o‘tish'}
            </Button>
          </div>
        )
      }
    />
  )
}
