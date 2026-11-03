import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ChevronRight,
  X,
  Volume2,
  Sparkles,
  Play,
} from 'lucide-react'
import {
  RUSADABIYOT_BLOCKS,
  RUSADABIYOT_BLOCK_STATS,
  getRusadabiyotBlockOutline,
  loadRusadabiyotBlock,
  type DarslikBlockMeta,
} from '../../content/darslik-rusadabiyot'
import { useAppStore } from '../../shared/store/useAppStore'
import { parseMarkdown, type MdBlock } from '../darslik-rustili/markdown'
import { MarkdownView } from '../darslik-rustili/MarkdownView'
import { speak, stopSpeaking } from '../../shared/lib/speech'
import LiteratureBrilliantLesson from './LiteratureBrilliantLesson'
import { findAuthorPortrait } from './literature-brilliant-data'
import '../darslik-rustili/russian-course-home.css'

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

const ERA_GRADIENTS: Record<number, string> = {
  1: 'from-blue-600/20 via-indigo-600/10 to-transparent border-blue-500/30',
  2: 'from-amber-600/20 via-yellow-600/10 to-transparent border-amber-500/30',
  3: 'from-emerald-600/20 via-teal-600/10 to-transparent border-emerald-500/30',
  4: 'from-purple-600/20 via-fuchsia-600/10 to-transparent border-purple-500/30',
  5: 'from-rose-600/20 via-orange-600/10 to-transparent border-rose-500/30',
  6: 'from-cyan-600/20 via-sky-600/10 to-transparent border-cyan-500/30',
  7: 'from-red-600/20 via-rose-600/10 to-transparent border-red-500/30',
  8: 'from-orange-600/20 via-amber-600/10 to-transparent border-orange-500/30',
  9: 'from-violet-600/20 via-purple-600/10 to-transparent border-violet-500/30',
}

