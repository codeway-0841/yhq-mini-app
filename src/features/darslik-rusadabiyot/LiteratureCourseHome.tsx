import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, ChevronRight, X, Volume2, Sparkles, User } from 'lucide-react'
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
  const lang = useAppStore((s) => s.settings.language)
  const [selectedBlock, setSelectedBlock] = useState<DarslikBlockMeta | null>(null)
  const [blockContent, setBlockContent] = useState<string>('')
  const [blocksParsed, setBlocksParsed] = useState<MdBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const readerTopRef = useRef<HTMLDivElement>(null)

  const ru = lang === 'ru'

  useEffect(() => {
    if (!selectedBlock) {
      setBlockContent('')
      setBlocksParsed([])
      stopSpeaking()
      setSpeaking(false)
      return
    }
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
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
  }, [selectedBlock])

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

  return (
    <div className="russian-course-home min-h-screen pb-20 bg-pcanvas text-pfg">
      {/* Header */}
      <header className="sticky top-0 z-20 -mt-[var(--safe-top-body,0px)] pt-[calc(0.75rem+var(--safe-top,0px))] pb-3 px-4 flex items-center justify-between bg-pcanvas border-b border-pline">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (selectedBlock ? setSelectedBlock(null) : navigate(-1))}
            className="flex size-10 shrink-0 items-center justify-center -ml-1 text-pfg hover:opacity-80 active:scale-90 transition-transform cursor-pointer"
            aria-label={ru ? 'Назад' : 'Orqaga'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-pfg flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span>{ru ? 'Русская классическая литература' : 'Rus mumtoz adabiyoti'}</span>
            </h1>
            <p className="text-xs text-pmuted">
              {ru
                ? 'Иллюстрированный академический курс для учителей'
                : "O'qituvchilar uchun rasmli akademik darslik"}
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
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{ru ? '9 эпох русской словесности' : 'Rus adabiyotining 9 davri'}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 mb-2 leading-snug">
                  {ru
                    ? 'Полный иллюстрированный курс для аттестации'
                    : 'Attestatsiya uchun to‘liq rasmli qo‘llanma'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  {ru
                    ? 'От древнерусских летописей и классицизма до Золотого и Серебряного веков, военной прозы и современности. Подлинные портреты классиков, конспекты, экзаменационные ловушки и интерактивные тесты.'
                    : "Qadimgi rus qo'lyozmalaridan to Oltin va Kumush davrlar, urush adabiyoti va zamonaviy davrgacha. Klassiklarning asl portretlari, tahlillar, imtihon tuzoqlari va interaktiv testlar."}
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
                    onClick={() => setSelectedBlock(block)}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${gradient} bg-slate-900/60 hover:bg-slate-800/80 border transition-all duration-300 group hover:scale-[1.01] hover:shadow-xl`}
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
                            {stats?.minutes ?? 30} {ru ? 'мин чтения' : 'daqiqa'}
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
            {/* Block Reader Top Bar */}
            <div className="sticky top-[57px] z-10 -mx-4 px-4 py-3 bg-[var(--surface-primary,#121826)] border-b border-slate-800 shadow-md">
              <div className="flex items-center justify-between gap-3">
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
                    onClick={toggleSpeech}
                    className={`p-2 rounded-xl transition-colors ${
                      speaking
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    aria-label={ru ? 'Озвучить' : 'Ovoz berish'}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedBlock(null)}
                    className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                    aria-label={ru ? 'Закрыть' : 'Yopish'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Jump Authors Carousel */}
              {ERA_AUTHORS[selectedBlock.id] && ERA_AUTHORS[selectedBlock.id].length > 1 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
                    <User className="size-3 text-purple-400" />
                    {ru ? 'Авторы:' : 'Mualliflar:'}
                  </span>
                  {ERA_AUTHORS[selectedBlock.id].map((author, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToAuthor(author.name)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-purple-900/40 border border-slate-700/60 hover:border-purple-500/40 text-xs font-medium text-slate-200 transition-all shrink-0 active:scale-95"
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
      </main>
    </div>
  )
}
