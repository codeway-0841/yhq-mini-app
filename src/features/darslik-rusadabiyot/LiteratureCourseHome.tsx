import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronLeft, User, Volume2, VolumeX } from 'lucide-react'
import { RUSSIAN_LITERATURE_SUBJECT_ID } from '../../../shared/subjects'
import {
  RUSADABIYOT_BLOCKS,
  RUSADABIYOT_PROGRESS_MODULE_OFFSET,
  getRusadabiyotBlockOutline,
  loadRusadabiyotBlock,
} from '../../content/darslik-rusadabiyot'
import { getTelegramWebApp, syncTelegramTheme } from '../../platform/telegram'
import { COURSE_HOME_BACK_STATE, leaveCourseMap, registerModal } from '../../shared/lib/navigation'
import { scrollPageToTop } from '../../shared/lib/page-scroll'
import { speak, stopSpeaking } from '../../shared/lib/speech'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { Button } from '../../shared/components/ui/button'
import {
  BrilliantExitDialog,
  BrilliantReaderHeader,
  BrilliantStagePill,
  type BrilliantLessonStage,
} from '../../shared/components/BrilliantLessonChrome'
import { buildLessonPages, MarkdownView, parseMarkdown, type MdBlock } from '../darslik-rustili'
import { formatImageSrc } from '../test'
import {
  BrilliantCourseHome,
  BrilliantCourseMap,
  PathMascot,
  courseSectionKey,
  type BrilliantCourseLevel,
  type CourseBlockMeta,
} from '../lessons'

interface AuthorItem {
  name: string
  img: string
  years?: string
}

const ERA_AUTHORS: Record<number, AuthorItem[]> = {
  1: [
    { name: 'Теория', img: '/images/authors/slovo-o-polku.jpg', years: 'Роды и жанры' },
  ],
  2: [
    { name: '«Слово о полку»', img: '/images/authors/slovo-o-polku.jpg', years: 'XII век' },
    { name: 'Сергий Радонежский', img: '/images/authors/sergiy-radonezhsky.jpg', years: 'XIV в.' },
    { name: 'Афанасий Никитин', img: '/images/authors/afanasiy-nikitin.jpg', years: 'XV в.' },
    { name: '«Домострой»', img: '/images/authors/domostroy.jpg', years: 'XVI в.' },
  ],
  3: [
    { name: 'Ломоносов', img: '/images/authors/lomonosov.jpg', years: '1711–1765' },
    { name: 'Державин', img: '/images/authors/derzhavin.jpg', years: '1743–1816' },
    { name: 'Фонвизин', img: '/images/authors/fonvizin.jpg', years: '1745–1792' },
    { name: 'Карамзин', img: '/images/authors/karamzin.jpg', years: '1766–1826' },
    { name: 'Тредиаковский', img: '/images/authors/trediakovsky.jpg', years: '1703–1769' },
  ],
  4: [
    { name: 'Пушкин', img: '/images/authors/pushkin.jpg', years: '1799–1837' },
    { name: 'Лермонтов', img: '/images/authors/lermontov.jpg', years: '1814–1841' },
    { name: 'Гоголь', img: '/images/authors/gogol.jpg', years: '1809–1852' },
    { name: 'Грибоедов', img: '/images/authors/griboyedov.jpg', years: '1795–1829' },
    { name: 'Жуковский', img: '/images/authors/zhukovsky.jpg', years: '1783–1852' },
    { name: 'Тютчев', img: '/images/authors/tyutchev.jpg', years: '1803–1873' },
    { name: 'Фет', img: '/images/authors/fet.jpg', years: '1820–1892' },
  ],
  5: [
    { name: 'Толстой', img: '/images/authors/tolstoy.jpg', years: '1828–1910' },
    { name: 'Достоевский', img: '/images/authors/dostoevsky.jpg', years: '1821–1881' },
    { name: 'Чехов', img: '/images/authors/chekhov.jpg', years: '1860–1904' },
    { name: 'Тургенев', img: '/images/authors/turgenev.jpg', years: '1818–1883' },
    { name: 'Островский', img: '/images/authors/ostrovsky.jpg', years: '1823–1886' },
    { name: 'Некрасов', img: '/images/authors/nekrasov.jpg', years: '1821–1877' },
    { name: 'Гончаров', img: '/images/authors/goncharov.jpg', years: '1812–1891' },
  ],
  6: [
    { name: 'Блок', img: '/images/authors/blok.jpg', years: '1880–1921' },
    { name: 'Ахматова', img: '/images/authors/akhmatova.jpg', years: '1889–1966' },
    { name: 'Маяковский', img: '/images/authors/mayakovsky.jpg', years: '1893–1930' },
    { name: 'Есенин', img: '/images/authors/esenin.jpg', years: '1895–1925' },
    { name: 'Цветаева', img: '/images/authors/tsvetaeva.jpg', years: '1892–1941' },
    { name: 'Горький', img: '/images/authors/gorky.jpg', years: '1868–1936' },
    { name: 'Бунин', img: '/images/authors/bunin.jpg', years: '1870–1953' },
    { name: 'Мандельштам', img: '/images/authors/mandelshtam.jpg', years: '1891–1938' },
  ],
  7: [
    { name: 'Булгаков', img: '/images/authors/bulgakov.jpg', years: '1891–1940' },
    { name: 'Шолохов', img: '/images/authors/sholokhov.jpg', years: '1905–1984' },
    { name: 'Пастернак', img: '/images/authors/pasternak.jpg', years: '1890–1960' },
    { name: 'Платонов', img: '/images/authors/platonov.jpg', years: '1899–1951' },
    { name: 'Замятин', img: '/images/authors/zamyatin.jpg', years: '1884–1937' },
    { name: 'Зощенко', img: '/images/authors/zoshchenko.jpg', years: '1894–1958' },
  ],
  8: [
    { name: 'Твардовский', img: '/images/authors/tvardovsky.jpg', years: '1910–1971' },
    { name: 'Симонов', img: '/images/authors/simonov.jpg', years: '1915–1979' },
    { name: 'Васильев', img: '/images/authors/vasiliev.jpg', years: '1924–2013' },
    { name: 'Быков', img: '/images/authors/bykov.jpg', years: '1924–2003' },
  ],
  9: [
    { name: 'Солженицын', img: '/images/authors/solzhenitsyn.jpg', years: '1918–2008' },
    { name: 'Шукшин', img: '/images/authors/shukshin.jpg', years: '1929–1974' },
    { name: 'Распутин', img: '/images/authors/rasputin.jpg', years: '1937–2015' },
    { name: 'Довлатов', img: '/images/authors/dovlatov.jpg', years: '1941–1990' },
  ],
}