export default function LiteratureCourseHome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lang = useAppStore((s) => s.settings.language)

  const [selectedBlock, setSelectedBlock] = useState<DarslikBlockMeta | null>(null)
  const [viewMode, setViewMode] = useState<'brilliant' | 'reference'>('brilliant')
  const [activeBrilliantTopic, setActiveBrilliantTopic] = useState<{ index: number; title: string } | null>(null)

  const [blockContent, setBlockContent] = useState<string>('')
  const [blocksParsed, setBlocksParsed] = useState<MdBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const readerTopRef = useRef<HTMLDivElement>(null)

  const ru = lang === 'ru'

  // URL parametrlari orqali avtomatik ochish (?block=1&topic=1)
  useEffect(() => {
    const b = searchParams.get('block')
    const t = searchParams.get('topic')
    if (b) {
      const blockNum = Number(b)
      const found = RUSADABIYOT_BLOCKS.find((x) => x.id === blockNum)
      if (found) {
        setSelectedBlock(found)
        if (t !== null) {
          const tIdx = Number(t)
          const outline = getRusadabiyotBlockOutline(found.id)
          const title = outline[tIdx] || `Тема ${tIdx + 1}`
          setActiveBrilliantTopic({ index: tIdx, title })
        }
      }
    }
  }, [searchParams])

  // Blok yuklash
  useEffect(() => {
    if (!selectedBlock) {
      setBlockContent('')
      setBlocksParsed([])
      stopSpeaking()
      setSpeaking(false)
      return
    }

    if (viewMode === 'reference' && !blockContent) {
      setLoading(true)
      loadRusadabiyotBlock(selectedBlock.id)
        .then((text) => {
          setBlockContent(text)
          setBlocksParsed(parseMarkdown(text))
        })
        .catch((err) => {
          console.error('Failed to load block:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [selectedBlock, viewMode, blockContent])

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

  const currentOutline = selectedBlock ? getRusadabiyotBlockOutline(selectedBlock.id) : []

  // Keyingi mavzuga o'tish
  const handleNextBrilliantTopic = () => {
    if (!selectedBlock || activeBrilliantTopic === null) return
    const nextIdx = activeBrilliantTopic.index + 1
    if (nextIdx < currentOutline.length) {
      setActiveBrilliantTopic({
        index: nextIdx,
        title: currentOutline[nextIdx],
      })
    } else {
      setActiveBrilliantTopic(null)
    }
  }

  return (
    <div className="russian-course-home min-h-screen pb-20">
      {/* Brilliant Interaktiv Dars Modali */}
      {selectedBlock && activeBrilliantTopic && (
        <LiteratureBrilliantLesson
          blockId={selectedBlock.id}
          topicIndex={activeBrilliantTopic.index}
          topicTitle={activeBrilliantTopic.title}
          onClose={() => setActiveBrilliantTopic(null)}
          onNextTopic={
            activeBrilliantTopic.index + 1 < currentOutline.length
              ? handleNextBrilliantTopic
              : undefined
          }
        />
      )}

      {/* Header */}
      <header className="sticky top-[var(--safe-top,0px)] z-20 flex items-center justify-between px-4 py-3 bg-[var(--surface-primary,#121826)]/95 backdrop-blur-md border-b border-[var(--border-subtle,#1e293b)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (selectedBlock ? setSelectedBlock(null) : navigate(-1))}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 transition-colors cursor-pointer"
            aria-label={ru ? 'Назад' : 'Orqaga'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span>{ru ? 'Русская литература' : 'Rus adabiyoti'}</span>
            </h1>
            <p className="text-xs text-slate-400">
              {ru
                ? 'Интерактивный Brilliant-курс для аттестации'
                : 'Attestatsiya uchun Brilliant uslubidagi interaktiv darslik'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6" ref={readerTopRef}>
        {!selectedBlock ? (
          <div>
            {/* Hero Welcome Banner */}
            <div className="mb-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-purple-900/40 via-indigo-950/30 to-slate-900/60 border border-purple-500/30 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{ru ? '9 эпох в стиле Brilliant' : 'Brilliant uslubidagi 9 davr'}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 mb-2 leading-snug">
                  {ru
                    ? 'Интерактивный курс русской литературы'
                    : 'Rus adabiyotining to‘liq interaktiv darsligi'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  {ru
                    ? 'Каждая тема разбита на пошаговые карточки: краткая теория, подлинные портреты классиков, интерактивные контрольные вопросы с мгновенной проверкой и разбором экзаменационных ловушек.'
                    : "Har bir mavzu qadamma-qadam kartochkalarga ajratilgan: qisqa tushunarli nazariya, klassiklarning asl portretlari, matn ichidagi tezkor testlar va imtihon tuzoqlari tahlili."}
                </p>
              </div>
            </div>

            {/* Eras Cards Grid */}
            <div className="space-y-4">
              {RUSADABIYOT_BLOCKS.map((block) => {
                const stats = RUSADABIYOT_BLOCK_STATS[block.id]
                const outline = getRusadabiyotBlockOutline(block.id)
                const authors = ERA_AUTHORS[block.id] || []
                const gradient = ERA_GRADIENTS[block.id] || 'from-purple-900/30 to-slate-900/40'

                return (
                  <button
                    key={block.id}
                    onClick={() => {
                      setSelectedBlock(block)
                      setViewMode('brilliant')
                    }}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${gradient} bg-slate-900/60 hover:bg-slate-800/80 border transition-all duration-300 group hover:scale-[1.01] hover:shadow-xl cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header Badge */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                            {block.icon}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                            {ru ? `Эпоха ${block.id}` : `${block.id}-davr`}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                          {ru ? block.titleRu : block.titleUz}
                        </h3>

                        {/* Summary */}
                        <p className="text-xs text-slate-300 line-clamp-2 mt-1.5 leading-relaxed">
                          {ru ? block.summaryRu : block.summaryUz}
                        </p>

                        {/* Author Avatars Row */}
                        {authors.length > 0 && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/60">
                            <div className="flex items-center -space-x-2 overflow-hidden">
                              {authors.slice(0, 5).map((a, i) => (
                                <img
                                  key={i}
                                  src={a.img}
                                  alt={a.name}
                                  className="inline-block size-7 rounded-full ring-2 ring-slate-900 object-cover bg-slate-800"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 truncate">
                              {authors.map((a) => a.name).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Stats Badges */}
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 font-medium">
                            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                            {stats?.sections ?? outline.length} {ru ? 'тем' : 'mavzu'}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            {stats?.minutes ?? 30} {ru ? 'мин интерактив' : 'daqiqa'}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all shrink-0 mt-3" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Bar for Selected Era */}
            <div className="sticky top-[57px] z-10 -mx-4 px-4 py-3 bg-[var(--surface-primary,#121826)]/95 backdrop-blur-md border-b border-slate-800 shadow-md">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    {ru ? `Эпоха ${selectedBlock.id}` : `${selectedBlock.id}-davr`}
                  </span>
                  <h2 className="text-base font-bold text-slate-100 truncate">
                    {ru ? selectedBlock.titleRu : selectedBlock.titleUz}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedBlock(null)}
                    className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                    aria-label={ru ? 'Закрыть' : 'Yopish'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View Mode Toggle: Brilliant vs Full Reference */}
              <div className="flex items-center gap-2 border-t border-slate-800/80 pt-2.5">
                <button
                  type="button"
                  onClick={() => setViewMode('brilliant')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'brilliant'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>{ru ? 'Brilliant уроки' : 'Brilliant darslar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('reference')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'reference'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>{ru ? 'Полный конспект' : "To'liq konspekt"}</span>
                </button>
              </div>
            </div>

            {/* BRILLIANT MODE: List of Topics with Interactive Launchers */}
            {viewMode === 'brilliant' ? (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-purple-500/10 shrink-0">✨</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {ru ? 'Пошаговые интерактивные карточки' : 'Qadamma-qadam interaktiv kartochkalar'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ru
                        ? 'Выберите любую тему, чтобы начать интерактивный урок с вопросами и портретами'
                        : 'Mavzuni tanlang va Brilliant uslubida o‘rganishni boshlang'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {currentOutline.map((topicTitle, idx) => {
                    const portrait = findAuthorPortrait(topicTitle)

                    return (
                      <div
                        key={idx}
                        className="group flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/40 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {portrait ? (
                            <img
                              src={portrait.img}
                              alt={portrait.name}
                              className="size-11 rounded-xl object-cover ring-2 ring-purple-500/30 shrink-0"
                            />
                          ) : (
                            <span className="grid size-11 place-items-center rounded-xl bg-purple-500/10 text-purple-400 font-extrabold text-sm shrink-0">
                              {idx + 1}
                            </span>
                          )}

                          <div className="min-w-0">
                            <h4 className="text-sm sm:text-base font-bold text-slate-100 truncate group-hover:text-purple-300 transition-colors">
                              {topicTitle}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1 font-medium text-purple-400">
                                <Sparkles size={12} />
                                <span>{ru ? 'Brilliant-урок' : 'Brilliant dars'}</span>
                              </span>
                              <span>•</span>
                              <span>~4 мин</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveBrilliantTopic({ index: idx, title: topicTitle })}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs sm:text-sm shrink-0 transition-transform cursor-pointer shadow-md"
                        >
                          <Play size={14} className="fill-white" />
                          <span>{ru ? 'Начать' : 'Boshlash'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* REFERENCE MODE: Full Markdown */
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">
                    {ru ? 'Академический полный текст' : 'Akademik to‘liq matn'}
                  </span>
                  <button
                    onClick={toggleSpeech}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      speaking
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{speaking ? (ru ? 'Остановить' : "To'xtatish") : (ru ? 'Озвучить' : 'Ovoz berish')}</span>
                  </button>
                </div>

                {loading ? (
                  <div className="py-24 text-center">
                    <div className="inline-block size-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent mb-3" />
                    <p className="text-slate-400 text-sm font-medium">
                      {ru ? 'Загрузка академического конспекта...' : 'Akademik konspekt yuklanmoqda...'}
                    </p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none text-slate-200">
                    <MarkdownView blocks={blocksParsed} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
