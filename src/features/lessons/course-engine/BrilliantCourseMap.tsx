import {
  useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../../shared/lib/navigation'
import { addPageScrollListener, getPageScroller, pageScrollY, scrollPageToTop } from '../../../shared/lib/page-scroll'
import { track } from '../../../shared/lib/analytics'
import { useAppStore } from '../../../shared/store/useAppStore'
import {
  isSubjectExtendedOnDate,
  selectDailyStreak,
  todayStr,
  useDailyStore,
} from '../../../shared/store/useDailyStore'
import { BrilliantStreakIcon } from '../../../shared/components/BrilliantStreakIcon'
import { useT } from '../../../shared/i18n'
import { playSound } from '../../../shared/lib/sounds'
import { BrilliantKeyIcon } from '../DarslikTopPills'
import { BrilliantHeroIllustration, getBrilliantTheme } from '../BrilliantLevelsCarousel'
import LessonLaunch, { lessonLaunchOrigin, type LaunchOrigin } from '../LessonLaunch'
import { preloadBrilliantTransitionAssets, resolveBrilliantRiveColor, startLessonTransition } from '../lesson-transition'
import { CourseMapNodeArt } from './CourseMapNodeArt'
import PracticeWarmUpLaunch from './PracticeWarmUpLaunch'
import { courseSectionKey, getLockedSectionIndices, getNextCourseSection } from './course-progress'
import type { BrilliantCourseMapProps, CourseBlockMeta, CourseSectionItem } from './types'
import './course-map.css'

/** Bo'sh joy bo'ylab 50% → 0% → 50% → 100% egri yo'l. */
const HALF_WAVE = 'calc(var(--cmap-wave-space) / 2)'
const WAVE_OFFSETS = [HALF_WAVE, '0px', HALF_WAVE, 'var(--cmap-wave-space)']

const NODE_ART = {
  puck: '/darslik-map/node-puck.svg',
  check: '/darslik-map/node-check.svg',
  completed: '/darslik-map/node-completed.svg',
  active: '/darslik-map/node-active-base.png',
}

const keyOf = (blockId: number, idx: number) => `${blockId}:${idx}`

const isAllCapsTitle = (title: string) =>
  title.length > 0 && title === title.toUpperCase() && title !== title.toLowerCase()

/**
 * Brilliant 1:1 umumiy kurs xaritasi dvigateli (barcha fanlar uchun SSOT):
 * - Har bir bob/davr yopishqoq pill (.cmap-pill)
 * - Egri yo'l bo'ylab Rive tugunlar (CourseMapNodeArt)
 * - Scroll bilan ergashuvchi pastki harakat kartasi (.cmap-sheet)
 * - Fan kontenti esa adapter (blocks + progress + renderOverlay/onOpenSection) orqali kiradi.
 */
export function BrilliantCourseMap({
  subjectId,
  blocks,
  progress,
  courseTitle,
  courseSubtitle,
  sectionCountLabel,
  unitLabelUz = 'BOB',
  unitLabelRu = 'БЛОК',
  initialBlockId,
  initialSectionIdx,
  onBackHome,
  includeUnitCheck = true,
  supportsPractice = false,
  renderOverlay,
  onOpenSection,
  trackEventPrefix = 'darslik_map',
  dataCourse,
}: BrilliantCourseMapProps) {
  const sheenWideId = useId()
  const sheenNarrowId = useId()
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const noAnimation = useAppStore((s) => s.settings.noAnimation)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const streak = useDailyStore((s) => selectDailyStreak(s, subjectId))
  const globalExtendedDate = useDailyStore((s) => s.globalExtendedDate)
  const activityKey = useDailyStore((s) => s.activityKey)
  const extendedDates = useDailyStore((s) => s.extendedDates)
  const isExtendedToday = isSubjectExtendedOnDate(
    { globalExtendedDate, activityKey, extendedDates },
    todayStr(),
    subjectId,
  )
  const tt = useT(lang)
  const isRu = lang === 'ru'
  const passed = progress.passed

  const [picked, setPicked] = useState<{ blockId: number; idx: number } | null>(null)
  const [focus, setFocus] = useState<{ blockId: number; idx: number } | null>(null)
  const [overlay, setOverlay] = useState<{ blockId: number; idx: number; quiz: boolean; practiceMode: boolean } | null>(null)
  const [launch, setLaunch] = useState<{
    origin: LaunchOrigin
    target: { block: CourseBlockMeta; sectionIdx: number; section: CourseSectionItem; quiz: boolean }
  } | null>(null)
  const [warmUpLaunch, setWarmUpLaunch] = useState<{ blockId: number; idx: number } | null>(null)
  const [pendingEntry, setPendingEntry] = useState<{ blockId: number; idx: number } | null>(null)
  const [practiceReady, setPracticeReady] = useState(false)
  const [mapResetEpoch, setMapResetEpoch] = useState(0)

  const entryTarget = pendingEntry
    ?? (launch ? { blockId: launch.target.block.id, idx: launch.target.sectionIdx } : null)
    ?? (warmUpLaunch ? { blockId: warmUpLaunch.blockId, idx: warmUpLaunch.idx } : null)
    ?? (overlay ? { blockId: overlay.blockId, idx: overlay.idx } : null)

  const [openBlocks, setOpenBlocks] = useState<Set<number>>(
    () => new Set(blocks.map((block) => block.id)),
  )
  const [scrolled, setScrolled] = useState(false)
  const [jumpDir, setJumpDir] = useState<'up' | 'down' | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const autoScrolled = useRef(false)
  const entryTimerRef = useRef<number | null>(null)

  useEffect(() => {
    preloadBrilliantTransitionAssets()
  }, [])

  useEffect(() => {
    setOpenBlocks((prev) => {
      if (blocks.length === 0) return prev
      const next = new Set(prev)
      for (const b of blocks) next.add(b.id)
      return next
    })
  }, [blocks])

  useEffect(() => () => {
    if (entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current)
      entryTimerRef.current = null
    }
  }, [])

  const doneFor = useCallback(
    (blockId: number) => {
      const target = blocks.find((b) => b.id === blockId)
      if (!target) return []
      return target.sections
        .map((_, idx) => idx)
        .filter((idx) => passed.has(courseSectionKey(blockId, idx)))
    },
    [blocks, passed],
  )

  const lockedFor = useCallback(
    (blockId: number) => getLockedSectionIndices(blocks, blockId, passed, progress.lockSequential),
    [blocks, passed, progress.lockSequential],
  )

  const fallbackBlock: CourseBlockMeta = blocks[0] ?? {
    id: 1,
    titleUz: courseTitle,
    titleRu: courseTitle,
    sections: [],
  }

  const currentBlock = useMemo(
    () => blocks.find((b) => doneFor(b.id).length < b.sections.length)
      ?? blocks[blocks.length - 1]
      ?? fallbackBlock,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, doneFor],
  )

  const currentIdx = useMemo(() => {
    const done = doneFor(currentBlock.id)
    const idx = currentBlock.sections.findIndex((_, i) => !done.includes(i))
    return idx < 0 ? 0 : idx
  }, [currentBlock, doneFor])

  const openBlock = useCallback((blockId: number) => {
    setOpenBlocks((previous) => (previous.has(blockId) ? previous : new Set(previous).add(blockId)))
  }, [])

  const toggleBlock = useCallback((blockId: number) => {
    setOpenBlocks((previous) => {
      const next = new Set(previous)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }, [])

  const fallbackIdx = initialSectionIdx !== undefined
    ? initialSectionIdx
    : (initialBlockId && initialBlockId !== currentBlock.id ? 0 : currentIdx)
  const active = picked ?? focus ?? { blockId: initialBlockId ?? currentBlock.id, idx: fallbackIdx }
  const activeBlock = blocks.find((b) => b.id === active.blockId) ?? currentBlock
  const sheetTheme = getBrilliantTheme((((active.blockId - 1) % 8) + 1))
  const mapTheme = getBrilliantTheme((((initialBlockId ?? active.blockId) - 1) % 8) + 1)
  const nodeColor = resolveBrilliantRiveColor(mapTheme.accent)
  const selectedMeta = initialBlockId ? blocks.find((b) => b.id === initialBlockId) : undefined

  const activeSections = activeBlock.sections
  const activeCheck = includeUnitCheck && active.idx === activeSections.length
  const activeTitle = activeCheck
    ? tt('rusDarslikUnitCheck')
    : activeSections[active.idx]?.title ?? ''
  const activeDone = !activeCheck && doneFor(active.blockId).includes(active.idx)
  const activeLocked = activeCheck
    ? doneFor(active.blockId).length < activeSections.length
    : lockedFor(active.blockId).includes(active.idx)
  const activeAhead = progress.lockSequential && (
    active.blockId > currentBlock.id
    || (active.blockId === currentBlock.id && active.idx > currentIdx)
  )
  const hasPractice = Boolean(supportsPractice && renderOverlay)
  const ctaLabel = activeLocked || (activeAhead && !activeCheck)
    ? tt('pathJumpAhead')
    : (activeDone && hasPractice) || activeCheck
      ? tt('rusDarslikStartPractice')
      : activeDone
        ? (renderOverlay ? tt('pathReview') : tt('rusDarslikStartPractice'))
        : tt('pathStart')

  /* Panel balandligi (sticky karta uchun) va markazi (pastdagi varaq uchun). */
  useEffect(() => {
    const root = rootRef.current
    const header = root?.querySelector<HTMLElement>('.cmap-bar')
    if (!root || !header) return
    const measure = () => {
      root.style.setProperty('--cmap-header', `${header.getBoundingClientRect().height}px`)
      const rect = root.getBoundingClientRect()
      const pill = root.querySelector<HTMLElement>('.cmap-pill')?.getBoundingClientRect()
      root.style.setProperty('--cmap-center', `${Math.round(pill ? pill.left + pill.width / 2 : rect.left + rect.width / 2)}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    observer.observe(root)
    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [blocks.length])

  /* Scroll — karta ekran tubidagi eng yaqin mavzuga ergashadi va joriy tugun ko'rinmasa sakrash tugmasini ko'rsatadi. */
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const scrollerRect = getPageScroller()?.getBoundingClientRect()
      const headerBottom = (rootRef.current?.querySelector<HTMLElement>('.cmap-bar')?.getBoundingClientRect().bottom
        ?? (scrollerRect?.top ?? 0) + 56) + 58
      const sheetHeight = sheetRef.current?.offsetHeight ?? 120
      const sheetTop = sheetRef.current?.getBoundingClientRect().top
        ?? (scrollerRect?.bottom ?? window.innerHeight) - sheetHeight - 20

      const curEl = nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
      let nextJump: 'up' | 'down' | null = null
      if (curEl) {
        const curRect = curEl.getBoundingClientRect()
        if (curRect.height > 0) {
          const curMid = curRect.top + curRect.height / 2
          if (curMid < headerBottom) nextJump = 'up'
          else if (curRect.top > sheetTop - 20) nextJump = 'down'
        } else if (pageScrollY() > 80) {
          nextJump = 'up'
        }
      } else if (blocks.length > 0 && pageScrollY() > 80) {
        nextJump = 'up'
      }
      setJumpDir((prev) => (prev === nextJump ? prev : nextJump))

      if (pageScrollY() < 80) {
        setFocus((prev) => (prev === null ? prev : null))
        return
      }
      const ceiling = (scrollerRect?.bottom ?? window.innerHeight) - sheetHeight - 144
      let best: { blockId: number; idx: number } | null = null
      for (const [key, el] of nodeRefs.current) {
        const rect = el.getBoundingClientRect()
        if (rect.top + rect.height / 2 < ceiling) {
          const [blockId, idx] = key.split(':').map(Number)
          best = { blockId, idx }
        }
      }
      const next = best as { blockId: number; idx: number } | null
      setFocus((prev) => (
        prev && next && prev.blockId === next.blockId && prev.idx === next.idx ? prev : next
      ))
    }
    const onScroll = () => {
      setScrolled(pageScrollY() > 80)
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    measure()
    const removeScroll = addPageScrollListener(onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      removeScroll()
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [openBlocks, lang, currentBlock.id, currentIdx, blocks.length])

  const jumpMap = useCallback(() => {
    setPicked(null)
    openBlock(currentBlock.id)
    window.requestAnimationFrame(() => {
      const target = nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      scrollPageToTop('smooth')
    })
  }, [openBlock, currentBlock.id, currentIdx])

  useEffect(() => {
    const clear = () => setPicked(null)
    window.addEventListener('wheel', clear, { passive: true })
    window.addEventListener('touchmove', clear, { passive: true })
    return () => {
      window.removeEventListener('wheel', clear)
      window.removeEventListener('touchmove', clear)
    }
  }, [])

  useEffect(() => {
    if (progress.loading) return
    openBlock(currentBlock.id)
  }, [progress.loading, currentBlock.id, openBlock])

  /* Birinchi ochilishda joriy/tanlangan mavzuga suriladi. */
  useEffect(() => {
    if (progress.loading || autoScrolled.current || blocks.length === 0) return
    autoScrolled.current = true
    const blockId = initialBlockId ?? currentBlock.id
    const targetBlock = blocks.find((b) => b.id === blockId) ?? currentBlock
    const blockSections = targetBlock.sections
    const firstIncomplete = blockSections.findIndex((_, idx) => !passed.has(courseSectionKey(blockId, idx)))
    const hasValidInitialSection =
      initialSectionIdx !== undefined &&
      Number.isInteger(initialSectionIdx) &&
      initialSectionIdx >= 0 &&
      initialSectionIdx < blockSections.length
    const idx = hasValidInitialSection
      ? initialSectionIdx
      : initialBlockId
        ? Math.max(0, firstIncomplete)
        : currentIdx
    if (initialBlockId || hasValidInitialSection) setPicked({ blockId, idx })
    if (!initialBlockId && !hasValidInitialSection && blockId === blocks[0].id) return
    const button = nodeRefs.current.get(keyOf(blockId, idx))
    if (button && typeof button.scrollIntoView === 'function') {
      button.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
  }, [progress.loading, blocks, currentBlock, currentIdx, initialBlockId, initialSectionIdx, passed])

  const pick = useCallback((blockId: number, idx: number) => {
    if (pendingEntry) return
    playSound('highlight-node')
    openBlock(blockId)
    setPicked({ blockId, idx })
    track(`${trackEventPrefix}_pick`, { subject_id: subjectId, block_id: blockId, section_idx: idx })
    const button = nodeRefs.current.get(keyOf(blockId, idx))
    if (button && typeof button.scrollIntoView === 'function') {
      button.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [openBlock, pendingEntry, subjectId, trackEventPrefix])

  const scheduleEntry = useCallback((blockId: number, idx: number, onReady: () => void) => {
    if (pendingEntry) return
    const reduced = noAnimation || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      onReady()
      return
    }
    const isCurrentNode = blockId === currentBlock.id && idx === currentIdx
    const delayMs = isCurrentNode ? 520 : 420
    setPendingEntry({ blockId, idx })
    entryTimerRef.current = window.setTimeout(() => {
      entryTimerRef.current = null
      setPendingEntry(null)
      onReady()
    }, delayMs)
  }, [pendingEntry, noAnimation, currentBlock.id, currentIdx])

  const openSection = useCallback((quiz = false, practiceMode = false) => {
    if (activeLocked || pendingEntry || activeSections.length === 0) return
    const safeIdx = activeCheck ? activeSections.length - 1 : Math.min(active.idx, activeSections.length - 1)
    const section = activeSections[safeIdx]
    if (!section) return

    playSound('start-lesson')
    track(
      practiceMode ? `${trackEventPrefix}_open_practice` : `${trackEventPrefix}_open_topic`,
      { subject_id: subjectId, block_id: activeBlock.id, section_idx: safeIdx, quiz: quiz || activeCheck },
    )

    if (practiceMode && renderOverlay) {
      scheduleEntry(activeBlock.id, safeIdx, () => {
        setWarmUpLaunch({ blockId: activeBlock.id, idx: safeIdx })
        setOverlay({ blockId: activeBlock.id, idx: safeIdx, quiz: true, practiceMode: true })
        setPracticeReady(false)
      })
      return
    }

    const launchNow = () => {
      const reduced = noAnimation || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      const resolvedQuiz = quiz || activeCheck
      if (reduced) {
        if (renderOverlay) {
          setOverlay({ blockId: activeBlock.id, idx: safeIdx, quiz: resolvedQuiz, practiceMode: false })
        } else {
          onOpenSection?.({ block: activeBlock, sectionIdx: safeIdx, section, quiz: resolvedQuiz, practiceMode })
        }
        return
      }
      const node = nodeRefs.current.get(keyOf(activeBlock.id, active.idx)) ?? null
      const origin = lessonLaunchOrigin(node)
      if (node) {
        const rect = node.getBoundingClientRect()
        origin.x = rect.left + rect.width / 2
        origin.y = rect.top + rect.height / 2
      }
      const revealTarget = () => {
        if (renderOverlay) {
          setOverlay({ blockId: activeBlock.id, idx: safeIdx, quiz: resolvedQuiz, practiceMode: false })
        } else {
          onOpenSection?.({ block: activeBlock, sectionIdx: safeIdx, section, quiz: resolvedQuiz, practiceMode })
        }
      }
      const launchTheme = getBrilliantTheme((((activeBlock.id - 1) % 8) + 1))
      const launchColor = resolveBrilliantRiveColor(launchTheme.accent)
      if (
        !renderOverlay &&
        startLessonTransition({
          kind: practiceMode ? 'warmup' : 'lesson',
          origin,
          lang,
          accent: launchTheme.accent,
          colorVariant: launchColor,
          isLevel: Boolean(resolvedQuiz),
          onReveal: revealTarget,
          onCancel: () => setMapResetEpoch((n) => n + 1),
        })
      ) {
        return
      }
      setLaunch({
        origin,
        target: { block: activeBlock, sectionIdx: safeIdx, section, quiz: resolvedQuiz },
      })
    }

    scheduleEntry(activeBlock.id, active.idx, launchNow)
  }, [
    activeLocked,
    pendingEntry,
    activeSections,
    activeCheck,
    active.idx,
    trackEventPrefix,
    subjectId,
    activeBlock,
    renderOverlay,
    scheduleEntry,
    lang,
    noAnimation,
    onOpenSection,
  ])

  const startCta = useCallback(() => {
    if (activeLocked) {
      const current = nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
      if (current && typeof current.scrollIntoView === 'function') {
        current.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      return
    }
    if ((activeDone && (hasPractice || !renderOverlay)) || (activeCheck && renderOverlay)) {
      openSection(true, true)
      return
    }
    openSection(activeCheck, false)
  }, [activeLocked, activeDone, activeCheck, hasPractice, currentBlock.id, currentIdx, openSection, renderOverlay])

  const startPracticeFab = useCallback(() => {
    if (!hasPractice || pendingEntry) return
    const targetBlock = activeLocked ? currentBlock : activeBlock
    const targetIdx = activeLocked
      ? Math.max(0, currentIdx)
      : activeCheck
        ? Math.max(0, activeBlock.sections.length - 1)
        : Math.min(active.idx, Math.max(0, activeBlock.sections.length - 1))
    const targetSection = targetBlock.sections[targetIdx]
    if (!targetSection) return
    playSound('start-lesson')
    track(`${trackEventPrefix}_open_practice`, {
      subject_id: subjectId,
      block_id: targetBlock.id,
      section_idx: targetIdx,
      quiz: true,
      source: 'fab',
    })
    scheduleEntry(targetBlock.id, targetIdx, () => {
      setWarmUpLaunch({ blockId: targetBlock.id, idx: targetIdx })
      setOverlay({ blockId: targetBlock.id, idx: targetIdx, quiz: true, practiceMode: true })
      setPracticeReady(false)
    })
  }, [
    hasPractice,
    pendingEntry,
    activeLocked,
    currentBlock,
    currentIdx,
    activeBlock,
    activeCheck,
    active.idx,
    trackEventPrefix,
    subjectId,
    scheduleEntry,
  ])

  const closeOverlay = useCallback(() => {
    setOverlay(null)
    setPracticeReady(false)
    setMapResetEpoch((n) => n + 1)
  }, [])

  const advanceOverlay = useCallback(() => {
    if (!overlay) return
    const next = getNextCourseSection(blocks, overlay.blockId, overlay.idx)
    if (!next) {
      setOverlay(null)
      return
    }
    setOverlay({ blockId: next.blockId, idx: next.idx, quiz: false, practiceMode: false })
    setPicked({ blockId: next.blockId, idx: next.idx })
    openBlock(next.blockId)
  }, [overlay, blocks, openBlock])

  const totalSections = blocks.reduce((sum, b) => sum + b.sections.length, 0)
  const doneTotal = passed.size
  const overlayBlock = overlay ? blocks.find((b) => b.id === overlay.blockId) : undefined
  const overlaySection = overlayBlock && overlay ? overlayBlock.sections[overlay.idx] : undefined

  return (
    <div
      ref={rootRef}
      className="cmap px-4 pb-24 lg:px-8 lg:pb-16"
      data-course={dataCourse ?? `${subjectId}-map`}
      data-scrolled={scrolled ? 'true' : 'false'}
      data-node-color={nodeColor}
      data-themed={initialBlockId ? 'true' : undefined}
      data-no-animation={noAnimation ? 'true' : undefined}
      style={{
        '--cmap-ring': mapTheme.accent,
        '--cmap-deep': mapTheme.buttonShadow,
        '--cmap-accent': mapTheme.accent,
        '--cmap-button': mapTheme.buttonBg,
        '--cmap-button-shadow': mapTheme.buttonShadow,
        '--cmap-button-text': mapTheme.buttonText,
      } as CSSProperties}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('button.cmap-bar-back, button.cmap-pill, button.cmap-retry')) {
          playSound('click')
        }
      }}
    >
      <header className="cmap-bar">
        <div className="cmap-bar-left">
          <button
            type="button"
            className="cmap-bar-back"
            onClick={() => (onBackHome ? onBackHome() : goBack(navigate))}
            aria-label={tt('backWord')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </button>

          <span
            className="cmap-bar-pill"
            aria-label={isRu ? `Ключи: ${isPremium ? Math.max(1, doneTotal) : 1}` : `Kalitlar: ${isPremium ? Math.max(1, doneTotal) : 1}`}
          >
            <span className="cmap-bar-pill-n">{isPremium ? Math.max(1, doneTotal) : 1}</span>
            <BrilliantKeyIcon size={17} />
          </span>
        </div>

        <span className="cmap-bar-art" data-visible="true" aria-hidden="true">
          <BrilliantHeroIllustration moduleId={activeBlock.id} className="cmap-bar-art-img" />
        </span>

        <button
          type="button"
          className="cmap-bar-pill cmap-streak"
          onClick={() => navigate('/streak')}
          aria-label={isRu ? `Серия: ${streak}` : `Seriya: ${streak}`}
        >
          <span className="cmap-streak-n">{streak}</span>
          <BrilliantStreakIcon
            size={16}
            className={isExtendedToday ? 'text-[#A8D31D]' : 'text-[#7b7b82]'}
          />
        </button>
      </header>

      <div className="cmap-layout mx-auto w-full">
        <section className="cmap-hero">
          <BrilliantHeroIllustration moduleId={activeBlock.id} className="cmap-hero-art" />
          <h1 className="cmap-hero-title">
            {selectedMeta ? (isRu ? selectedMeta.titleRu : selectedMeta.titleUz) : courseTitle}
          </h1>
          <p className="cmap-hero-sub">
            {selectedMeta ? `${isRu ? unitLabelRu : unitLabelUz} ${selectedMeta.id}` : courseSubtitle}
          </p>
          <p className="cmap-hero-meta">
            <span>{doneTotal}/{totalSections} {sectionCountLabel}</span>
            <span>{blocks.length} {isRu ? 'раздел' : "bo'lim"}</span>
          </p>
        </section>

        {progress.error && (
          <div role="status" className="cmap-error">
            <span>{tt('rusDarslikProgressError')}</span>
            <button type="button" onClick={progress.refresh} className="cmap-retry">
              {tt('rusDarslikRetry')}
            </button>
          </div>
        )}

        <div className="cmap-map">
          <div className="cmap-glow" aria-hidden="true" />
          {blocks.map((block) => {
            const sections = block.sections
            const done = doneFor(block.id)
            const complete = sections.length > 0 && done.length >= sections.length
            const locked = lockedFor(block.id)
            const blockTheme = getBrilliantTheme(((block.id - 1) % 8) + 1)
            const blockNodeColor = resolveBrilliantRiveColor(blockTheme.accent)
            const highlightBlockId = !picked && initialBlockId
              ? initialBlockId
              : activeLocked
                ? currentBlock.id
                : activeBlock.id
            const isCurrentLevel = block.id === highlightBlockId
            const isOpen = openBlocks.has(block.id)
            return (
              <section
                key={block.id}
                className="cmap-level"
                data-complete={complete ? 'true' : 'false'}
                data-open={isOpen ? 'true' : 'false'}
                data-block-node-color={blockNodeColor}
                style={{
                  '--cmap-ring': blockTheme.accent,
                  '--cmap-deep': blockTheme.buttonShadow,
                  '--cmap-accent': blockTheme.accent,
                } as CSSProperties}
                aria-labelledby={`cmap-level-${block.id}`}
              >
                <div className="cmap-level-sticky">
                  <h2 id={`cmap-level-${block.id}`} className="cmap-pill-wrap">
                    <button
                      type="button"
                      className={`cmap-pill${isCurrentLevel ? ' is-current' : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={`cmap-nodes-${block.id}`}
                      onClick={() => toggleBlock(block.id)}
                    >
                      <span className="cmap-pill-tag">
                        {`${isRu ? unitLabelRu : unitLabelUz} ${block.id}`}
                      </span>
                      <span className="cmap-pill-title">{isRu ? block.titleRu : block.titleUz}</span>
                    </button>
                  </h2>
                </div>

                {isOpen && (
                  <ul className="cmap-lessons" id={`cmap-nodes-${block.id}`}>
                    {sections.map((section, idx) => {
                      const key = keyOf(block.id, idx)
                      const isSelected = active.blockId === block.id && active.idx === idx
                      const isCurrent = currentBlock.id === block.id && currentIdx === idx
                      const isFocus = isSelected && !isCurrent
                      const isDone = done.includes(idx)
                      const isLocked = locked.includes(idx)
                      const art = isCurrent ? NODE_ART.active : isDone ? NODE_ART.completed : NODE_ART.puck
                      return (
                        <li key={key} className="cmap-row" style={{ '--off': WAVE_OFFSETS[idx % WAVE_OFFSETS.length] } as CSSProperties}>
                          <button
                            type="button"
                            ref={(node) => {
                              if (node) nodeRefs.current.set(key, node)
                              else nodeRefs.current.delete(key)
                            }}
                            className={`cmap-node${isCurrent ? ' is-active' : ''}${isFocus ? ' is-focus' : ''}${isDone ? ' is-done' : ''}`}
                            aria-current={isCurrent ? 'step' : undefined}
                            aria-disabled={isLocked || undefined}
                            onClick={() => pick(block.id, idx)}
                          >
                            <span className="cmap-node-art-wrap">
                              {isCurrent || isFocus ? (
                                <CourseMapNodeArt
                                  key={mapResetEpoch}
                                  current={isCurrent}
                                  src={art}
                                  completed={isDone && !isCurrent}
                                  locked={isLocked}
                                  selected={isSelected}
                                  entering={Boolean(
                                    entryTarget && entryTarget.blockId === block.id && entryTarget.idx === idx,
                                  )}
                                  disappearing={Boolean(
                                    entryTarget && isCurrent && !(entryTarget.blockId === block.id && entryTarget.idx === idx),
                                  )}
                                  color={blockNodeColor}
                                />
                              ) : (
                                <img className="cmap-node-art" src={art} alt="" width={128} height={134} loading="lazy" />
                              )}
                            </span>
                            <span
                              className="cmap-node-label"
                              data-allcaps={isAllCapsTitle(section.title) ? 'true' : undefined}
                            >
                              {section.title}
                            </span>
                          </button>
                        </li>
                      )
                    })}

                    {includeUnitCheck && sections.length > 0 && (
                      <li className="cmap-row cmap-check-row" style={{ '--off': WAVE_OFFSETS[sections.length % WAVE_OFFSETS.length] } as CSSProperties}>
                        <button
                          type="button"
                          ref={(node) => {
                            const key = keyOf(block.id, sections.length)
                            if (node) nodeRefs.current.set(key, node)
                            else nodeRefs.current.delete(key)
                          }}
                          className={`cmap-node${active.blockId === block.id && active.idx === sections.length ? ' is-focus' : ''}`}
                          aria-disabled={!complete || undefined}
                          onClick={() => pick(block.id, sections.length)}
                        >
                          <span className="cmap-node-art-wrap">
                            {active.blockId === block.id && active.idx === sections.length ? (
                              <CourseMapNodeArt
                                key={mapResetEpoch}
                                current={false}
                                src={NODE_ART.check}
                                completed={complete}
                                locked={!complete}
                                selected
                                levelReview
                                entering={Boolean(
                                  entryTarget && entryTarget.blockId === block.id && (entryTarget.idx === sections.length || (warmUpLaunch && warmUpLaunch.idx === sections.length - 1)),
                                )}
                                color={blockNodeColor}
                              />
                            ) : (
                              <img className="cmap-node-art" src={NODE_ART.check} alt="" width={128} height={134} loading="lazy" />
                            )}
                          </span>
                          <span className="cmap-node-label">{tt('rusDarslikUnitCheck')}</span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            )
          })}

          {activeSections.length > 0 && (
            <div
              className="cmap-sheet"
              ref={sheetRef}
              data-open="true"
              data-launching={pendingEntry || launch || warmUpLaunch ? 'true' : 'false'}
              data-ahead={activeLocked || activeAhead ? 'true' : 'false'}
              data-locked={activeLocked ? 'true' : 'false'}
              data-done={activeDone ? 'true' : 'false'}
            >
              <p
                className="cmap-sheet-title"
                aria-live="polite"
                data-allcaps={isAllCapsTitle(activeTitle) ? 'true' : undefined}
              >
                {activeTitle}
              </p>
              <div className="cmap-sheet-actions">
                <button
                  type="button"
                  className="cmap-start"
                  disabled={Boolean(pendingEntry)}
                  data-loading={pendingEntry ? 'true' : undefined}
                  aria-busy={pendingEntry ? 'true' : undefined}
                  onClick={startCta}
                  style={{
                    '--cta-face': (activeLocked || activeAhead) && !activeCheck ? undefined : sheetTheme.buttonBg,
                    '--cta-lip': (activeLocked || activeAhead) && !activeCheck ? undefined : sheetTheme.buttonShadow,
                    color: (activeLocked || activeAhead) && !activeCheck ? undefined : sheetTheme.buttonText,
                  } as CSSProperties}
                >
                  <span className="cmap-start-sheen" aria-hidden="true">
                    <span className="cmap-start-sheen-mover">
                      <svg viewBox="0 0 150 56" width="150" height="56" fill="none" aria-hidden="true">
                        <defs>
                          <linearGradient id={sheenWideId} x1="100.5" y1="-58.6328" x2="100.5" y2="91.3672" gradientUnits="userSpaceOnUse">
                            <stop offset="27%" stopColor="#f5efff" />
                            <stop offset="71%" stopColor="#fff" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id={sheenNarrowId} x1="140.826" y1="-28.1328" x2="140.826" y2="121.8672" gradientUnits="userSpaceOnUse">
                            <stop offset="8%" stopColor="#f5efff" />
                            <stop offset="57%" stopColor="#fff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <rect x="75" y="-58.6328" width="51" height="150" transform="rotate(30 75 -58.6328)" fill={`url(#${sheenWideId})`} opacity=".4" />
                        <rect x="127.826" y="-28.1328" width="26" height="150" transform="rotate(30 127.826 -28.1328)" fill={`url(#${sheenNarrowId})`} opacity=".4" />
                      </svg>
                    </span>
                  </span>
                  <span className="cmap-start-label">{ctaLabel}</span>
                  {pendingEntry && <span className="cmap-start-spinner" aria-hidden="true" />}
                </button>
                {activeDone && hasPractice && (
                  <button
                    type="button"
                    className="cmap-revisit"
                    disabled={Boolean(pendingEntry)}
                    onClick={() => openSection(false, false)}
                    aria-label={tt('pathReview')}
                    title={tt('pathReview')}
                  >
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 11a8 8 0 1 1 1.5 5M4 5v6h6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="cmap-jump"
        data-visible={jumpDir ? 'true' : 'false'}
        data-dir={jumpDir ?? 'down'}
        aria-hidden={!jumpDir || undefined}
        tabIndex={jumpDir ? 0 : -1}
        onClick={jumpMap}
        aria-label={
          jumpDir === 'up'
            ? (isRu ? 'Вернуться к текущему уроку' : 'Joriy darsga qaytish')
            : (isRu ? 'Перейти к текущему уроку' : 'Joriy darsga o‘tish')
        }
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 9 7 7 7-7" />
        </svg>
      </button>

      {hasPractice && activeSections.length > 0 && (
        <button
          type="button"
          className="cmap-practice-fab"
          data-launching={pendingEntry || launch || warmUpLaunch ? 'true' : 'false'}
          disabled={Boolean(pendingEntry)}
          onClick={startPracticeFab}
          aria-label={isRu ? 'Персональная тренировка' : 'Shaxsiy mashq'}
          title={isRu ? 'Персональная тренировка' : 'Shaxsiy mashq'}
        >
          <svg viewBox="0 0 84 84" width="76" height="76" fill="none" aria-hidden="true">
            <defs>
              <radialGradient id={`${sheenWideId}-pad-shadow`} cx="50%" cy="50%" r="50%">
                <stop offset="25%" stopColor="#000" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${sheenWideId}-bar`} x1="16" y1="22" x2="66" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#9d8dff" />
                <stop offset="52%" stopColor="#f292c4" />
                <stop offset="100%" stopColor="#ffd16b" />
              </linearGradient>
              <linearGradient id={`${sheenWideId}-plate-l`} x1="20" y1="16" x2="40" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#c5bbff" />
                <stop offset="100%" stopColor="#8575ef" />
              </linearGradient>
              <linearGradient id={`${sheenWideId}-plate-r`} x1="46" y1="30" x2="68" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffd97e" />
                <stop offset="100%" stopColor="#f398a6" />
              </linearGradient>
            </defs>
            {/* 3D grey circular pedestal */}
            <ellipse className="cmap-fab-lip" cx="42" cy="61.5" rx="26" ry="13.5" fill="#707078" />
            <ellipse className="cmap-fab-face" cx="42" cy="57.5" rx="26" ry="13.5" fill="#a2a2aa" />
            <ellipse cx="42" cy="57.5" rx="19" ry="9" fill={`url(#${sheenWideId}-pad-shadow)`} />
            {/* 3D angled gradient dumbbell */}
            <g transform="translate(42 36) rotate(-32) translate(-42 -36)">
              <rect x="30" y="32.5" width="24" height="7" rx="3.5" fill={`url(#${sheenWideId}-bar)`} />
              {/* left plate */}
              <rect x="23" y="24" width="9" height="24" rx="4.5" fill="#7161d8" />
              <ellipse cx="24" cy="36" rx="5.5" ry="12" fill={`url(#${sheenWideId}-plate-l)`} />
              <ellipse cx="22.5" cy="36" rx="3" ry="6.5" fill="#d9d2ff" opacity="0.55" />
              {/* right inner collar + main cap */}
              <rect x="51" y="25.5" width="7" height="21" rx="3.5" fill="#f097ad" />
              <rect x="54" y="23.5" width="9" height="25" rx="4.5" fill="#ea8e76" />
              <ellipse cx="62" cy="36" rx="5.5" ry="12.5" fill={`url(#${sheenWideId}-plate-r)`} />
              <ellipse cx="62.5" cy="36" rx="2.6" ry="5.5" fill="#fff3c4" opacity="0.7" />
            </g>
          </svg>
        </button>
      )}

      {launch && (() => {
        const launchTheme = getBrilliantTheme((((launch.target.block.id - 1) % 8) + 1))
        const launchColor = resolveBrilliantRiveColor(launchTheme.accent)
        return (
          <LessonLaunch
            origin={launch.origin}
            lang={lang}
            accent={launchTheme.accent}
            colorVariant={launchColor}
            isLevel={Boolean(launch.target.quiz)}
            onReveal={() => {
              if (renderOverlay) {
                setOverlay({
                  blockId: launch.target.block.id,
                  idx: launch.target.sectionIdx,
                  quiz: launch.target.quiz,
                  practiceMode: false,
                })
              } else {
                onOpenSection?.({
                  block: launch.target.block,
                  sectionIdx: launch.target.sectionIdx,
                  section: launch.target.section,
                  quiz: launch.target.quiz,
                  practiceMode: false,
                })
              }
            }}
            onFinish={() => setLaunch(null)}
            onCancel={() => {
              setLaunch(null)
              setOverlay(null)
              setMapResetEpoch((n) => n + 1)
            }}
          />
        )
      })()}

      {overlay && overlayBlock && overlaySection && renderOverlay && renderOverlay({
        block: overlayBlock,
        sectionIdx: overlay.idx,
        section: overlaySection,
        quiz: overlay.quiz,
        practiceMode: overlay.practiceMode,
        close: closeOverlay,
        nextTopic: advanceOverlay,
        selectSection: (idx) => setOverlay({ blockId: overlay.blockId, idx, quiz: false, practiceMode: false }),
        onPracticeReady: () => setPracticeReady(true),
      })}

      {warmUpLaunch && (() => {
        const warmUpTheme = getBrilliantTheme((((warmUpLaunch.blockId - 1) % 8) + 1))
        const warmUpColor = resolveBrilliantRiveColor(warmUpTheme.accent)
        return (
          <PracticeWarmUpLaunch
            lang={lang}
            accent={warmUpTheme.accent}
            colorVariant={warmUpColor}
            isReady={practiceReady}
            onReveal={() => {}}
            onFinish={() => setWarmUpLaunch(null)}
            onCancel={() => {
              setWarmUpLaunch(null)
              closeOverlay()
            }}
          />
        )
      })()}
    </div>
  )
}
