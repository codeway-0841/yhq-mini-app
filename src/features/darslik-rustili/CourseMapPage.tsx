import { useMemo } from 'react'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import { darslikTopicId } from '../../../shared/darslik-mastery'
import { DARSLIK_BLOCKS, DARSLIK_PROGRESS_MODULE_OFFSET, getBlockOutline, getDarslikBlock } from '../../content/darslik-rustili'
import { useT } from '../../shared/i18n'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { BrilliantCourseMap, type CourseBlockMeta } from '../lessons'
import { BlockReader } from './BlockReader'
import TopicCheck from './TopicCheck'
import { lockedSectionsInBlock } from './progress'
import { useDarslikMastery } from './useDarslikMastery'

const EMPTY_SECTIONS: number[] = []
const EMPTY_READ: Record<number, number[]> = {}

/**
 * Rus tili darsligi xarita adapteri:
 * Umumiy `BrilliantCourseMap` engine'iga rus tili bloklari (`DARSLIK_BLOCKS`),
 * server mastery (`useDarslikMastery`), `BlockReader` va `TopicCheck` ulaydi.
 */
export default function CourseMapPage({
  initialBlockId,
  initialSectionIdx,
  onBackHome,
}: {
  initialBlockId?: number
  initialSectionIdx?: number
  onBackHome?: () => void
} = {}) {
  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const readByUser = useLessonsStore((s) => s.readByUser)
  const markRead = useLessonsStore((s) => s.markRead)
  const mastery = useDarslikMastery()
  const tt = useT(lang)
  const readMap = readByUser[userId] ?? EMPTY_READ

  const blocks = useMemo<CourseBlockMeta[]>(() => DARSLIK_BLOCKS.map((block) => ({
    id: block.id,
    titleUz: block.titleUz,
    titleRu: block.titleRu,
    icon: block.icon,
    sections: getBlockOutline(block.id).map((title, idx) => ({ key: idx, title })),
  })), [])

  return (
    <BrilliantCourseMap
      subjectId={RUSSIAN_SUBJECT_ID}
      blocks={blocks}
      progress={{
        passed: mastery.passed,
        lockSequential: true,
        loading: mastery.loading,
        error: mastery.error,
        refresh: mastery.refresh,
      }}
      courseTitle={tt('rusDarslikTitle')}
      courseSubtitle={tt('rusDarslikSubtitle')}
      sectionCountLabel={tt('rusDarslikSection')}
      unitLabelUz="BOB"
      unitLabelRu="БЛОК"
      initialBlockId={initialBlockId}
      initialSectionIdx={initialSectionIdx}
      onBackHome={onBackHome}
      includeUnitCheck
      supportsPractice
      trackEventPrefix="rus_darslik_map"
      dataCourse="russian-map"
      renderOverlay={(ctx) => {
        const meta = getDarslikBlock(ctx.block.id)
        if (!meta) return null

        if (ctx.practiceMode) {
          return (
            <TopicCheck
              key={`${ctx.block.id}:${ctx.sectionIdx}`}
              topicId={darslikTopicId(ctx.block.id, ctx.sectionIdx)}
              title={ctx.section.title}
              onReady={ctx.onPracticeReady}
              onClose={ctx.close}
              onPassed={() => {
                markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + ctx.block.id, ctx.sectionIdx)
                mastery.markPassed(darslikTopicId(ctx.block.id, ctx.sectionIdx))
              }}
              hasNext={false}
            />
          )
        }

        const sections = ctx.block.sections
        const doneSections = sections
          .map((_, idx) => idx)
          .filter((idx) => mastery.passed.has(darslikTopicId(ctx.block.id, idx)))
        const lockedSections = lockedSectionsInBlock(ctx.block.id, mastery.passed)

        return (
          <BlockReader
            block={meta}
            sectionIndex={ctx.sectionIdx}
            doneSections={doneSections}
            readSections={readMap[DARSLIK_PROGRESS_MODULE_OFFSET + ctx.block.id] ?? EMPTY_SECTIONS}
            lockedSections={lockedSections}
            initialQuizOpen={ctx.quiz}
            onClose={ctx.close}
            onSelectSection={ctx.selectSection}
            onMarkRead={(idx) => markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + ctx.block.id, idx)}
            onQuizPass={(idx) => {
              markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + ctx.block.id, idx)
              mastery.markPassed(darslikTopicId(ctx.block.id, idx))
            }}
            onNextTopic={ctx.nextTopic}
            onLockedSection={mastery.refresh}
          />
        )
      }}
    />
  )
}
