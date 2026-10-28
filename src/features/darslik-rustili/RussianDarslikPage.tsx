import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown, ChevronDown, ChevronUp, Map as MapIcon,
} from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import { PageHeader } from '../../shared/components/ui/page-header'
import { goBack } from '../../shared/lib/navigation'
import { track } from '../../shared/lib/analytics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useDailyStore } from '../../shared/store/useDailyStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import {
  DARSLIK_BLOCKS,
  DARSLIK_BLOCK_STATS,
  DARSLIK_PROGRESS_MODULE_OFFSET,
  DARSLIK_SECTION_COUNT,
  getBlockOutline,
  getDarslikBlock,
} from '../../content/darslik-rustili'
import { LearningPath, LessonPreview, type PathSelection } from '../lessons'
import { BlockReader } from './BlockReader'
import {
  lockedSectionsInBlock,
  nextSection,
  previousSection,
  sectionKey,
} from './progress'
import { darslikTopicId } from '../../../shared/darslik-mastery'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import { useDarslikMastery } from './useDarslikMastery'

const EMPTY_PROGRESS: Record<number, number[]> = {}
const EMPTY_SECTIONS: number[] = []

/**
 * Rus tili darsligi — 15 blok, har bir blok mavzulari **learning path**
 * ko'rinishida (YHQ darsligi bilan bir xil UI). Tugun = blok ichidagi mavzu.
 *
 * O'tilgan mavzular serverda (`darslik_mastery`) saqlanadi; lokal
 * `useLessonsStore` faqat o'qilgan mavzular va offline cache uchun.
 */
