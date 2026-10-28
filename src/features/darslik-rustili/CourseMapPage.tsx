import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { addPageScrollListener, getPageScroller, pageScrollY, scrollPageToTop } from '../../shared/lib/page-scroll'
import { track } from '../../shared/lib/analytics'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { useT } from '../../shared/i18n'
import {
  DARSLIK_BLOCKS,
  DARSLIK_PROGRESS_MODULE_OFFSET,
  getBlockOutline,
  getDarslikBlock,
} from '../../content/darslik-rustili'
import { darslikTopicId } from '../../../shared/darslik-mastery'
import { BlockReader } from './BlockReader'
import { lockedSectionsInBlock, nextSection, sectionKey } from './progress'
import { useDarslikMastery } from './useDarslikMastery'
import './course-map.css'

/** Birinchi blok chapdan, keyingi bloklar esa o'rta nuqtadan boshlanadi. */
const FIRST_WAVE = [0, 50, 100, 50]
const NEXT_WAVE = [50, 0, 50, 100]

const reduceMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const NODE_ART = {
  puck: '/darslik-map/node-puck.svg',
  check: '/darslik-map/node-check.svg',
  // APNG: 4.07 s loop, 12 fps, 256x268. WebP animations printed by Pillow are
  // ignored by Chrome, APNG is not.
  active: reduceMotion ? '/darslik-map/node-active.png' : '/darslik-map/node-active-anim.png',
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
  const streak = useAppStore((s) => s.streak)
  const readByUser = useLessonsStore((s) => s.readByUser)
  const markRead = useLessonsStore((s) => s.markRead)
  const mastery = useDarslikMastery()
  const tt = useT(lang)
  const isRu = lang === 'ru'
  const passed = mastery.passed

  const [picked, setPicked] = useState<{ blockId: number; idx: number } | null>(null)
  /** Scroll bilan aniqlanadigan “eng yaqin mavzu” — karta shunga ergashadi. */
  const [focus, setFocus] = useState<{ blockId: number; idx: number } | null>(null)
  const [reader, setReader] = useState<{ blockId: number; idx: number } | null>(null)
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
  /** Gem (animatsiyali tugun) faqat tanlangan yoki joriy mavzuda turadi. */
  const gemActive = picked ?? { blockId: currentBlock.id, idx: currentIdx }
  const outline = getBlockOutline(active.blockId)
  const activeTitle = outline[active.idx] ?? ''
  const activeDone = doneFor(active.blockId).includes(active.idx)
  const activeLocked = lockedFor(active.blockId).includes(active.idx)
  /* Joriy mavzudan oldindagi mavzu — ilovada “Jump ahead” gradienti bilan ko'rsatiladi. */
  const activeAhead = active.blockId > currentBlock.id
    || (active.blockId === currentBlock.id && active.idx > currentIdx)
  const ctaLabel = activeLocked || activeAhead
    ? tt('pathJumpAhead')
    : activeDone ? tt('pathReview') : tt('pathStart')

  /* Panel balandligi (sticky karta uchun) va markazi (pastdagi varaq uchun). */
  useEffect(() => {
    const root = rootRef.current
    const header = root?.querySelector<HTMLElement>('.cmap-bar')
    if (!root || !header) return
    const measure = () => {
      root.style.setProperty('--cmap-header', `${header.getBoundingClientRect().height}px`)
      const rect = root.getBoundingClientRect()
      root.style.setProperty('--cmap-center', `${Math.round(rect.left + rect.width / 2)}px`)
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

  const openReader = useCallback(() => {
    if (lockedFor(active.blockId).includes(active.idx)) return
    track('rus_darslik_map_open_topic', { block_id: active.blockId, section_idx: active.idx })
    setReader({ blockId: active.blockId, idx: active.idx })
  }, [active.blockId, active.idx, lockedFor])

  /* Ochilmagan mavzuda tugma joriy mavzuga olib boradi (ilovadagi “Jump ahead”). */
  const startCta = useCallback(() => {
    if (!lockedFor(active.blockId).includes(active.idx)) {
      openReader()
      return
    }
    const current = nodeRefs.current.get(keyOf(currentBlock.id, currentIdx))
    if (current && typeof current.scrollIntoView === 'function') {
      current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [active.blockId, active.idx, currentBlock.id, currentIdx, lockedFor, openReader])

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

      <div className="mx-auto w-full max-w-[520px]">
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
            const wave = block.id === DARSLIK_BLOCKS[0].id ? FIRST_WAVE : NEXT_WAVE
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
                      const isActive = gemActive.blockId === block.id && gemActive.idx === idx
                      const isFocus = scrolled && active.blockId === block.id && active.idx === idx
                      const isDone = done.includes(idx)
                      const isLocked = locked.includes(idx)
                      const isLast = idx === sections.length - 1
                      const art = isActive ? NODE_ART.active : isLast ? NODE_ART.check : NODE_ART.puck
                      return (
                        <li key={key} className="cmap-row" style={{ '--off': `${wave[idx % wave.length]}px` } as CSSProperties}>
                          <button
                            type="button"
                            ref={(node) => {
                              if (node) nodeRefs.current.set(key, node)
                              else nodeRefs.current.delete(key)
                            }}
                            className={`cmap-node${isActive ? ' is-active' : ''}${isFocus ? ' is-focus' : ''}${isDone ? ' is-done' : ''}`}
                            aria-current={isActive ? 'step' : undefined}
                            aria-disabled={isLocked || undefined}
                            onClick={() => pick(block.id, idx)}
                          >
                            <span className="cmap-node-art-wrap">
                              <img className="cmap-node-art" src={art} alt="" width={128} height={134} loading="lazy" />
                            </span>
                            <span className="cmap-node-label">{title}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}

          {openBlocks.has(active.blockId) && (
            <div className="cmap-sheet" ref={sheetRef} data-open={scrolled ? 'true' : 'false'} data-ahead={activeLocked || activeAhead ? 'true' : 'false'} data-locked={activeLocked ? 'true' : 'false'}>
              <p className="cmap-sheet-title" aria-live="polite">{activeTitle}</p>
              <button type="button" className="cmap-start" onClick={startCta}>
                <span className="cmap-start-sheen" aria-hidden="true" />
                <span className="cmap-start-label">{ctaLabel}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <svg className="cmap-bonus-art" data-scrolled={scrolled ? 'true' : 'false'} viewBox="0 0 112 104" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="cmap-pedestal" cx="0" cy="0" r="1" gradientTransform="translate(55 72) rotate(90) scale(28 49)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#303030" />
            <stop offset="1" stopColor="#6d6d6d" />
          </radialGradient>
          <linearGradient id="cmap-hammer-head" x1="57" y1="18" x2="80" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff9ad4" /><stop offset="0.58" stopColor="#ffb179" /><stop offset="1" stopColor="#ffd35c" />
          </linearGradient>
          <linearGradient id="cmap-hammer-base" x1="20" y1="41" x2="53" y2="67" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a59aff" /><stop offset="0.55" stopColor="#df85ee" /><stop offset="1" stopColor="#ff8ac9" />
          </linearGradient>
        </defs>
        <ellipse cx="57" cy="81" rx="46" ry="19" fill="#747474" />
        <ellipse cx="57" cy="74" rx="44" ry="21" fill="url(#cmap-pedestal)" />
        <g transform="rotate(42 53 42)">
          <rect x="48" y="30" width="11" height="35" rx="5.5" fill="#f38cbd" />
          <rect x="47" y="29" width="5" height="33" rx="2.5" fill="#ffb3d3" opacity=".72" />
          <rect x="39" y="16" width="29" height="23" rx="10" fill="url(#cmap-hammer-head)" />
          <ellipse cx="42" cy="27.5" rx="10" ry="12" fill="#ffb0d8" />
          <ellipse cx="66" cy="27.5" rx="8" ry="11.5" fill="#ffbe6b" opacity=".58" />
          <rect x="36" y="58" width="34" height="25" rx="11" fill="url(#cmap-hammer-base)" />
          <ellipse cx="38" cy="70.5" rx="11" ry="12.5" fill="#b7a5ff" />
          <path d="M33 65c5 0 8 3 8 7" stroke="#906fea" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        </g>
      </svg>

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
          initialQuizOpen={false}
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