/** Rus adabiyoti xaritadagi tugun bosilganda ochiladigan akademik konspekt overlay'i. */
function LiteratureEraReaderOverlay({
  blockId,
  initialSectionTitle,
  ru,
  userId,
  isDone,
  onMarkDone,
  onNextEra,
  onClose,
}: {
  blockId: number
  initialSectionTitle?: string
  ru: boolean
  userId: string
  isDone: boolean
  onMarkDone: () => void
  onNextEra?: () => void
  onClose: () => void
}) {
  const themeSetting = useAppStore((s) => s.settings.theme)
  const markRead = useLessonsStore((s) => s.markRead)
  const selectedBlock = RUSADABIYOT_BLOCKS.find((b) => b.id === blockId)
  const [blockContent, setBlockContent] = useState('')
  const [blocksParsed, setBlocksParsed] = useState<MdBlock[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const pages = useMemo(() => {
    const built = buildLessonPages(blocksParsed, 3)
    return built.length > 0 ? built : [blocksParsed]
  }, [blocksParsed])
  const pageCount = Math.max(1, pages.length)
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const isLastPage = safePageIndex >= pageCount - 1
  const currentBlocks = pages[safePageIndex] ?? []
  const stage: BrilliantLessonStage = isLastPage ? 'synthesis' : safePageIndex === 0 ? 'intro' : 'concept'

  const closeRef = useRef(() => onClose())
  closeRef.current = () => {
    stopSpeaking()
    setSpeaking(false)
    if (safePageIndex > 0 && !isLastPage) {
      setShowExitConfirm(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    if (showExitConfirm) return
    const id = Symbol('literature-era-reader')
    return registerModal(id, () => closeRef.current())
  }, [showExitConfirm])

  useEffect(() => {
    if (!selectedBlock) return
    markRead(userId, RUSADABIYOT_PROGRESS_MODULE_OFFSET + selectedBlock.id, 0)
    let cancelled = false
    setLoading(true)
    setPageIndex(0)
    loadRusadabiyotBlock(selectedBlock.id)
      .then((text) => {
        if (cancelled) return
        setBlockContent(text)
        setBlocksParsed(parseMarkdown(text))
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
      stopSpeaking()
      setSpeaking(false)
    }
  }, [selectedBlock, userId, markRead])

  useEffect(() => {
    if (loading || !initialSectionTitle || pages.length === 0) return
    const needle = initialSectionTitle.toLowerCase().trim()
    const matchIdx = pages.findIndex((chunk) =>
      chunk.some((b) => JSON.stringify(b).toLowerCase().includes(needle)),
    )
    if (matchIdx >= 0) setPageIndex(matchIdx)
  }, [loading, initialSectionTitle, pages])

  useEffect(() => {
    const tg = getTelegramWebApp()
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    const prevMeta = metaTheme?.getAttribute('content')
    const updateTheme = () => {
      const isDark = document.body.dataset.theme === 'dark'
      const background = isDark ? '#141414' : '#ffffff'
      try {
        tg?.setHeaderColor?.(background)
        tg?.setBackgroundColor?.(background)
      } catch {}
      if (metaTheme) metaTheme.setAttribute('content', background)
    }
    updateTheme()
    const themeObserver = new MutationObserver(updateTheme)
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      themeObserver.disconnect()
      syncTelegramTheme(document.body.dataset.theme === 'dark')
      if (metaTheme && prevMeta) metaTheme.setAttribute('content', prevMeta)
    }
  }, [themeSetting])

  if (!selectedBlock) return null

  const scrollBodyTop = () => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
    } else if (blockContent) {
      const plain = blockContent.replace(/[#*`_~]/g, '').slice(0, 3000)
      speak(plain, 'ru')
      setSpeaking(true)
    }
  }

  const jumpToAuthor = (name: string) => {
    const needle = name.toLowerCase()
    const idx = pages.findIndex((chunk) =>
      chunk.some((b) => JSON.stringify(b).toLowerCase().includes(needle)),
    )
    if (idx >= 0) {
      setPageIndex(idx)
      scrollBodyTop()
    }
  }

  const handleAdvance = () => {
    stopSpeaking()
    setSpeaking(false)
    if (!isLastPage) {
      setPageIndex((p) => Math.min(p + 1, pageCount - 1))
      scrollBodyTop()
      return
    }
    onMarkDone()
    if (onNextEra) onNextEra()
    else onClose()
  }

  const authors = ERA_AUTHORS[selectedBlock.id] ?? []

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-pcanvas text-pfg">
      <BrilliantReaderHeader
        onClose={() => closeRef.current()}
        closeLabel={ru ? 'Закрыть' : 'Yopish'}
        current={safePageIndex + 1}
        total={pageCount}
        progressLabel={ru ? 'Прогресс чтения' : 'O‘qish progressi'}
        hot={isLastPage}
        trailing={
          <button
            type="button"
            onClick={toggleSpeech}
            className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors ${
              speaking ? 'bg-pprimary text-white' : 'bg-psurface text-pmuted hover:text-pfg'
            }`}
            aria-label={ru ? 'Озвучить' : 'Ovoz berish'}
          >
            {speaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        }
      />

      <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <article className="mx-auto w-full max-w-[560px] pb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <BrilliantStagePill stage={stage} />
              <span className="truncate text-[11.5px] font-bold text-pmuted">
                {ru ? `Эпоха ${selectedBlock.id}` : `Davr ${selectedBlock.id}`}
              </span>
            </div>
            <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-pmuted">
              {safePageIndex + 1} / {pageCount}
            </span>
          </div>

          <h1 className="mb-3 font-display text-[24px] font-extrabold leading-tight tracking-tight text-pfg sm:text-[28px]">
            {ru ? selectedBlock.titleRu : selectedBlock.titleUz}
          </h1>

          {authors.length > 1 && (
            <div className="no-scrollbar mb-5 flex items-center gap-2 overflow-x-auto pb-1">
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-pmuted">
                <User className="size-3 text-pprimary" />
                {ru ? 'Авторы:' : 'Mualliflar:'}
              </span>
              {authors.map((author) => (
                <button
                  type="button"
                  key={author.name}
                  onClick={() => jumpToAuthor(author.name)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-psurface px-2.5 py-1 text-[12px] font-semibold text-pfg transition-opacity active:opacity-75"
                >
                  <img
                    src={formatImageSrc(author.img) ?? author.img}
                    alt={author.name}
                    className="size-4 rounded-full object-cover"
                    loading="lazy"
                  />
                  <span>{author.name}</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col gap-2.5 rounded-3xl bg-pcard p-5" aria-busy="true">
              {[90, 100, 76, 86, 62].map((w, i) => (
                <div key={i} className="h-3.5 rounded-full bg-psurface" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <div key={safePageIndex} className="max-w-none text-[16.5px] leading-relaxed text-pfg">
              <MarkdownView blocks={currentBlocks} />
            </div>
          )}
        </article>
      </div>

      <div className="bg-pcanvas px-4 pb-[calc(0.875rem+var(--safe-bottom,0px))] pt-2.5">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-2.5">
          {safePageIndex > 0 && (
            <button
              type="button"
              onClick={() => {
                stopSpeaking()
                setSpeaking(false)
                setPageIndex((p) => Math.max(0, p - 1))
                scrollBodyTop()
              }}
              aria-label={ru ? 'Назад' : 'Orqaga'}
              className="grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-psurface text-pfg transition-[transform,opacity] active:translate-y-[1px]"
            >
              <ChevronLeft size={21} strokeWidth={2.25} />
            </button>
          )}
          <Button
            type="button"
            variant={isLastPage ? 'primary' : 'secondary'}
            size="lg"
            block
            className="min-w-0 flex-1"
            disabled={loading}
            onClick={handleAdvance}
          >
            {isLastPage ? (
              <>
                <CheckCircle2 size={18} strokeWidth={2.4} />
                <span>
                  {onNextEra
                    ? (ru ? 'Следующая эпоха' : 'Keyingi davr')
                    : (ru ? 'Завершить курс' : 'Kursni yakunlash')}
                </span>
              </>
            ) : (
              <>
                <span>{ru ? 'Продолжить' : 'Davom etish'}</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </>
            )}
          </Button>
          {isLastPage && isDone && (
            <Button variant="secondary" size="lg" onClick={onClose} className="shrink-0">
              {ru ? 'Карта' : 'Xarita'}
            </Button>
          )}
        </div>
      </div>

      <BrilliantExitDialog
        open={showExitConfirm}
        onStay={() => setShowExitConfirm(false)}
        onLeave={() => {
          setShowExitConfirm(false)
          onClose()
        }}
        mascot={<span className="relative block size-16"><PathMascot variant="avatar" animation="thinking" /></span>}
      />
    </div>
  )
}

export default function LiteratureCourseHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const ru = lang === 'ru'
  const userId = useAppStore((s) => s.user?.id) ?? 'guest'
  const byUser = useLessonsStore((s) => s.byUser[userId])
  const markDone = useLessonsStore((s) => s.markDone)
  const wasMap = useRef(false)

  const searchParams = new URLSearchParams(location.search)
  const requestedBlockId = Number(searchParams.get('block'))
  const requestedSectionRaw = searchParams.get('section')
  const requestedSection = requestedSectionRaw !== null && Number.isInteger(Number(requestedSectionRaw))
    ? Number(requestedSectionRaw)
    : undefined

  const { levels, blocks, passedKeys, completedCount, defaultLevelIndex } = useMemo(() => {
    let doneCount = 0
    const nextPassed = new Set<string>()
    const builtLevels: BrilliantCourseLevel[] = []
    const builtBlocks: CourseBlockMeta[] = []

    RUSADABIYOT_BLOCKS.forEach((block) => {
      const moduleKey = RUSADABIYOT_PROGRESS_MODULE_OFFSET + block.id
      const isDone = (byUser?.[moduleKey]?.length ?? 0) > 0
      if (isDone) doneCount += 1
      const outline = getRusadabiyotBlockOutline(block.id)
      const titles = outline.length > 0 ? outline : [ru ? block.titleRu : block.titleUz]

      const items = titles.map((title, idx) => {
        if (isDone) nextPassed.add(courseSectionKey(block.id, idx))
        return {
          key: `${block.id}:${idx}`,
          title,
          done: isDone,
          current: !isDone && idx === 0,
        }
      })

      builtLevels.push({
        id: block.id,
        titleUz: block.titleUz,
        titleRu: block.titleRu,
        levelLabelUz: `DAVR ${block.id}`,
        levelLabelRu: `ЭПОХА ${block.id}`,
        items,
      })

      builtBlocks.push({
        id: block.id,
        titleUz: block.titleUz,
        titleRu: block.titleRu,
        sections: items.map((item) => ({ key: item.key, title: item.title })),
      })
    })

    const firstIncomplete = builtLevels.findIndex((lvl) => lvl.items.some((i) => !i.done))
    return {
      levels: builtLevels,
      blocks: builtBlocks,
      passedKeys: nextPassed,
      completedCount: doneCount,
      defaultLevelIndex: firstIncomplete >= 0 ? firstIncomplete : Math.max(0, builtLevels.length - 1),
    }
  }, [byUser, ru])

  const selectedBlock = blocks.find((b) => b.id === requestedBlockId) ?? null

  useEffect(() => {
    if (!selectedBlock && wasMap.current) {
      scrollPageToTop()
    }
    wasMap.current = Boolean(selectedBlock)
  }, [selectedBlock])

  if (selectedBlock) {
    return (
      <BrilliantCourseMap
        key={`${selectedBlock.id}:${requestedSection ?? ''}`}
        subjectId={RUSSIAN_LITERATURE_SUBJECT_ID}
        blocks={blocks}
        progress={{
          passed: passedKeys,
          lockSequential: false,
          loading: false,
          error: false,
          refresh: () => {},
        }}
        courseTitle={ru ? 'Русская литература' : 'Rus adabiyoti'}
        courseSubtitle={ru ? 'Все эпохи и писатели' : 'Barcha davrlar va adiblar'}
        sectionCountLabel={ru ? 'тем' : 'mavzu'}
        unitLabelUz="DAVR"
        unitLabelRu="ЭПОХА"
        initialBlockId={selectedBlock.id}
        initialSectionIdx={requestedSection}
        includeUnitCheck={false}
        onBackHome={() => leaveCourseMap(navigate, location)}
        renderOverlay={(ctx) => {
          const currentIdx = RUSADABIYOT_BLOCKS.findIndex((b) => b.id === ctx.block.id)
          const nextEra = currentIdx >= 0 ? RUSADABIYOT_BLOCKS[currentIdx + 1] : undefined
          const isEraDone = (byUser?.[RUSADABIYOT_PROGRESS_MODULE_OFFSET + ctx.block.id]?.length ?? 0) > 0
          return (
            <LiteratureEraReaderOverlay
              blockId={ctx.block.id}
              initialSectionTitle={ctx.section.title}
              ru={ru}
              userId={userId}
              isDone={isEraDone}
              onMarkDone={() => markDone(userId, RUSADABIYOT_PROGRESS_MODULE_OFFSET + ctx.block.id, 0)}
              onNextEra={nextEra ? () => {
                ctx.close()
                navigate({ pathname: location.pathname, search: `?block=${nextEra.id}` }, { replace: true })
              } : undefined}
              onClose={ctx.close}
            />
          )
        }}
      />
    )
  }

  return (
    <BrilliantCourseHome
      subjectId={RUSSIAN_LITERATURE_SUBJECT_ID}
      levels={levels}
      completedCount={completedCount}
      defaultLevelIndex={defaultLevelIndex}
      testId="literature-course-home"
      cardLabelUz="Davr mavzulari"
      cardLabelRu="Темы эпохи"
      stageLabelUz="Davr tanlash"
      stageLabelRu="Выбор эпохи"
      onLaunchLevel={(level) => navigate({ pathname: location.pathname, search: `?block=${level.id}` }, { state: COURSE_HOME_BACK_STATE })}
    />
  )
}
