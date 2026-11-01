import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, ChevronRight, X, Volume2 } from 'lucide-react'
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

export default function LiteratureCourseHome() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const [selectedBlock, setSelectedBlock] = useState<DarslikBlockMeta | null>(null)
  const [blockContent, setBlockContent] = useState<string>('')
  const [blocksParsed, setBlocksParsed] = useState<MdBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)

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
      .finally(() => setLoading(false))
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

  return (
    <div className="russian-course-home min-h-screen pb-16">
      {/* Header */}
      <header className="sticky top-[var(--safe-top,0px)] z-20 flex items-center justify-between px-4 py-3 bg-[var(--surface-primary,#121826)]/90 backdrop-blur border-b border-[var(--border-subtle,#1e293b)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (selectedBlock ? setSelectedBlock(null) : navigate(-1))}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 transition-colors"
            aria-label={ru ? 'Назад' : 'Orqaga'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>📖</span>
              <span>{ru ? 'Русская литература' : 'Rus adabiyoti'}</span>
            </h1>
            <p className="text-xs text-slate-400">
              {ru
                ? 'Хронологический курс для аттестации'
                : 'Attestatsiya uchun xronologik darslik'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {!selectedBlock ? (
          <div>
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-900/40 to-slate-900/60 border border-purple-500/20">
              <h2 className="text-base font-semibold text-purple-200 mb-1 flex items-center gap-2">
                <span>🏛️</span>
                <span>{ru ? 'Периоды русской литературы' : 'Rus adabiyoti davrlari'}</span>
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {ru
                  ? 'Все темы сгруппированы строго по историческим эпохам: от древнерусских летописей и классицизма XVIII века до Серебряного века, военной прозы и современности.'
                  : "Barcha mavzular qat'iy tarixiy davrlar bo'yicha guruhlangan: qadimgi rus qo'lyozmalari va XVIII asrdan to Kumush davr, urush adabiyoti va bugungi kungacha."}
              </p>
            </div>

            <div className="space-y-3">
              {RUSADABIYOT_BLOCKS.map((block) => {
                const stats = RUSADABIYOT_BLOCK_STATS[block.id]
                const outline = getRusadabiyotBlockOutline(block.id)
                return (
                  <button
                    key={block.id}
                    onClick={() => setSelectedBlock(block)}
                    className="w-full text-left p-4 rounded-2xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 hover:border-purple-500/40 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0">
                          {block.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-0.5">
                            {ru ? `Блок ${block.id}` : `${block.id}-blok`}
                          </div>
                          <h3 className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                            {ru ? block.titleRu : block.titleUz}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {ru ? block.summaryRu : block.summaryUz}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                              {stats?.sections ?? outline.length} {ru ? 'тем' : 'mavzu'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-purple-400" />
                              {stats?.minutes ?? 30} {ru ? 'мин' : 'daq'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors shrink-0 mt-2" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Block Reader View */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-purple-400">
                  {ru ? `Блок ${selectedBlock.id}` : `${selectedBlock.id}-blok`}
                </span>
                <h2 className="text-lg font-bold text-slate-100">
                  {ru ? selectedBlock.titleRu : selectedBlock.titleUz}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSpeech}
                  className={`p-2 rounded-xl transition-colors ${
                    speaking
                      ? 'bg-purple-600 text-white'
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

            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                {ru ? 'Загрузка конспекта...' : 'Konspekt yuklanmoqda...'}
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
