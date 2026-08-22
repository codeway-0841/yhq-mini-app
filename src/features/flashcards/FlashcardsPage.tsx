/**
 * 🃏 Flashcards — yo'l belgilari uchun flip-kartochkalar.
 *  - Kategoriya tanlash → tasodifiy aralashtirilgan dek
 *  - Bosilsa — 3D aylanish (rasm ↔ nom + tavsif)
 *  - "Bilaman ✓" (aksent) → keyingi · "Bilmadim" (qizil) → dek oxiriga qaytadi
 *  - Bilganlar localStorage'da saqlanadi (kategoriya bo'yicha) — progress ko'rinadi
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { ChevronLeft, RotateCcw, PartyPopper, TrafficCone, Check, X, Layers } from 'lucide-react'
import { signCategories, getSignsByCategory } from '../../content/signs'
import { getSignCategoryIcon } from '../../shared/config/sign-category-icons'
import { useAppStore } from '../../shared/store/useAppStore'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'

interface Sign {
  id: string; name: string; shortName: string
  image: string; description: string; legalRef: string
}
interface Category { id: string; name: string; emoji: string; count: number; color: string }

const knownKey = (catId: string) => `yhq-flash-known-${catId}`
function readKnown(catId: string): string[] {
  try { return JSON.parse(localStorage.getItem(knownKey(catId)) ?? '[]') } catch { return [] }
}

export default function FlashcardsPage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)

  const [cat, setCat]       = useState<Category | null>(null)
  const [deck, setDeck]     = useState<Sign[]>([])
  const [idx, setIdx]       = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown]   = useState<string[]>([])

  const start = (c: Category) => {
    const signs = [...getSignsByCategory(c.id)]
    for (let i = signs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[signs[i], signs[j]] = [signs[j], signs[i]]
    }
    setCat(c)
    setDeck(signs)
    setIdx(0)
    setFlipped(false)
    setKnown(readKnown(c.id))
    playSound('click')
  }

  const reset = () => {
    localStorage.removeItem(knownKey(cat!.id))
    setKnown([])
    start(cat!)
  }

  const current = deck[idx]
  const done = idx >= deck.length

  const mark = (isKnown: boolean) => {
    if (!current || !cat) return
    haptics.notify(isKnown ? 'success' : 'error')
    playSound(isKnown ? 'success' : 'click')
    if (isKnown && !known.includes(current.id)) {
      const next = [...known, current.id]
      setKnown(next)
      localStorage.setItem(knownKey(cat.id), JSON.stringify(next))
    }
    setFlipped(false)
    if (!isKnown) {
      // "Bilmadim" — dek oxiriga qaytariladi (yana ko'rasiz)
      setDeck((d) => [...d, current])
    }
    // kichik pauza — flip orqaga qaytishi ko'rinsin
    setTimeout(() => setIdx((i) => i + 1), 160)
  }

  const progress = useMemo(() =>
    deck.length > 0 ? Math.round((idx / deck.length) * 100) : 0,
    [idx, deck.length])

  // ── Kategoriya tanlash ──
  if (!cat) {
    return (
      <div className="font-display min-h-screen bg-pcanvas text-pfg px-5 pt-5 pb-8">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => goBack(navigate)} aria-label="Orqaga"
            className="text-psubtle hover:text-pfg px-1 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <Layers size={18} className="text-psubtle" />
          <h1 className="text-lg font-semibold tracking-tight">Flashcards</h1>
        </div>
        <p className="text-[12px] text-psubtle mb-4">
          {lang === 'ru' ? 'Категорию выберите — карточки переворачиваются нажатием' : 'Kategoriya tanlang — karta bosilsa aylanadi'}
        </p>
        <div className="flex flex-col gap-2.5">
          {signCategories.map((c) => {
            const k = readKnown(c.id).length
            const Icon = getSignCategoryIcon(c.id)
            return (
              <button key={c.id} onClick={() => start(c)}
                className="rounded-container border border-pline bg-pcard w-full flex items-center gap-3.5 p-4 text-left active:scale-[0.98] transition-transform">
                <div
                  className="flex size-10 flex-shrink-0 items-center justify-center rounded-[12px]"
                  style={{
                    background: `color-mix(in srgb, ${c.color} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${c.color} 20%, transparent)`,
                  }}
                >
                  <Icon size={18} strokeWidth={1.75} style={{ color: c.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{c.name}</p>
                  <p className="text-[11px] text-psubtle mt-0.5">
                    {c.count} {lang === 'ru' ? 'знаков' : 'belgi'}
                    {k > 0 && ` · ${k} ${lang === 'ru' ? 'изучено' : "o'zlashtirildi"}`}
                  </p>
                </div>
                {k > 0 && (
                  <span className="text-[10px] font-semibold text-pprimary">
                    {Math.round((k / c.count) * 100)}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Yakun ekrani ──
  if (done) {
    return (
      <div className="font-display min-h-screen bg-pcanvas text-pfg flex flex-col items-center justify-center px-6 text-center">
        <PartyPopper size={48} strokeWidth={1.5} className="mb-4 text-pprimary" />
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.015em] mb-2">
          {lang === 'ru' ? 'Дек пройден!' : 'Dek tugadi!'}
        </h2>
        <p className="text-[13px] text-psubtle mb-6">
          {lang === 'ru'
            ? `${known.length} из ${cat.count} знаков изучено`
            : `${known.length} / ${cat.count} belgi o'zlashtirildi`}
        </p>
        <button onClick={() => start(cat)} className="btn-neon flex h-11 items-center gap-2 px-8 font-semibold mb-3">
          <RotateCcw size={16} strokeWidth={1.75} />
          {lang === 'ru' ? 'Ещё раз' : 'Yana bir bor'}
        </button>
        <button onClick={reset}
          className="text-[12px] font-semibold text-psubtle underline underline-offset-2">
          {lang === 'ru' ? 'Сбросить прогресс' : 'Progressni tozalash'}
        </button>
        <button onClick={() => setCat(null)}
          className="mt-6 flex items-center gap-1 text-[13px] font-semibold text-pmuted">
          <ChevronLeft size={15} strokeWidth={1.75} />
          {lang === 'ru' ? 'Категории' : 'Kategoriyalar'}
        </button>
      </div>
    )
  }

  // ── Karta ekrani ──
  return (
    <div className="font-display min-h-screen bg-pcanvas text-pfg flex flex-col pb-6">
      <div className="flex items-center justify-between px-5 pt-5">
        <button onClick={() => setCat(null)} aria-label="Orqaga"
          className="grid size-11 place-items-center rounded-control text-psubtle transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="text-[12px] font-semibold text-psubtle">{cat.name}</span>
        <span className="text-[12px] font-semibold text-pmuted tabular-nums">{idx + 1}/{deck.length}</span>
      </div>

      {/* Progress */}
      <div className="mx-5 mt-3 progress-premium">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>

      {/* FLIP karta */}
      <div className="flex-1 flex items-center justify-center px-6 py-5">
        <button onClick={() => { setFlipped((f) => !f); playSound('click') }}
          className="flip-card w-full max-w-[320px] aspect-[3/4] text-left select-none">
          <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
            {/* OLD TOMON — belgi rasmi */}
            <div className="flip-face rounded-container border border-pline bg-pcard rounded-[28px] p-6 flex flex-col items-center justify-center gap-4">
              <div className="w-40 h-40 rounded-container bg-white flex items-center justify-center">
                {current.image
                  ? <img src={current.image} alt={current.name} className="w-32 h-32 object-contain" />
                  : <TrafficCone size={48} strokeWidth={1.5} className="text-stone-400" />}
              </div>
              <p className="text-[11px] font-semibold text-psubtle">
                {lang === 'ru' ? 'Нажмите — увидеть ответ' : 'Bosing — javobni ko\'rish'}
              </p>
            </div>
            {/* ORQA TOMON — nom + tavsif */}
            <div className="flip-face flip-back rounded-container border border-pline bg-pcard rounded-[28px] p-6 flex flex-col justify-center"
              style={{ borderColor: 'rgb(var(--p-primary-rgb) / 0.35)' }}>
              <p className="text-[17px] font-semibold text-pfg leading-snug mb-2">{current.name}</p>
              <p className="text-[11px] font-semibold text-ppurple mb-3">{current.legalRef}</p>
              <p className="text-[12.5px] text-pmuted leading-relaxed">{current.description}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Boshqaruv */}
      <div className="flex gap-3 px-6">
        <button onClick={() => mark(false)}
          className="btn-premium-secondary flex-1 h-[54px] rounded-container font-semibold text-[14px] justify-center text-pdanger"
          style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <X size={17} />
          {lang === 'ru' ? 'Не знал' : 'Bilmadim'}
        </button>
        <button onClick={() => mark(true)}
          className="btn-premium flex-[1.3] h-[54px] rounded-container font-semibold text-[14px]">
          <Check size={17} />
          {lang === 'ru' ? 'Знаю' : 'Bilaman'}
        </button>
      </div>
      <p className="text-center text-[10.5px] text-psubtle mt-3 flex items-center justify-center gap-1.5">
        <RotateCcw size={10} />
        {lang === 'ru' ? '"Не знал" вернётся в конец колоды' : '"Bilmadim" dek oxiriga qaytadi'}
      </p>
    </div>
  )
}
