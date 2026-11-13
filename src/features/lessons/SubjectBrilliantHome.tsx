import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubject } from '../../shared/config/subjects'
import { config } from '../../shared/config'
import { api, type DbTopic } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { Button } from '../../shared/components/ui/button'
import { sortTopicsForTickets, getTopicChapterId, SUBJECT_CHAPTERS, type ChapterDef } from '../tickets'
import { BrilliantCourseHome, type BrilliantCourseLevel } from './BrilliantCourseHome'

interface SubjectBrilliantHomeProps {
  subjectId: string
}

/**
 * YHQ, Rus tili va Rus adabiyotidan tashqari barcha fanlar uchun Brilliant 1:1 kurs bosh sahifasi.
 * Boblar `SUBJECT_CHAPTERS[subjectId]` bo'yicha guruhlanadi, mavzular esa `/test/1` da ochiladi.
 */
export default function SubjectBrilliantHome({ subjectId }: SubjectBrilliantHomeProps) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const ru = lang === 'ru'
  const realUserId = useAppStore((s) => s.user?.id)

  const topics = useQuestionsStore((s) => s.topics)
  const storedSubjectId = useQuestionsStore((s) => s.subjectId)
  const loadTopics = useQuestionsStore((s) => s.loadTopics)
  const loadQuestions = useQuestionsStore((s) => s.load)

  const [loadingTopics, setLoadingTopics] = useState(false)
  const [solvedByTopic, setSolvedByTopic] = useState<Record<number, number>>({})

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
  }, [realUserId, subjectId])

  const subjectTopics = useMemo(
    () => (storedSubjectId === subjectId ? topics : []),
    [storedSubjectId, subjectId, topics],
  )

  const topicMap = useMemo(() => {
    const map = new Map<number, DbTopic>()
    for (const t of subjectTopics) map.set(t.id, t)
    return map
  }, [subjectTopics])

  const { levels, completedCount, defaultLevelIndex } = useMemo(() => {
    if (subjectTopics.length === 0) {
      return { levels: [] as BrilliantCourseLevel[], completedCount: 0, defaultLevelIndex: 0 }
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
    const builtLevels: BrilliantCourseLevel[] = buckets.map((bucket, idx) => {
      const levelNumber = idx + 1
      let markedCurrent = false
      const items = bucket.topics.map((topic) => {
        const qCount = topic.questionCount ?? 0
        const solved = solvedByTopic[topic.id] ?? 0
        const done = qCount > 0 && solved >= qCount
        if (done) doneTotal += 1
        const current = !done && !markedCurrent
        if (current) markedCurrent = true
        return {
          key: topic.id,
          title: ru ? (topic.nameRu || topic.nameUz) : (topic.nameUz || topic.nameRu),
          done,
          current,
        }
      })

      return {
        id: levelNumber,
        titleUz: bucket.titleUz,
        titleRu: bucket.titleRu,
        levelLabelUz: `BOB ${levelNumber}`,
        levelLabelRu: `БЛОК ${levelNumber}`,
        items,
      }
    })

    const firstIncompleteLevel = builtLevels.findIndex((lvl) => lvl.items.some((item) => !item.done))
    return {
      levels: builtLevels,
      completedCount: doneTotal,
      defaultLevelIndex: firstIncompleteLevel >= 0 ? firstIncompleteLevel : Math.max(0, builtLevels.length - 1),
    }
  }, [subjectTopics, subjectId, solvedByTopic, ru])

  const handleLaunchLevel = async (_level: BrilliantCourseLevel, activeItem?: { key: string | number }) => {
    const topicId = Number(activeItem?.key)
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

  return (
    <BrilliantCourseHome
      subjectId={subjectId}
      levels={levels}
      completedCount={completedCount}
      loading={loadingTopics && levels.length === 0}
      defaultLevelIndex={defaultLevelIndex}
      onLaunchLevel={handleLaunchLevel}
      testId={`subject-brilliant-home-${subjectId}`}
      emptyFallback={
        loadingTopics ? undefined : (
          <div className="text-center max-w-xs space-y-4">
            <h2 className="text-lg font-extrabold text-pfg">
              {ru ? (subjectMeta?.nameRu ?? subjectId) : (subjectMeta?.name ?? subjectId)}
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
