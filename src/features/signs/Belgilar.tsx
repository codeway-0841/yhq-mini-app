import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack, registerModal } from '../../shared/lib/navigation'
import { X, Search, ChevronLeft, TrafficCone, Gamepad2, Layers, BookOpen, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { signCategories, getSignsByCategory, searchSigns, type RoadSign, type SignCategory } from '../../content/signs'
import { rulesChapters } from '../../content/rules'
import { getSignCategoryIcon } from '../../shared/config/sign-category-icons'
import { useAppStore } from '../../shared/store/useAppStore'
import DialogOverlay from '../../shared/components/DialogOverlay'

function renderBoldText(str: string) {
  const parts = str.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-pfg">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function FormattedDescription({ text, lang }: { text: string; lang: 'uz' | 'ru' }) {
  if (!text) {
    return (
      <p className="text-pmuted text-center">
        {lang === 'ru'
          ? 'Дополнительная информация по этому знаку отсутствует.'
          : "Ushbu belgi bo'yicha qo'shimcha ma'lumot mavjud emas."}
      </p>
    )
  }
  const paragraphs = text.split(/\n\s*\n/)
  return (
    <div className="space-y-2.5 text-[13.5px] text-pfg leading-relaxed">
      {paragraphs.map((p, i) => {
        const trimmed = p.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim())
          return (
            <ul key={i} className="list-disc list-inside space-y-1">
              {items.map((it, idx) => (
                <li key={idx}>{renderBoldText(it)}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{renderBoldText(trimmed)}</p>
      })}
    </div>
  )
}

function SignModal({ sign, onClose, lang }: { sign: RoadSign; onClose: () => void; lang: 'uz' | 'ru' }) {
  const isRu = lang === 'ru'
  const signName = isRu ? (sign.nameRu || sign.name) : sign.name
  const signDesc = isRu ? (sign.descriptionRu || sign.description) : sign.description
  const legalRef = isRu ? `ПДД Приложение 1 ${sign.code}` : sign.legalRef

  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="sign-modal-title">
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-pprimary px-2.5 py-1 bg-pprimary/10 rounded-control border border-pprimary/20">
            {sign.code}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
            aria-label={isRu ? 'Закрыть' : 'Yopish'}
          >
            <X size={16} />
          </button>
        </div>
        <div className="w-40 h-40 mx-auto rounded-container bg-white/95 border border-pline shadow-inner flex items-center justify-center mb-4 p-3">
          {sign.image ? (
            <img src={sign.image} alt={signName} className="w-full h-full object-contain" />
          ) : (
            <TrafficCone size={48} strokeWidth={1.5} className="text-stone-400" />
          )}
        </div>
        <h3 id="sign-modal-title" className="text-center font-display font-semibold text-lg text-pfg mb-1">
          {signName}
        </h3>
        <p className="text-center text-xs text-pmuted mb-4 font-medium">{legalRef}</p>
        <div className="bg-pcanvas/60 border border-pline p-4 rounded-container mb-5">
          <FormattedDescription text={signDesc} lang={lang} />
        </div>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-control bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-all"
        >
          {isRu ? 'Закрыть' : 'Yopish'}
        </button>
      </div>
    </DialogOverlay>
  )
}

function CategoryGrid({ onSelect, lang }: { onSelect: (cat: SignCategory) => void; lang: 'uz' | 'ru' }) {
  const isRu = lang === 'ru'
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {signCategories.map((cat) => {
        const Icon = getSignCategoryIcon(cat.id)
        const catName = isRu ? (cat.nameRu || cat.name) : cat.name
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            className="flex items-center gap-3.5 rounded-container border border-pline bg-psurface p-3.5 active:scale-[0.98] transition-all text-left hover:border-plineStrong shadow-xs"
          >
            <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-control border border-pline bg-pcard overflow-hidden">
              {cat.image ? (
                <img src={cat.image} alt={catName} className="w-7 h-7 object-contain" />
              ) : (
                <Icon size={22} strokeWidth={1.75} style={{ color: cat.color }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight text-pfg truncate">{catName}</p>
              <p className="text-xs text-pmuted mt-1 font-medium">
                {cat.count} {isRu ? 'знаков' : 'ta belgi'}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SignsGrid({
  category,
  onBack,
  onSignSelect,
  lang,
}: {
  category: SignCategory
  onBack: () => void
  onSignSelect: (sign: RoadSign) => void
  lang: 'uz' | 'ru'
}) {
  const signs = getSignsByCategory(category.id)
  const isRu = lang === 'ru'
  const categoryName = isRu ? (category.nameRu || category.name) : category.name

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          aria-label={isRu ? 'Назад' : 'Orqaga'}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h2 className="text-base font-semibold text-pfg truncate">{categoryName}</h2>
        <span className="text-xs text-pmuted ml-auto bg-psurface border border-pline px-2.5 py-1 rounded-control flex-shrink-0">
          {category.count} {isRu ? 'знаков' : 'ta'}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {signs.map((sign) => {
          const signName = isRu ? (sign.nameRu || sign.name) : sign.name
          return (
            <button
              key={sign.id}
              onClick={() => onSignSelect(sign)}
              className="flex flex-col items-center rounded-container border border-pline bg-psurface p-2.5 active:scale-95 transition-transform hover:border-plineStrong shadow-xs text-center"
            >
              <div className="w-16 h-16 rounded-control bg-white/95 shadow-xs flex items-center justify-center mb-2 p-1.5 overflow-hidden">
                {sign.image ? (
                  <img src={sign.image} alt={signName} className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <TrafficCone size={24} strokeWidth={1.5} className="text-stone-400" />
                )}
              </div>
              <span className="text-[11px] font-bold text-pprimary mb-0.5">{sign.code}</span>
              <span className="text-[10px] text-pmuted leading-tight line-clamp-2">
                {signName.replace(/^\d+(\.\d+)*\.\s*/, '')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Qidiruv natijalari */
function SearchGrid({
  query,
  onSignSelect,
  lang,
}: {
  query: string
  onSignSelect: (sign: RoadSign) => void
  lang: 'uz' | 'ru'
}) {
  const results = useMemo(() => searchSigns(query), [query])
  const isRu = lang === 'ru'

  if (results.length === 0) {
    return (
      <p className="text-center text-sm text-pmuted py-10">
        {isRu ? 'Знаки не найдены' : 'Hech qanday belgi topilmadi'}
      </p>
    )
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {results.map((sign) => {
        const signName = isRu ? (sign.nameRu || sign.name) : sign.name
        return (
          <button
            key={sign.id}
            onClick={() => onSignSelect(sign)}
            className="flex flex-col items-center rounded-container border border-pline bg-psurface p-2.5 active:scale-95 transition-transform hover:border-plineStrong shadow-xs text-center"
          >
            <div className="w-16 h-16 rounded-control bg-white/95 shadow-xs flex items-center justify-center mb-2 p-1.5 overflow-hidden">
              {sign.image ? (
                <img src={sign.image} alt={signName} className="w-full h-full object-contain" loading="lazy" />
              ) : (
                <TrafficCone size={24} strokeWidth={1.5} className="text-stone-400" />
              )}
            </div>
            <span className="text-[11px] font-bold text-pprimary mb-0.5">{sign.code}</span>
            <span className="text-[10px] text-pmuted leading-tight line-clamp-2">
              {signName.replace(/^\d+(\.\d+)*\.\s*/, '')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Qoidalar va Jarimalar bo'limi */
function RulesSection({ query, lang }: { query: string; lang: 'uz' | 'ru' }) {
  const [expandedChapter, setExpandedChapter] = useState<number | null>(1)
  const isRu = lang === 'ru'

  const filteredChapters = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rulesChapters
    return rulesChapters
      .map((ch) => {
        const matchedArticles = ch.articles.filter(
          (art) => art.id.toLowerCase().includes(q) || art.text.toLowerCase().includes(q)
        )
        if (ch.title.toLowerCase().includes(q)) return ch
        if (matchedArticles.length > 0) return { ...ch, articles: matchedArticles }
        return null
      })
      .filter(Boolean) as typeof rulesChapters
  }, [query])

  if (filteredChapters.length === 0) {
    return (
      <p className="text-center text-sm text-pmuted py-10">
        {isRu ? 'Ничего не найдено' : 'Hech narsa topilmadi'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filteredChapters.map((ch) => {
        const isExpanded = expandedChapter === ch.chapter || query.trim().length > 0
        const isFines = ch.chapter === 30
        return (
          <div key={ch.chapter} className="rounded-container border border-pline bg-psurface overflow-hidden shadow-xs">
            <button
              onClick={() => setExpandedChapter(isExpanded && !query.trim() ? null : ch.chapter)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-pcanvas/30 transition-colors"
            >
              <div className="flex items-center gap-3.5 pr-2">
                {isFines ? (
                  <ShieldAlert size={20} strokeWidth={1.75} className="shrink-0 text-pwarning" />
                ) : (
                  <BookOpen size={20} strokeWidth={1.75} className="shrink-0 text-pmuted" />
                )}
                <div>
                  <h3 className="text-[14px] font-semibold text-pfg leading-snug">{ch.title}</h3>
                  <p className="text-[11px] text-pmuted">
                    {ch.articles.length} {isRu ? 'пунктов' : 'ta band'}
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp size={18} className="text-pmuted flex-shrink-0" />
              ) : (
                <ChevronDown size={18} className="text-pmuted flex-shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-pline px-4 py-3 bg-pcanvas/40 flex flex-col gap-3">
                {ch.articles.map((art) => (
                  <div key={art.id} className="p-3 rounded-control bg-psurface border border-pline">
                    <span
                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-control mb-1.5 ${
                        isFines ? 'bg-pwarning/15 text-pwarning border border-pwarning/30' : 'bg-pprimary/10 text-pprimary'
                      }`}
                    >
                      {art.id.startsWith('J-') ? art.id : (isRu ? `Пункт ${art.id}` : `${art.id}-band`)}
                    </span>
                    <p className="text-[13px] text-pfg leading-relaxed whitespace-pre-wrap">{art.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Belgilar() {
  const [activeTab, setActiveTab]               = useState<'signs' | 'rules'>('signs')
  const [selectedCategory, setSelectedCategory] = useState<SignCategory | null>(null)
  const [selectedSign, setSelectedSign]         = useState<RoadSign | null>(null)
  const [query, setQuery]                       = useState('')
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const isRu = lang === 'ru'
  // Kategoriya ochilganda orqaga bosilsa umumiy ro'yxatga qaytish
  useEffect(() => {
    if (!selectedCategory) return
    const id = Symbol('signs-category')
    const unregister = registerModal(id, () => {
      setSelectedCategory(null)
    })
    return () => {
      unregister()
    }
  }, [selectedCategory])

  const totalSignsCount = useMemo(() => signCategories.reduce((s, c) => s + c.count, 0), [])

  return (
    <div className="px-4 pb-4">
      {!selectedCategory && (
        <>
          <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
            <button
              onClick={() => goBack(navigate)}
              aria-label={isRu ? 'Назад' : 'Orqaga'}
              className="grid size-10 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            <h1 className="flex-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-pfg">
              {isRu ? 'Правила и знаки' : "Yo'l qoidalari"}
            </h1>
            <button
              onClick={() => navigate('/belgilar-oyini')}
              className="h-[32px] px-2.5 rounded-control bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-all flex items-center gap-1 text-[11.5px]"
            >
              <Gamepad2 size={13} strokeWidth={1.75} /> {isRu ? 'Игра' : "O'yin"}
            </button>
            <button
              onClick={() => navigate('/flashcards')}
              className="h-[32px] px-2.5 rounded-control bg-psurface border border-pline text-pfg font-semibold hover:bg-plineStrong active:scale-[0.98] transition-all flex items-center gap-1 text-[11.5px]"
            >
              <Layers size={13} strokeWidth={1.75} /> {isRu ? 'Карточки' : 'Kartochkalar'}
            </button>
          </header>

          {/* Tab switcher */}
          <div className="flex gap-1.5 p-1 bg-psurface border border-pline rounded-control mb-4">
            <button
              onClick={() => {
                setActiveTab('signs')
                setQuery('')
              }}
              className={`flex-1 py-2 rounded-control text-xs font-semibold transition-all ${
                activeTab === 'signs' ? 'bg-pprimary text-ponprimary shadow-xs' : 'text-pmuted hover:text-pfg'
              }`}
            >
              {isRu ? `Дорожные знаки (${totalSignsCount})` : `Yo'l belgilari (${totalSignsCount})`}
            </button>
            <button
              onClick={() => {
                setActiveTab('rules')
                setQuery('')
              }}
              className={`flex-1 py-2 rounded-control text-xs font-semibold transition-all ${
                activeTab === 'rules' ? 'bg-pprimary text-ponprimary shadow-xs' : 'text-pmuted hover:text-pfg'
              }`}
            >
              {isRu ? `Правила и штрафы (${rulesChapters.length})` : `Qoidalar & Jarimalar (${rulesChapters.length})`}
            </button>
          </div>

          {/* Qidiruv */}
          <div className="flex items-center gap-2 bg-psurface border border-pline rounded-control px-3 py-2.5 mb-4">
            <Search size={16} className="text-pmuted flex-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeTab === 'signs'
                  ? (isRu ? 'Поиск знака (название или 3.27)...' : 'Belgi qidirish (nomi yoki 3.27)...')
                  : (isRu ? 'Поиск правила или штрафа...' : 'Qoida yoki jarima qidirish...')
              }
              aria-label={isRu ? 'Поиск' : 'Qidirish'}
              className="flex-1 bg-transparent text-sm text-pfg outline-none placeholder:text-pmuted"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label={isRu ? 'Очистить' : 'Tozalash'}
                className="text-pmuted hover:text-pfg"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {activeTab === 'signs' ? (
            query ? (
              <SearchGrid query={query} onSignSelect={setSelectedSign} lang={lang} />
            ) : (
              <CategoryGrid onSelect={setSelectedCategory} lang={lang} />
            )
          ) : (
            <RulesSection query={query} lang={lang} />
          )}
        </>
      )}

      {selectedCategory && (
        <SignsGrid
          category={selectedCategory}
          onBack={() => setSelectedCategory(null)}
          onSignSelect={setSelectedSign}
          lang={lang}
        />
      )}
      {selectedSign && (
        <SignModal sign={selectedSign} onClose={() => setSelectedSign(null)} lang={lang} />
      )}
    </div>
  )
}
