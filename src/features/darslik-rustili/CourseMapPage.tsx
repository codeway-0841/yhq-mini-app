import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { addPageScrollListener, getPageScroller, pageScrollY, scrollPageToTop } from '../../shared/lib/page-scroll'
import { track } from '../../shared/lib/analytics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useDailyStore } from '../../shared/store/useDailyStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import {
  DARSLIK_BLOCKS,
  DARSLIK_PROGRESS_MODULE_OFFSET,
  getBlockOutline,
  getDarslikBlock,
} from '../../content/darslik-rustili'
import { darslikTopicId } from '../../../shared/darslik-mastery'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import { BlockReader } from './BlockReader'
import { CourseMapNodeArt } from './CourseMapNodeArt'
import { lockedSectionsInBlock, nextSection, sectionKey } from './progress'
import { useDarslikMastery } from './useDarslikMastery'
import './course-map.css'

/** Bo'sh joy bo'ylab 50% → 0% → 50% → 100% egri yo'l. */
const HALF_WAVE = 'calc(var(--cmap-wave-space) / 2)'
const WAVE_OFFSETS = [HALF_WAVE, '0px', HALF_WAVE, 'var(--cmap-wave-space)']

const NODE_ART = {
  puck: '/darslik-map/node-puck.svg',
  check: '/darslik-map/node-check.svg',
  completed: '/darslik-map/node-completed.svg',
  // Keep the original pedestal ring without the static gem icon.
  active: '/darslik-map/node-active-base.png',
}

const EMPTY_SECTIONS: number[] = []
const EMPTY_READ: Record<number, number[]> = {}
const keyOf = (blockId: number, idx: number) => `${blockId}:${idx}`

/**
 * “Xarita” — rus tili darsligining Brilliant uslubidagi ko'rinishi:
 * blok = level (yopishqoq pill), mavzu = tugun, tanlanganda karta pastda.
 *
 * Progress mavjud sahifadagi bilan bir xil manbadan olinadi
 * (`darslik_mastery` + `useLessonsStore`), shuning uchun ikkala sahifa
 * bir-biriga zid ma'lumot ko'rsatmaydi.
 */
