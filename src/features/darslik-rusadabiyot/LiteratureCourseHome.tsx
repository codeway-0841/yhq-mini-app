import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, User, Volume2 } from 'lucide-react'
import { RUSSIAN_LITERATURE_SUBJECT_ID } from '../../../shared/subjects'
import {
  RUSADABIYOT_BLOCKS,
  RUSADABIYOT_PROGRESS_MODULE_OFFSET,
  getRusadabiyotBlockOutline,
  loadRusadabiyotBlock,
} from '../../content/darslik-rusadabiyot'
import { getTelegramWebApp, syncTelegramTheme } from '../../platform/telegram'
import { scrollPageToTop } from '../../shared/lib/page-scroll'
import { speak, stopSpeaking } from '../../shared/lib/speech'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../shared/store/useLessonsStore'
import { Button } from '../../shared/components/ui/button'
import { MarkdownView, parseMarkdown, type MdBlock } from '../darslik-rustili'
import { BrilliantCourseHome, type BrilliantCourseLevel } from '../lessons'

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

export default function LiteratureCourseHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useAppStore((s) => s.settings.language)
  const themeSetting = useAppStore((s) => s.settings.theme)
  const ru = lang === 'ru'
  const userId = useAppStore((s) => s.user?.id) ?? 'guest'
  const byUser = useLessonsStore((s) => s.byUser[userId])
  const markDone = useLessonsStore((s) => s.markDone)
  const markRead = useLessonsStore((s) => s.markRead)

  const requestedBlockId = Number(new URLSearchParams(location.search).get('block'))
  const selectedBlock = RUSADABIYOT_BLOCKS.find((b) => b.id === requestedBlockId) ?? null

  const [blockContent, setBlockContent] = useState('')
  const [blocksParsed, setBlocksParsed] = useState<MdBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const wasReader = useRef(false)

  useEffect(() => {
    if (!selectedBlock) {
      setBlockContent('')
      setBlocksParsed([])
      stopSpeaking()
      setSpeaking(false)
      if (wasReader.current) scrollPageToTop()
      wasReader.current = false
      return
    }
    wasReader.current = true
    markRead(userId, RUSADABIYOT_PROGRESS_MODULE_OFFSET + selectedBlock.id, 0)
    let cancelled = false
    setLoading(true)
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
        scrollPageToTop()
      })
    return () => {
      cancelled = true
    }
  }, [selectedBlock, userId, markRead])

  useEffect(() => {
    if (!selectedBlock) return
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
  }, [selectedBlock, themeSetting])

  const { levels, completedCount, defaultLevelIndex } = useMemo(() => {
    let doneCount = 0
    const builtLevels: BrilliantCourseLevel[] = RUSADABIYOT_BLOCKS.map((block) => {
      const moduleKey = RUSADABIYOT_PROGRESS_MODULE_OFFSET + block.id
      const isDone = (byUser?.[moduleKey]?.length ?? 0) > 0
      if (isDone) doneCount += 1
      const outline = getRusadabiyotBlockOutline(block.id)
      const titles = outline.length > 0 ? outline : [ru ? block.titleRu : block.titleUz]
      return {
        id: block.id,
        titleUz: block.titleUz,
        titleRu: block.titleRu,
        levelLabelUz: `DAVR ${block.id}`,
        levelLabelRu: `ЭПОХА ${block.id}`,
        items: titles.map((title, idx) => ({
          key: `${block.id}:${idx}`,
          title,
          done: isDone,
          current: !isDone && idx === 0,
        })),
      }
    })
    const firstIncomplete = builtLevels.findIndex((lvl) => lvl.items.some((i) => !i.done))
    return {
      levels: builtLevels,
      completedCount: doneCount,
      defaultLevelIndex: firstIncomplete >= 0 ? firstIncomplete : Math.max(0, builtLevels.length - 1),
    }
  }, [byUser, ru])

  if (!selectedBlock) {
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
        onLaunchLevel={(level) => navigate({ pathname: location.pathname, search: `?block=${level.id}` })}
      />
    )
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

  const scrollToAuthor = (name: string) => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, figure')
    for (const h of headings) {
      if (h.textContent?.toLowerCase().includes(name.toLowerCase())) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  }

  const currentIdx = RUSADABIYOT_BLOCKS.findIndex((b) => b.id === selectedBlock.id)
  const nextBlock = currentIdx >= 0 ? RUSADABIYOT_BLOCKS[currentIdx + 1] : undefined
  const isSelectedDone = (byUser?.[RUSADABIYOT_PROGRESS_MODULE_OFFSET + selectedBlock.id]?.length ?? 0) > 0

  const handleCompleteEra = () => {
    markDone(userId, RUSADABIYOT_PROGRESS_MODULE_OFFSET + selectedBlock.id, 0)
    if (nextBlock) {
      navigate({ pathname: location.pathname, search: `?block=${nextBlock.id}` }, { replace: true })
    } else {
      navigate({ pathname: location.pathname }, { replace: true })
    }
  }

  const authors = ERA_AUTHORS[selectedBlock.id] ?? []

  return (
    <div className="min-h-screen pb-24 bg-pcanvas text-pfg">
      <header className="sticky top-0 z-20 -mt-[var(--safe-top-body,0px)] pt-[calc(0.75rem+var(--safe-top,0px))] pb-3 px-4 bg-pcanvas">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate({ pathname: location.pathname }, { replace: true })}
              className="flex size-10 shrink-0 items-center justify-center -ml-1 rounded-xl text-pfg hover:bg-psurface active:scale-90 transition-all cursor-pointer"
              aria-label={ru ? 'Назад' : 'Orqaga'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-pprimary">
                {ru ? `Эпоха ${selectedBlock.id}` : `Davr ${selectedBlock.id}`}
              </div>
              <h1 className="text-base font-bold text-pfg truncate">
                {ru ? selectedBlock.titleRu : selectedBlock.titleUz}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSpeech}
            className={`size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              speaking
                ? 'bg-pprimary text-white'
                : 'bg-psurface text-pmuted hover:text-pfg'
            }`}
            aria-label={ru ? 'Озвучить' : 'Ovoz berish'}
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {authors.length > 1 && (
          <div className="max-w-3xl mx-auto mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-semibold text-pmuted shrink-0 flex items-center gap-1">
              <User className="size-3 text-pprimary" />
              {ru ? 'Авторы:' : 'Mualliflar:'}
            </span>
            {authors.map((author) => (
              <button
                type="button"
                key={author.name}
                onClick={() => scrollToAuthor(author.name)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-psurface text-xs font-medium text-pfg transition-transform shrink-0 active:scale-95 cursor-pointer"
              >
                <img
                  src={author.img}
                  alt={author.name}
                  className="size-4 rounded-full object-cover"
                  loading="lazy"
                />
                <span>{author.name}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block size-8 animate-spin rounded-full border-2 border-pprimary border-t-transparent mb-3" />
            <p className="text-pmuted text-sm font-medium">
              {ru ? 'Загрузка академического конспекта...' : 'Akademik konspekt yuklanmoqda...'}
            </p>
          </div>
        ) : (
          <>
            <div className="max-w-none text-pfg">
              <MarkdownView blocks={blocksParsed} />
            </div>

            <div className="mt-8 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button variant="primary" size="lg" className="flex-1" onClick={handleCompleteEra}>
                <CheckCircle2 className="w-4 h-4 mr-1.5 inline-block" />
                {nextBlock
                  ? (ru ? 'Завершить и перейти дальше' : 'Tugatish va keyingisiga o‘tish')
                  : (ru ? 'Завершить курс' : 'Kursni yakunlash')}
              </Button>
              {isSelectedDone && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate({ pathname: location.pathname }, { replace: true })}
                >
                  {ru ? 'К списку эпох' : 'Davrlar ro‘yxatiga'}
                </Button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
