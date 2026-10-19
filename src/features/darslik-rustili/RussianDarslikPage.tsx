import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, BookOpen, ChevronLeft, GraduationCap } from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
import { goBack } from '../../shared/lib/navigation'
import { track } from '../../shared/lib/analytics'
import { useAppStore } from '../../shared/store/useAppStore'
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
import { LazyPath } from './LazyPath'
import {
  lockedSectionsInBlock,
  nextSection,
  previousSection,
  sectionKey,
} from './progress'
import { darslikTopicId } from '../../../shared/darslik-mastery'
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

  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const selectedTrigger = useRef<HTMLButtonElement | null>(null)
  const moduleRefs = useRef(new Map<number, HTMLElement>())

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

  const totalDone = useMemo(
    () => DARSLIK_BLOCKS.reduce((sum, block) => sum + doneFor(block.id).length, 0),
    [doneFor],
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

  // Sticky modul banner'i header ostida qolishi uchun balandlikni o'lchaymiz.
  useEffect(() => {
    const header = headerRef.current
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

  // Dock faqat foydalanuvchi tugunni bosganda chiqadi: yo'l qismlarga bo'lib
  // mount bo'lgani uchun scroll'ni "kuzatib borish" ishonchli emas.
  //
  // Qayta ochilganda joriy blokga suriladi — 537 mavzuli yo'lni tepadan
  // boshlash noqulay (YHQ'dagi `resetPathScroll` bilan bir xil maqsad).
  const scrolledToCurrent = useRef(false)
  useEffect(() => {
    // Server progressi kelguncha kutamiz: aks holda qaytgan foydalanuvchi
    // har doim 1-blokdan boshlab ko'radi.
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
    const node = section.querySelector<HTMLButtonElement>('[aria-current="step"]')
    setCollapsed(false)
    if (node) {
      selectPathNode({ moduleId: currentBlock.id, idx: Number(node.dataset.lesson), check: false }, node)
      if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      node.focus({ preventScroll: true })
      return
    }
    // Path hali mount bo'lmagan bo'lsa — modul sarlavhasiga suriladi.
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
      data-preview-open={!!selected && !collapsed}
      data-has-selection={!!selected}
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 page-header flex items-center justify-between mb-4 lg:hidden"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => goBack(navigate)}
            aria-label={tt('backWord')}
            className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border border-black/[0.04] bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-150 ease-out active:scale-95 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-none"
          >
            <ChevronLeft size={22} strokeWidth={2.25} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[19px] font-bold leading-tight tracking-tight text-pfg">
              {tt('rusDarslikTitle')}
            </h1>
            <p className="truncate text-[11px] font-medium text-pmuted">{tt('rusDarslikSubtitle')}</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-psurface px-2.5 py-1 text-[12px] font-semibold tabular-nums text-pmuted shadow-2xs">
          <GraduationCap size={13} strokeWidth={1.75} className="text-psubtle" />
          {totalDone}/{DARSLIK_SECTION_COUNT}
        </span>
      </header>

      {/* Desktop sarlavha kartasi (YHQ darsligi bilan bir xil ko'rinish) */}
      <div className="lesson-course-header hidden lg:flex">
        <div className="flex items-center gap-4">
          <div className="grid size-14 flex-none place-items-center rounded-2xl bg-[rgb(var(--p-primary-rgb)/0.12)] text-pprimary">
            <GraduationCap size={28} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-pfg">{tt('rusDarslikTitle')}</h2>
            <p className="mt-1 text-xs font-medium text-pmuted">{tt('rusDarslikSubtitle')}</p>
            <div className="mt-2 flex items-center gap-3 text-xs font-medium text-pmuted">
              <span className="flex items-center gap-1.5 font-semibold text-pfg">
                <BookOpen size={14} className="text-pprimary" />
                {totalDone}/{DARSLIK_SECTION_COUNT} {tt('rusDarslikSection')}
              </span>
              <span className="h-1 w-1 rounded-full bg-plineStrong" />
              <button
                type="button"
                onClick={jumpToCurrent}
                className="flex cursor-pointer items-center gap-1 transition-colors hover:text-pprimary"
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
        return (
          <section
            key={block.id}
            id={`rus-block-${block.id}`}
            aria-labelledby={`rus-block-title-${block.id}`}
            ref={(node) => { if (node) moduleRefs.current.set(block.id, node); else moduleRefs.current.delete(block.id) }}
            className="lesson-module-section mx-auto w-full max-w-[440px] lg:max-w-none"
            data-module-state={state}
            style={{
              '--module-color': 'var(--p-primary)',
              scrollMarginTop: 'calc(var(--lesson-header-height, 61px) + 8px)',
            } as CSSProperties}
          >
            <div className="lesson-module-sticky">
              <div className="lesson-module-banner rounded-2xl">
                <span className="lesson-module-icon text-[17px]" aria-hidden="true">{block.icon}</span>
                <div className="min-w-0 flex-1">
                  <h2
                    id={`rus-block-title-${block.id}`}
                    tabIndex={-1}
                    className="font-display text-[16px] font-bold leading-tight text-pfg focus-visible:outline-none lg:text-[17px]"
                  >
                    {block.id}. {title}
                  </h2>
                  <p className="mt-0.5 text-[10px] font-medium text-pmuted lg:text-[13px]">
                    {done.length}/{outline.length} {tt('rusDarslikSection')}
                    {' · ~'}
                    {DARSLIK_BLOCK_STATS[block.id].minutes}
                    {isRu ? ' мин' : ' daq'}
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
              </div>
            </div>
            {state === 'current' && (
              <p className="mx-auto mb-1 mt-2 max-w-[440px] px-4 text-[11.5px] leading-snug text-pmuted lg:max-w-none lg:px-2">
                {isRu ? block.summaryRu : block.summaryUz}
              </p>
            )}
            <LazyPath rows={outline.length}>
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
            </LazyPath>
          </section>
        )
      })}

      {currentBlock && !selected && (
        <div className="pointer-events-none fixed bottom-[calc(2rem+var(--safe-bottom,0px))] left-0 right-0 z-20 flex justify-center lg:hidden">
          <Button className="pointer-events-auto rounded-full bg-psuccess text-white shadow-lg" onClick={jumpToCurrent}>
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