export default function RussianDarslikPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const xp = useAppStore((s) => s.xp) ?? 0
  const streak = useDailyStore((s) => s.streaks[RUSSIAN_SUBJECT_ID] ?? 0)
  const readByUser = useLessonsStore((s) => s.readByUser)
  const markRead = useLessonsStore((s) => s.markRead)
  const mastery = useDarslikMastery()
  const passed = mastery.passed
  const tt = useT(lang)
  const isRu = lang === 'ru'

  const [selected, setSelected] = useState<PathSelection | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [jumpDirection, setJumpDirection] = useState<'up' | 'down'>('down')
  const [reader, setReader] = useState<{ blockId: number; sectionIdx: number; quiz?: boolean } | null>(null)
  const [expandedBlockId, setExpandedBlockId] = useState(DARSLIK_BLOCKS[0].id)

  const rootRef = useRef<HTMLDivElement>(null)
  const selectedTrigger = useRef<HTMLButtonElement | null>(null)
  const moduleRefs = useRef(new Map<number, HTMLElement>())
  const syncedPathWindow = useRef('')

  const readMap = readByUser[userId] ?? EMPTY_PROGRESS
  const doneFor = useCallback(
    (blockId: number) => getBlockOutline(blockId)
      .map((_, idx) => idx)
      .filter((idx) => passed.has(sectionKey(blockId, idx))),
    [passed],
  )
  const readFor = useCallback(
    (blockId: number) => readMap[DARSLIK_PROGRESS_MODULE_OFFSET + blockId] ?? EMPTY_SECTIONS,
    [readMap],
  )
  const lockedByBlock = useMemo(() => {
    const map: Record<number, number[]> = {}
    for (const block of DARSLIK_BLOCKS) map[block.id] = lockedSectionsInBlock(block.id, passed)
    return map
  }, [passed])
  const lockedFor = useCallback(
    (blockId: number) => lockedByBlock[blockId] ?? EMPTY_SECTIONS,
    [lockedByBlock],
  )

  const currentBlock = useMemo(
    () => DARSLIK_BLOCKS.find((block) => doneFor(block.id).length < getBlockOutline(block.id).length)
      ?? DARSLIK_BLOCKS[DARSLIK_BLOCKS.length - 1],
    [doneFor],
  )
  const currentSectionIdx = useMemo(() => {
    const done = doneFor(currentBlock.id)
    const idx = getBlockOutline(currentBlock.id).findIndex((_, i) => !done.includes(i))
    return idx < 0 ? 0 : idx
  }, [currentBlock.id, doneFor])

  const totalPassedCount = passed.size
  const overallCoursePct = Math.min(100, Math.round((totalPassedCount / Math.max(1, DARSLIK_SECTION_COUNT)) * 100))

  // Faqat bitta blok yo'lini ochiq tutamiz; progress o'zgarsa joriy blokka o'tadi.
  useEffect(() => {
    if (mastery.loading) return
    if (syncedPathWindow.current === 'manual') return
    const key = String(currentBlock.id)
    if (syncedPathWindow.current === key) return
    syncedPathWindow.current = key
    setExpandedBlockId(currentBlock.id)
  }, [currentBlock.id, mastery.loading])

  // Sticky modul banner'i header ostida qolishi uchun balandlikni o'lchaymiz.
  useEffect(() => {
    const header = rootRef.current?.querySelector<HTMLElement>('.page-header')
    if (!header) return
    const measure = () => rootRef.current?.style.setProperty('--lesson-header-height', `${header.getBoundingClientRect().height}px`)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const selectPathNode = useCallback((selection: PathSelection, trigger: HTMLButtonElement) => {
    selectedTrigger.current = trigger
    const current = rootRef.current?.querySelector('[aria-current="step"]')
    if (current) setJumpDirection(current.getBoundingClientRect().top > trigger.getBoundingClientRect().top ? 'down' : 'up')
    setSelected((previous) => previous?.moduleId === selection.moduleId && previous.idx === selection.idx
      ? previous
      : selection)
  }, [])

  const scrolledToCurrent = useRef(false)
  useEffect(() => {
    if (mastery.loading) return
    if (scrolledToCurrent.current) return
    scrolledToCurrent.current = true
    if (currentBlock.id === DARSLIK_BLOCKS[0].id) return
    const section = moduleRefs.current.get(currentBlock.id)
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
  }, [currentBlock.id, mastery.loading])

  const jumpToCurrent = () => {
    const section = moduleRefs.current.get(currentBlock.id)
    if (!section) return
    setExpandedBlockId(currentBlock.id)
    const node = section.querySelector<HTMLButtonElement>('[aria-current="step"]')
    setCollapsed(false)
    if (node) {
      selectPathNode({ moduleId: currentBlock.id, idx: Number(node.dataset.lesson), check: false }, node)
      if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      node.focus({ preventScroll: true })
      return
    }
    setSelected({ moduleId: currentBlock.id, idx: currentSectionIdx, check: false })
    if (typeof section.scrollIntoView === 'function') section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openSection = useCallback((blockId: number, sectionIdx: number, quiz = false) => {
    if (lockedFor(blockId).includes(sectionIdx)) return
    track('rus_darslik_open_topic', { block_id: blockId, section_idx: sectionIdx, quiz })
    setReader({ blockId, sectionIdx, quiz })
  }, [lockedFor])

  const closeReader = useCallback(() => {
    setReader(null)
    selectedTrigger.current?.focus({ preventScroll: true })
  }, [])

  const markTopicRead = useCallback((blockId: number, idx: number) => {
    track('rus_darslik_topic_read', { block_id: blockId, section_idx: idx })
    markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + blockId, idx)
  }, [markRead, userId])

  const passTopicQuiz = useCallback((blockId: number, idx: number) => {
    const topicId = darslikTopicId(blockId, idx)
    track('rus_darslik_check_pass', { topic_id: topicId })
    markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + blockId, idx)
    syncedPathWindow.current = ''
    mastery.markPassed(topicId)
  }, [markRead, mastery, userId])

  const advanceReader = useCallback(() => {
    if (!reader) return
    const next = nextSection(reader.blockId, reader.sectionIdx)
    if (!next) {
      closeReader()
      return
    }
    setReader({ blockId: next.blockId, sectionIdx: next.idx, quiz: false })
    setSelected({ moduleId: next.blockId, idx: next.idx, check: false })
    setCollapsed(false)
  }, [reader, closeReader])

  const selectedTitle = selected ? getBlockOutline(selected.moduleId)[selected.idx] ?? '' : ''
  const isSelectedCurrent = !!selected
    && selected.moduleId === currentBlock.id
    && selected.idx === currentSectionIdx
  const selectedDone = selected ? doneFor(selected.moduleId).includes(selected.idx) : false
  const selectedLocked = selected ? lockedFor(selected.moduleId).includes(selected.idx) : false
  const selectedPending = selected ? !selectedDone && !selectedLocked && readFor(selected.moduleId).includes(selected.idx) : false
  const selectedPrevious = selected ? previousSection(selected.moduleId, selected.idx) : null
  const selectedLockedHint = selectedLocked && selectedPrevious
    ? tt('rusDarslikQuizLockedHint').replace(
      '{title}',
      getBlockOutline(selectedPrevious.blockId)[selectedPrevious.idx] ?? '',
    )
    : undefined
  const activeBlock = reader ? getDarslikBlock(reader.blockId) : undefined

  return (
    <div
      ref={rootRef}
      className="lesson-course px-4 pb-4 lg:px-8 lg:pb-8 lg:max-w-4xl lg:mx-auto lg:w-full"
      data-course="russian"
      data-preview-open={!!selected && !collapsed}
      data-has-selection={!!selected}
    >
      <PageHeader
        className="-mx-4 mb-2 lg:hidden"
        title={tt('rusDarslikTitle')}
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        actions={(
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/darslik/xarita')}
              aria-label={lang === 'ru' ? 'Карта курса' : 'Kurs xaritasi'}
              title={lang === 'ru' ? 'Карта курса' : 'Kurs xaritasi'}
              className="grid size-8 cursor-pointer place-items-center rounded-xl bg-psurface text-pmuted active:scale-95"
            >
              <MapIcon size={16} />
            </button>
            {streak > 0 && (
              <span className="flex items-center rounded-xl bg-[rgb(var(--p-warning-rgb)/0.14)] px-2 py-1 text-[11px] font-extrabold tabular-nums text-pwarning">
                {streak}d
              </span>
            )}
            {xp > 0 && (
              <span className="flex items-center rounded-xl bg-[rgb(var(--p-primary-rgb)/0.12)] px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-pprimary">
                {xp} XP
              </span>
            )}
          </div>
        )}
      />

      {/* Desktop sarlavha kartasi */}
      <div className="lesson-course-header hidden lg:flex">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-pfg">{tt('rusDarslikTitle')}</h2>
            <p className="mt-1 text-xs font-medium text-pmuted">{isRu ? currentBlock.titleRu : currentBlock.titleUz}</p>
            <div className="mt-2 flex items-center gap-3 text-xs font-medium text-pmuted">
              <span className="font-semibold tabular-nums text-pfg">
                {doneFor(currentBlock.id).length}/{getBlockOutline(currentBlock.id).length} {tt('rusDarslikSection')}
              </span>
              <span className="h-1 w-1 rounded-full bg-plineStrong" />
              <span className="tabular-nums">
                {totalPassedCount}/{DARSLIK_SECTION_COUNT} ({overallCoursePct}%)
              </span>
              <span className="h-1 w-1 rounded-full bg-plineStrong" />
              <button
                type="button"
                onClick={jumpToCurrent}
                className="flex cursor-pointer items-center gap-1 font-semibold text-pprimary transition-colors hover:opacity-80"
              >
                <ArrowDown size={14} />
                {tt('pathJump')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mastery.error && (
        <div
          role="status"
          className="mx-auto mb-3 flex max-w-[440px] items-center justify-between gap-3 rounded-2xl bg-[rgb(var(--p-warning-rgb)/0.12)] px-3.5 py-2.5 text-[12px] font-medium leading-snug text-pfg lg:max-w-none"
        >
          <span>{tt('rusDarslikProgressError')}</span>
          <button
            type="button"
            onClick={mastery.refresh}
            className="shrink-0 cursor-pointer rounded-lg bg-psurface px-2.5 py-1.5 text-[11.5px] font-semibold text-pfg active:scale-95"
          >
            {tt('rusDarslikRetry')}
          </button>
        </div>
      )}

      {DARSLIK_BLOCKS.map((block) => {
        const outline = getBlockOutline(block.id)
        const done = doneFor(block.id)
        const complete = done.length >= outline.length
        const title = isRu ? block.titleRu : block.titleUz
        const state = complete ? 'done' : block.id === currentBlock.id ? 'current' : 'upcoming'
        const expanded = expandedBlockId === block.id
        const toggleBlock = () => {
          syncedPathWindow.current = 'manual'
          setExpandedBlockId((previous) => previous === block.id ? 0 : block.id)
          setSelected(null)
          setCollapsed(false)
        }
        return (
          <section
            key={block.id}
            id={`rus-block-${block.id}`}
            aria-labelledby={`rus-block-title-${block.id}`}
            ref={(node) => { if (node) moduleRefs.current.set(block.id, node); else moduleRefs.current.delete(block.id) }}
            className="lesson-module-section mx-auto w-full max-w-[440px] lg:max-w-none"
            data-module-state={state}
            data-expanded={expanded ? 'true' : 'false'}
            style={{
              scrollMarginTop: 'calc(var(--lesson-header-height, 61px) + 8px)',
            } as CSSProperties}
          >
            <div className={expanded ? 'lesson-module-sticky' : undefined}>
              <div className="lesson-module-banner rounded-2xl">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="rounded-md bg-[rgb(var(--p-primary-rgb)/0.14)] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-pprimary">
                      {tt('rusDarslikUnitBadge').replace('{unit}', String(block.id))}
                    </span>
                    <span className="text-[10.5px] font-semibold text-pmuted">
                      ~{DARSLIK_BLOCK_STATS[block.id].minutes}{isRu ? ' мин' : ' daq'}
                    </span>
                  </div>
                  <h2
                    id={`rus-block-title-${block.id}`}
                    tabIndex={-1}
                    className="font-display text-[15px] font-extrabold leading-snug text-pfg focus-visible:outline-none lg:text-[17px]"
                  >
                    <button type="button" onClick={toggleBlock} className="w-full cursor-pointer text-left">
                      {block.id}. {title}
                    </button>
                  </h2>
                  <p className="mt-0.5 hidden text-[12px] font-semibold text-pmuted lg:block">
                    {done.length}/{outline.length} {tt('rusDarslikSection')}
                    {complete ? ` • ${tt('pathDone')}` : ''}
                  </p>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${title} — ${tt('pathProgress')}`}
                  aria-valuenow={done.length}
                  aria-valuemin={0}
                  aria-valuemax={outline.length}
                  className="lesson-module-progress lg:hidden"
                  style={{ '--module-progress': `${outline.length ? (done.length / outline.length) * 100 : 0}%` } as CSSProperties}
                >
                  <span>{done.length}/{outline.length}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleBlock}
                  aria-expanded={expanded}
                  aria-controls={`rus-block-path-${block.id}`}
                  aria-label={expanded ? tt('rusDarslikHideUnit') : tt('rusDarslikShowUnit')}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl bg-psurface text-pmuted shadow-2xs transition-transform active:scale-95"
                >
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>
            {expanded && (
              <div id={`rus-block-path-${block.id}`}>
                <LearningPath
                  moduleId={block.id}
                  nodes={outline}
                  nodeLabel={tt('rusDarslikSection')}
                  doneList={done}
                  readList={readFor(block.id)}
                  lockedList={lockedFor(block.id)}
                  lang={lang}
                  selected={selected}
                  activeModuleId={currentBlock.id}
                  onSelect={(selection, trigger) => { selectPathNode(selection, trigger); setCollapsed(false) }}
                />
              </div>
            )}
          </section>
        )
      })}

      {currentBlock && !selected && (
        <div className="pointer-events-none fixed bottom-[calc(2rem+var(--safe-bottom,0px))] left-0 right-0 z-20 flex justify-center lg:hidden">
          <Button className="pointer-events-auto rounded-full bg-pprimary text-ponprimary shadow-[0_4px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)]" onClick={jumpToCurrent}>
            <ArrowDown size={17} />
            {tt('pathJump')}
          </Button>
        </div>
      )}

      {selected && !reader && (
        <LessonPreview
          title={selectedTitle}
          selectionKey={`${selected.moduleId}:${selected.idx}`}
          check={false}
          current={isSelectedCurrent}
          done={selectedDone}
          premiumRequired={false}
          lang={lang}
          collapsed={collapsed}
          locked={selectedLocked}
          lockedHint={selectedLockedHint}
          quizPending={selectedPending}
          onJump={currentBlock ? jumpToCurrent : undefined}
          jumpDirection={jumpDirection}
          onClose={() => { setCollapsed(true); selectedTrigger.current?.focus({ preventScroll: true }) }}
          onStart={() => openSection(selected.moduleId, selected.idx)}
          onQuiz={() => openSection(selected.moduleId, selected.idx, true)}
          onPractice={() => {}}
          eyebrow={tt('rusDarslikMicroLesson').replace('{unit}', String(selected.moduleId))}
          description={tt('rusDarslikPreviewDescription')}
          duration={tt('rusDarslikPreviewDuration')}
          reward={tt('rusDarslikPreviewReward')}
        />
      )}

      {reader && activeBlock && (
        <BlockReader
          block={activeBlock}
          sectionIndex={reader.sectionIdx}
          doneSections={doneFor(reader.blockId)}
          readSections={readFor(reader.blockId)}
          lockedSections={lockedFor(reader.blockId)}
          initialQuizOpen={reader.quiz}
          onClose={closeReader}
          onSelectSection={(idx) => {
            if (lockedFor(reader.blockId).includes(idx)) return
            const outline = getBlockOutline(reader.blockId)
            const sectionIdx = Math.max(0, Math.min(idx, outline.length - 1))
            setReader({ blockId: reader.blockId, sectionIdx, quiz: false })
            setSelected({ moduleId: reader.blockId, idx: sectionIdx, check: false })
            setCollapsed(false)
          }}
          onMarkRead={(idx) => markTopicRead(reader.blockId, idx)}
          onQuizPass={(idx) => passTopicQuiz(reader.blockId, idx)}
          onNextTopic={advanceReader}
          onLockedSection={mastery.refresh}
        />
      )}
    </div>
  )
}
