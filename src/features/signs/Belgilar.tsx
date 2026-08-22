import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { X, Search, ChevronLeft, TrafficCone, Gamepad2, Layers } from 'lucide-react'
import { signCategories, getSignsByCategory } from '../../content/signs'
import DialogOverlay from '../../shared/components/DialogOverlay'

interface Sign {
  id: string; name: string; shortName: string
  image: string; description: string; legalRef: string
}

interface Category {
  id: string; name: string; emoji: string; count: number
}

function SignModal({ sign, onClose }: { sign: Sign; onClose: () => void }) {
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/60" labelId="sign-modal-title">
      <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 id="sign-modal-title" className="text-base font-semibold">Belgi haqida</h2>
          <button onClick={onClose} className="text-pmuted hover:text-pfg" aria-label="Yopish"><X size={20} /></button>
        </div>
        <div className="w-32 h-32 mx-auto rounded-container bg-white flex items-center justify-center mb-4">
          {sign.image
            ? <img src={sign.image} alt={sign.name} className="w-24 h-24 object-contain" />
            : <TrafficCone size={40} strokeWidth={1.5} className="text-stone-400" />
          }
        </div>
        <h3 className="text-center font-semibold text-base mb-1">{sign.name}</h3>
        <p className="text-center text-xs text-pmuted mb-3">{sign.legalRef}</p>
        <p className="text-sm text-pmuted leading-relaxed mb-5">{sign.description}</p>
        <button onClick={onClose}
          className="w-full py-3.5 rounded-control bg-psurface text-pfg font-semibold hover:bg-plineStrong transition-colors">
          Yopish
        </button>
      </div>
    </DialogOverlay>
  )
}

function CategoryGrid({ onSelect }: { onSelect: (cat: Category) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {signCategories.map((cat) => (
        <button key={cat.id} onClick={() => onSelect(cat)}
          className="flex items-center gap-3 rounded-container border border-pline bg-psurface p-3.5 active:scale-95 transition-transform text-left">
          <span className="text-2xl">{cat.emoji}</span>
          <div>
            <p className="text-xs font-semibold leading-tight">{cat.name}</p>
            <p className="text-[10px] text-pmuted mt-0.5">{cat.count} ta belgi</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function SignsGrid({ category, onBack, onSignSelect }: {
  category: Category; onBack: () => void; onSignSelect: (sign: Sign) => void
}) {
  const signs = getSignsByCategory(category.id)
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} aria-label="Orqaga"
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h2 className="text-base font-semibold">{category.name}</h2>
        <span className="text-xs text-pmuted ml-auto">{category.count} ta</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {signs.map((sign) => (
          <button key={sign.id} onClick={() => onSignSelect(sign)}
            className="flex flex-col items-center rounded-container border border-pline bg-psurface p-3 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-control bg-white flex items-center justify-center mb-2">
              {sign.image
                ? <img src={sign.image} alt={sign.name} className="w-10 h-10 object-contain" />
                : <TrafficCone size={24} strokeWidth={1.5} className="text-stone-400" />
              }
            </div>
            <span className="text-[10px] text-pmuted text-center leading-tight line-clamp-2">
              {sign.shortName}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

/** Qidiruv natijalari — barcha kategoriyalarda */
function SearchGrid({ query, onSignSelect }: { query: string; onSignSelect: (sign: Sign) => void }) {
  const results = useMemo(() => {
    const q = query.toLowerCase()
    return signCategories
      .flatMap((cat) => getSignsByCategory(cat.id))
      .filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.shortName.includes(q))
      .slice(0, 60)
  }, [query])

  if (results.length === 0) {
    return <p className="text-center text-sm text-pmuted py-10">Hech narsa topilmadi</p>
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {results.map((sign) => (
        <button key={sign.id} onClick={() => onSignSelect(sign)}
          className="flex flex-col items-center rounded-container border border-pline bg-psurface p-3 active:scale-95 transition-transform">
          <div className="w-14 h-14 rounded-control bg-white flex items-center justify-center mb-2">
            {sign.image
              ? <img src={sign.image} alt={sign.name} className="w-10 h-10 object-contain" />
              : <TrafficCone size={24} strokeWidth={1.5} className="text-stone-400" />
            }
          </div>
          <span className="text-[10px] text-pmuted text-center leading-tight line-clamp-2">
            {sign.shortName}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function Belgilar() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedSign, setSelectedSign]         = useState<Sign | null>(null)
  const [query, setQuery]                       = useState('')
  const navigate = useNavigate()

  return (
    <div className="px-5 pb-6 pt-4">
      {!selectedCategory && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => goBack(navigate)} aria-label="Orqaga"
              className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            <h1 className="flex-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-pfg">Yo'l belgilari</h1>
            <button onClick={() => navigate('/belgilar-oyini')}
              className="btn-premium-sm btn-premium flex items-center gap-1.5 text-[12px]">
              <Gamepad2 size={13} strokeWidth={1.75} /> O'yin
            </button>
            <button onClick={() => navigate('/flashcards')}
              className="btn-premium-sm btn-premium flex items-center gap-1.5 text-[12px]">
              <Layers size={13} strokeWidth={1.75} /> Kartochkalar
            </button>
          </div>

          {/* Qidiruv */}
          <div className="flex items-center gap-2 bg-psurface border border-pline rounded-control px-3 py-2.5 mb-4">
            <Search size={16} className="text-pmuted flex-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Belgi qidirish..."
              className="flex-1 bg-transparent text-sm text-pfg outline-none placeholder:text-pmuted"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-pmuted hover:text-pfg">
                <X size={14} />
              </button>
            )}
          </div>

          {query
            ? <SearchGrid query={query} onSignSelect={setSelectedSign} />
            : <CategoryGrid onSelect={setSelectedCategory} />
          }
        </>
      )}
      {selectedCategory && (
        <SignsGrid category={selectedCategory} onBack={() => setSelectedCategory(null)} onSignSelect={setSelectedSign} />
      )}
      {selectedSign && (
        <SignModal sign={selectedSign} onClose={() => setSelectedSign(null)} />
      )}
    </div>
  )
}