export default function CourseMapPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const streak = useDailyStore((s) => s.streaks[RUSSIAN_SUBJECT_ID] ?? 0)
  const readByUser = useLessonsStore((s) => s.readByUser)
  const markRead = useLessonsStore((s) => s.markRead)
  const mastery = useDarslikMastery()
  const tt = useT(lang)
  const isRu = lang === 'ru'
  const passed = mastery.passed

  const [picked, setPicked] = useState<{ blockId: number; idx: number } | null>(null)
  /** Scroll bilan aniqlanadigan “eng yaqin mavzu” — karta shunga ergashadi. */
  const [focus, setFocus] = useState<{ blockId: number; idx: number } | null>(null)
  const [reader, setReader] = useState<{ blockId: number; idx: number; quiz?: boolean } | null>(null)
  const [openBlocks, setOpenBlocks] = useState<Set<number>>(
    () => new Set(DARSLIK_BLOCKS.map((block) => block.id)),
  )
  const [scrolled, setScrolled] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const autoScrolled = useRef(false)

  const readMap = readByUser[userId] ?? EMPTY_READ

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
  const lockedFor = useCallback(
    (blockId: number) => lockedSectionsInBlock(blockId, passed),
    [passed],
  )

  const currentBlock = useMemo(
    () => DARSLIK_BLOCKS.find((b) => doneFor(b.id).length < getBlockOutline(b.id).length)
      ?? DARSLIK_BLOCKS[DARSLIK_BLOCKS.length - 1],
    [doneFor],
  )
  const currentIdx = useMemo(() => {
    const done = doneFor(currentBlock.id)
    const idx = getBlockOutline(currentBlock.id).findIndex((_, i) => !done.includes(i))
    return idx < 0 ? 0 : idx
  }, [currentBlock.id, doneFor])

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

  /** Tanlanmagan bo'lsa — ekran tubidagi eng yaqin mavzu, u ham bo'lmasa joriy mavzu. */
  const active = picked ?? focus ?? { blockId: currentBlock.id, idx: currentIdx }
  /** Karta scroll bilan ergashadi; ko'k disk esa haqiqiy joriy darsda qoladi. */
  const outline = getBlockOutline(active.blockId)
  const activeCheck = active.idx === outline.length
  const activeTitle = activeCheck ? tt('rusDarslikUnitCheck') : outline[active.idx] ?? ''
  const activeDone = !activeCheck && doneFor(active.blockId).includes(active.idx)
  const activeLocked = activeCheck
    ? doneFor(active.blockId).length < outline.length
    : lockedFor(active.blockId).includes(active.idx)
  /* Joriy mavzudan oldindagi mavzu — ilovada “Jump ahead” gradienti bilan ko'rsatiladi. */
  const activeAhead = active.blockId > currentBlock.id
    || (active.blockId === currentBlock.id && active.idx > currentIdx)
  const ctaLabel = activeLocked || (activeAhead && !activeCheck)
    ? tt('pathJumpAhead')
    : activeDone || activeCheck ? tt('rusDarslikStartPractice') : tt('pathStart')

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
  }, [])

  /* Scroll — karta ekran tubidagi eng yaqin mavzuga ergashadi (ilovadagi kabi). */
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      // sahifa boshida karta joriy mavzuda turadi (ilovadagidek), scroll'da ergashadi
      if (pageScrollY() < 80) {
        setFocus((prev) => (prev === null ? prev : null))
        return
      }
      const sheetHeight = sheetRef.current?.offsetHeight ?? 120
      const ceiling = (getPageScroller()?.getBoundingClientRect().bottom ?? window.innerHeight)
        - sheetHeight - 144
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
  }, [openBlocks, lang])

  const jumpMap = useCallback(() => {
    if (scrolled) {
      setPicked(null)
      scrollPageToTop('smooth')
      return
    }
    nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrolled, currentBlock.id, currentIdx])

  /* Qo'lda scroll qilinsa tanlov bekor bo'ladi va karta yana scroll'ga ergashadi. */
  useEffect(() => {
    const clear = () => setPicked(null)
    window.addEventListener('wheel', clear, { passive: true })
    window.addEventListener('touchmove', clear, { passive: true })
    return () => {
      window.removeEventListener('wheel', clear)
      window.removeEventListener('touchmove', clear)
    }
  }, [])

  /* Joriy blok har doim ochiq bo'lsin. */
  useEffect(() => {
    if (mastery.loading) return
    openBlock(currentBlock.id)
  }, [mastery.loading, currentBlock.id, openBlock])

  /* Birinchi ochilishda joriy mavzuga suriladi. */
  useEffect(() => {
    if (mastery.loading || autoScrolled.current) return
    autoScrolled.current = true
    if (currentBlock.id === DARSLIK_BLOCKS[0].id) return
    const button = nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
    if (button && typeof button.scrollIntoView === 'function') {
      button.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
  }, [mastery.loading, currentBlock.id, currentIdx])

  const pick = useCallback((blockId: number, idx: number) => {
    openBlock(blockId)
    setPicked({ blockId, idx })
    track('rus_darslik_map_pick', { block_id: blockId, section_idx: idx })
    const button = nodeRefs.current.get(keyOf(blockId, idx))
    if (button && typeof button.scrollIntoView === 'function') {
      button.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [openBlock])

  const openReader = useCallback((quiz = false) => {
    if (activeLocked) return
    track('rus_darslik_map_open_topic', { block_id: active.blockId, section_idx: active.idx, quiz })
    setReader({ blockId: active.blockId, idx: activeCheck ? outline.length - 1 : active.idx, quiz: quiz || activeCheck })
  }, [active.blockId, active.idx, activeCheck, activeLocked, outline.length])

  /* Ochilmagan mavzuda tugma joriy mavzuga olib boradi (ilovadagi “Jump ahead”). */
  const startCta = useCallback(() => {
    if (!activeLocked) {
      openReader(activeDone || activeCheck)
      return
    }
    const current = nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
    if (current && typeof current.scrollIntoView === 'function') {
      current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeLocked, activeDone, activeCheck, currentBlock.id, currentIdx, openReader])

  const advanceReader = useCallback(() => {
    if (!reader) return
    const next = nextSection(reader.blockId, reader.idx)
    if (!next) {
      setReader(null)
      return
    }
    setReader({ blockId: next.blockId, idx: next.idx })
    setPicked({ blockId: next.blockId, idx: next.idx })
    openBlock(next.blockId)
  }, [reader, openBlock])

  const activeBlockMeta = reader ? getDarslikBlock(reader.blockId) : undefined
  const totalSections = DARSLIK_BLOCKS.reduce((sum, b) => sum + getBlockOutline(b.id).length, 0)
  const doneTotal = passed.size

  return (
    <div
      ref={rootRef}
      className="cmap px-4 pb-24 lg:px-8 lg:pb-16"
      data-course="russian-map"
      data-scrolled={scrolled ? 'true' : 'false'}
    >
      <header className="cmap-bar">
        <button
          type="button"
          className="cmap-bar-back"
          onClick={() => goBack(navigate)}
          aria-label={tt('backWord')}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </button>

        <span className="cmap-streak">
          <span className="cmap-streak-n">{streak}</span>
          <svg viewBox="0 0 24 32" width="19" height="27" aria-hidden="true">
            <path fill="#f7bd23" d="M11 1h6v15l4 4v8l-8 4-8-4v-8l6-4V1Zm5 4h-3v2h3V5Zm0 5h-3v2h3v-2Zm-3 10-3 2v4l3 2 3-2v-4l-3-2Z" />
          </svg>
        </span>

        <span className="cmap-bar-art" data-visible={scrolled ? 'true' : 'false'} aria-hidden="true">
          <img src="/darslik-map/course-art.png" alt="" width={40} height={48} />
        </span>

        <button
          type="button"
          className="cmap-bar-power"
          onClick={() => navigate('/premium')}
          aria-label="Premium"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2 4.5 13.5H11L10 22l9-11.5h-6.5L13 2Z" />
          </svg>
        </button>
      </header>

      <div className="cmap-layout mx-auto w-full">
        <section className="cmap-hero">
          <img className="cmap-hero-art" src="/darslik-map/course-art.png" alt="" width={80} height={96} />
          <h1 className="cmap-hero-title">{tt('rusDarslikTitle')}</h1>
          <p className="cmap-hero-sub">{tt('rusDarslikSubtitle')}</p>
          <p className="cmap-hero-meta">
            <span>{doneTotal}/{totalSections} {tt('rusDarslikSection')}</span>
            <span>{DARSLIK_BLOCKS.length} {isRu ? 'раздел' : "bo'lim"}</span>
          </p>
        </section>

        {mastery.error && (
          <div role="status" className="cmap-error">
            <span>{tt('rusDarslikProgressError')}</span>
            <button type="button" onClick={mastery.refresh} className="cmap-retry">
              {tt('rusDarslikRetry')}
            </button>
          </div>
        )}

        <div className="cmap-map">
          <div className="cmap-glow" aria-hidden="true" />
          {DARSLIK_BLOCKS.map((block) => {
            const sections = getBlockOutline(block.id)
            const done = doneFor(block.id)
            const complete = done.length >= sections.length
            const locked = lockedFor(block.id)
            const isCurrentLevel = block.id === currentBlock.id
            const isOpen = openBlocks.has(block.id)
            return (
              <section
                key={block.id}
                className="cmap-level"
                data-complete={complete ? 'true' : 'false'}
                data-open={isOpen ? 'true' : 'false'}
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
                        {tt('rusDarslikUnitBadge').replace('{unit}', String(block.id))}
                      </span>
                      <span className="cmap-pill-title">{isRu ? block.titleRu : block.titleUz}</span>
                    </button>
                  </h2>
                </div>

                {isOpen && (
                  <ul className="cmap-lessons" id={`cmap-nodes-${block.id}`}>
                    {sections.map((title, idx) => {
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
                              {isCurrent || isFocus
                                ? <CourseMapNodeArt current={isCurrent} src={art} completed={isDone && !isCurrent} />
                                : <img className="cmap-node-art" src={art} alt="" width={128} height={134} loading="lazy" />}
                            </span>
                            <span className="cmap-node-label">{title}</span>
                          </button>
                        </li>
                      )
                    })}
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
                          {active.blockId === block.id && active.idx === sections.length
                            ? <CourseMapNodeArt current={false} src={NODE_ART.check} levelReview />
                            : <img className="cmap-node-art" src={NODE_ART.check} alt="" width={128} height={134} loading="lazy" />}
                        </span>
                        <span className="cmap-node-label">{tt('rusDarslikUnitCheck')}</span>
                      </button>
                    </li>
                  </ul>
                )}
              </section>
            )
          })}

          {openBlocks.has(active.blockId) && (
            <div className="cmap-sheet" ref={sheetRef} data-open={scrolled ? 'true' : 'false'} data-ahead={activeLocked || activeAhead ? 'true' : 'false'} data-locked={activeLocked ? 'true' : 'false'} data-done={activeDone ? 'true' : 'false'}>
              <p className="cmap-sheet-title" aria-live="polite">{activeTitle}</p>
              <div className="cmap-sheet-actions">
                <button type="button" className="cmap-start" onClick={startCta}>
                  <span className="cmap-start-sheen" aria-hidden="true">
                    <span className="cmap-start-sheen-mover">
                      <svg viewBox="0 0 150 56" width="150" height="56" fill="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="cmap-sheen-wide" x1="100.5" y1="-58.6328" x2="100.5" y2="91.3672" gradientUnits="userSpaceOnUse">
                            <stop offset="27%" stopColor="#f5efff" />
                            <stop offset="71%" stopColor="#fff" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="cmap-sheen-narrow" x1="140.826" y1="-28.1328" x2="140.826" y2="121.8672" gradientUnits="userSpaceOnUse">
                            <stop offset="8%" stopColor="#f5efff" />
                            <stop offset="57%" stopColor="#fff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <rect x="75" y="-58.6328" width="51" height="150" transform="rotate(30 75 -58.6328)" fill="url(#cmap-sheen-wide)" opacity=".4" />
                        <rect x="127.826" y="-28.1328" width="26" height="150" transform="rotate(30 127.826 -28.1328)" fill="url(#cmap-sheen-narrow)" opacity=".4" />
                      </svg>
                    </span>
                  </span>
                  <span className="cmap-start-label">{ctaLabel}</span>
                </button>
                {activeDone && (
                  <button type="button" className="cmap-revisit" onClick={() => openReader(false)} aria-label={tt('pathReview')} title={tt('pathReview')}>
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

      <button type="button" className="cmap-jump" data-scrolled={scrolled ? 'true' : 'false'} onClick={jumpMap} aria-label={scrolled ? 'Tepaga qaytish' : 'Mavzularga o‘tish'}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 9 7 7 7-7" />
        </svg>
      </button>

      {reader && activeBlockMeta && (
        <BlockReader
          block={activeBlockMeta}
          sectionIndex={reader.idx}
          doneSections={doneFor(reader.blockId)}
          readSections={readFor(reader.blockId)}
          lockedSections={lockedFor(reader.blockId)}
          initialQuizOpen={reader.quiz ?? false}
          onClose={() => setReader(null)}
          onSelectSection={(idx) => setReader({ blockId: reader.blockId, idx })}
          onMarkRead={(idx) => markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + reader.blockId, idx)}
          onQuizPass={(idx) => {
            markRead(userId, DARSLIK_PROGRESS_MODULE_OFFSET + reader.blockId, idx)
            mastery.markPassed(darslikTopicId(reader.blockId, idx))
          }}
          onNextTopic={advanceReader}
          onLockedSection={mastery.refresh}
        />
      )}
    </div>
  )
}
