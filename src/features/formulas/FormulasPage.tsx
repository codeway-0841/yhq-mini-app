/**
 * 📐 Shpargalkalar — fanlar bo'yicha formulalar to'plami.
 *  - Fan chip'lari (rangli, icon) → mavzu chip'lari → formula kartalar (2 ustun)
 *  - Qidiruv: barcha fanlar bo'ylab (sarlavha + formula matni)
 *  - ⭐ sevimlilar localStorage'da (flashcards'dagi kabi pattern)
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, Star } from 'lucide-react'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { getSubject } from '../../shared/config/subjects'
import { FORMULA_SUBJECTS, formulaCount } from '../../content/formulas'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'

const FAVS_KEY = 'yhq-formula-favs'
function readFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') } catch { return [] }
}

// Barcha formulalarni tekis ro'yxat (qidiruv + sevimlilar uchun)
const ALL = FORMULA_SUBJECTS.flatMap((s) =>
  s.topics.flatMap((t) =>
    t.formulas.map((x) => ({ ...x, subjectId: s.subjectId, topicName: t.name, topicNameRu: t.nameRu })),
  ),
)

function FormulaCard({ item, fav, onFav, lang }: {
  item: (typeof ALL)[number]
  fav: boolean
  onFav: () => void
  lang: 'uz' | 'ru'
}) {
  const s = getSubject(item.subjectId)
  const Icon = s.icon
  const isRu = lang === 'ru'
  const title = isRu ? item.titleRu : item.title
  const note = isRu ? (item.noteRu ?? item.note) : item.note

  return (
    <div className="rounded-container border border-pline bg-pcard rounded-container p-3.5 relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); onFav() }}
        aria-label="favorite"
        className="absolute top-2.5 right-2.5 p-1 cursor-pointer">
        <Star size={15} className={fav ? 'text-pwarning fill-pwarning' : 'text-psubtle'} />
      </button>
      <div className="flex items-center gap-1.5 mb-2 pr-6">
        <Icon size={13} style={{ color: s.color }} />
        <span className="text-[10px] font-semibold text-psubtle truncate">
          {isRu ? item.topicNameRu : item.topicName}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-pmuted leading-snug">{title}</p>
      <p className="text-[13px] font-semibold leading-relaxed mt-1 break-words"
        style={{ color: s.color, fontFamily: 'ui-monospace, monospace' }}>
        {item.formula}
      </p>
      {note && <p className="text-[10px] text-psubtle mt-1">{note}</p>}
    </div>
  )
}

export default function FormulasPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const [subjectId, setSubjectId] = useState(FORMULA_SUBJECTS[0].subjectId)
  const [topicId, setTopicId] = useState<string | null>(null) // null = barchasi
  const [query, setQuery] = useState('')
  const [favs, setFavs] = useState<string[]>(readFavs)

  const toggleFav = (id: string) => {
    haptics.impact('light')
    playSound('click')
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem(FAVS_KEY, JSON.stringify(next))
      return next
    })
  }

  const searching = query.trim().length > 0
  const subject = FORMULA_SUBJECTS.find((s) => s.subjectId === subjectId) ?? FORMULA_SUBJECTS[0]
  const subjectCfg = getSubject(subject.subjectId)

  const visible = useMemo(() => {
    if (searching) {
      const q = query.trim().toLowerCase()
      return ALL.filter((x) =>
        x.title.toLowerCase().includes(q) ||
        (x.titleRu && x.titleRu.toLowerCase().includes(q)) ||
        x.formula.toLowerCase().includes(q) ||
        x.topicName.toLowerCase().includes(q) ||
        x.topicNameRu.toLowerCase().includes(q) ||
        (x.note && x.note.toLowerCase().includes(q)) ||
        (x.noteRu && x.noteRu.toLowerCase().includes(q))
      )
    }
    return ALL.filter((x) => x.subjectId === subject.subjectId &&
      (topicId === null || subject.topics.find((t) => t.id === topicId)?.formulas.some((fx) => fx.id === x.id)))
  }, [searching, query, subject, topicId])

  const favItems = useMemo(() => ALL.filter((x) => favs.includes(x.id)), [favs])

  return (
    <div className="font-display bg-pcanvas pb-6">
      {/* Header */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] px-5 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-3 mb-3">
        <button type="button" onClick={() => goBack(navigate)} aria-label="back"
          className="grid size-10 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold text-pfg leading-tight">{tt('cheatsheets')}</h1>
          <p className="text-[11px] text-psubtle">{tt('cheatsheetsDesc')}</p>
        </div>
        {favs.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-pwarning tabular-nums">
            <Star size={13} className="fill-pwarning" /> {favs.length}
          </span>
        )}
      </header>

      {/* Qidiruv */}
      <div className="px-5 mb-3">
        <div className="rounded-container border border-pline bg-pcard rounded-container flex items-center gap-2.5 px-4 py-3">
          <Search size={16} className="text-psubtle flex-shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={tt('searchFormula')}
            aria-label={tt('searchFormula')}
            className="flex-1 bg-transparent outline-none text-[13px] text-pfg placeholder:text-psubtle" />
        </div>
      </div>

      {/* Fan chip'lari */}
      {!searching && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-3 scroll-smooth-x [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}>
          {FORMULA_SUBJECTS.map((s) => {
            const cfg = getSubject(s.subjectId)
            const Icon = cfg.icon
            const active = s.subjectId === subject.subjectId
            return (
              <button key={s.subjectId} type="button"
                onClick={() => { setSubjectId(s.subjectId); setTopicId(null); playSound('click') }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-container flex-shrink-0 cursor-pointer transition-all"
                style={active
                  ? { background: `linear-gradient(145deg, ${cfg.color}, ${cfg.colorDark})`, boxShadow: `0 4px 14px ${cfg.color}40` }
                  : { background: 'var(--p-card)', border: '1px solid var(--p-line)' }}>
                <Icon size={15} className={active ? 'text-white' : ''} style={active ? {} : { color: cfg.color }} />
                <span className={`text-[12px] font-semibold whitespace-nowrap ${active ? 'text-white' : 'text-pfg'}`}>
                  {lang === 'ru' ? cfg.nameRu : cfg.name}
                </span>
                <span className={`text-[10px] font-semibold tabular-nums ${active ? 'text-white/80' : 'text-psubtle'}`}>
                  {formulaCount(s)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Mavzu chip'lari */}
      {!searching && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-3 scroll-smooth-x [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}>
          <button type="button" onClick={() => setTopicId(null)}
            className="px-3 py-1.5 rounded-control text-[11px] font-semibold flex-shrink-0 cursor-pointer"
            style={topicId === null
              ? { background: `${subjectCfg.color}22`, color: subjectCfg.color, border: `1px solid ${subjectCfg.color}55` }
              : { background: 'var(--p-card)', color: 'var(--p-muted)', border: '1px solid var(--p-line)' }}>
            {tt('seeAll')}
          </button>
          {subject.topics.map((t) => (
            <button key={t.id} type="button" onClick={() => setTopicId(t.id)}
              className="px-3 py-1.5 rounded-control text-[11px] font-semibold flex-shrink-0 whitespace-nowrap cursor-pointer"
              style={topicId === t.id
                ? { background: `${subjectCfg.color}22`, color: subjectCfg.color, border: `1px solid ${subjectCfg.color}55` }
                : { background: 'var(--p-card)', color: 'var(--p-muted)', border: '1px solid var(--p-line)' }}>
              {lang === 'ru' ? t.nameRu : t.name}
              <span className="text-psubtle font-normal ml-1 tabular-nums">{t.formulas.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sevimlilar */}
      {!searching && favItems.length > 0 && (
        <>
          <p className="px-5 mb-2 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">
            {tt('favFormulas')}
          </p>
          <div className="grid grid-cols-2 gap-2.5 px-5 mb-4">
            {favItems.map((x) => (
              <FormulaCard key={x.id} item={x} lang={lang} fav onFav={() => toggleFav(x.id)} />
            ))}
          </div>
        </>
      )}

      {/* Formulalar grid */}
      <div className="grid grid-cols-2 gap-2.5 px-5">
        {visible.map((x) => (
          <FormulaCard key={x.id} item={x} lang={lang}
            fav={favs.includes(x.id)} onFav={() => toggleFav(x.id)} />
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-center text-[12px] text-psubtle mt-10">{tt('notFoundF')}</p>
      )}
    </div>
  )
}
