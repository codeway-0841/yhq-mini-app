import type { ReactNode } from 'react'

export interface CourseSectionItem {
  /** Adapter-owned unique key (e.g. section index, topic id, etc.) */
  key: string | number
  /** Section / topic display title */
  title: string
}

export interface CourseBlockMeta {
  /** 1-based numeric block/unit/era id */
  id: number
  titleUz: string
  titleRu: string
  icon?: string
  sections: readonly CourseSectionItem[]
}

export interface CourseProgressState {
  /** Keys formatted as `${blockId}:${idx}` */
  passed: ReadonlySet<string>
  /** Keys formatted as `${blockId}:${idx}` */
  read?: ReadonlySet<string>
  /** Whether sections lock sequentially across blocks */
  lockSequential: boolean
  loading: boolean
  error: boolean
  refresh: () => void
}

export interface CourseSectionLaunchContext {
  block: CourseBlockMeta
  sectionIdx: number
  section: CourseSectionItem
  quiz: boolean
  practiceMode: boolean
  close: () => void
  nextTopic: () => void
  selectSection: (idx: number) => void
  onPracticeReady: () => void
}

export interface BrilliantCourseMapProps {
  /** Subject identifier for tracking/analytics & visual attribution */
  subjectId: string
  /** Canonical blocks & sections for this subject */
  blocks: readonly CourseBlockMeta[]
  /** Progress state (server/local mastery) */
  progress: CourseProgressState
  /** Main map hero title when viewing all blocks */
  courseTitle: string
  /** Main map hero subtitle when viewing all blocks */
  courseSubtitle: string
  /** Singular/plural label for node count (`mavzu`, `раздел`, etc.) */
  sectionCountLabel: string
  /** Label prefix for units (`BOB` / `БЛОК` or `DAVR` / `ЭПОХА`) */
  unitLabelUz?: string
  unitLabelRu?: string
  /** Initial focused block (`?block=`) */
  initialBlockId?: number
  /** Initial focused section (`?section=`) */
  initialSectionIdx?: number
  /** Navigate back to course home */
  onBackHome?: () => void
  /** Append a final unit-check node per block (default true for rustili, false for topic-bank / reader) */
  includeUnitCheck?: boolean
  /** Whether renderOverlay implements ctx.practiceMode + ctx.onPracticeReady (TopicCheck warm-up) */
  supportsPractice?: boolean
  /** Optional custom overlay renderer (e.g. BlockReader / TopicCheck for rustili, Markdown Era Reader for rusadabiyot) */
  renderOverlay?: (ctx: CourseSectionLaunchContext) => ReactNode
  /** Direct callback for quiz-only / direct-route sections (e.g. fizika/matematika launching /test/1) */
  onOpenSection?: (ctx: { block: CourseBlockMeta; sectionIdx: number; section: CourseSectionItem; quiz: boolean; practiceMode: boolean }) => void
  /** Analytics prefix for node picks & launches */
  trackEventPrefix?: string
  /** `data-course` attribute on `.cmap` root */
  dataCourse?: string
}
