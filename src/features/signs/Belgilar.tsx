import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Search } from 'lucide-react'
import { signCategories, getSignsByCategory } from '../../shared/data'

interface Sign {
  id: string; name: string; shortName: string
  image: string; description: string; legalRef: string
}

interface Category {
  id: string; name: string; emoji: string; count: number
}

function SignModal({ sign, onClose }: { sign: Sign; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl border-t border-line p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Belgi haqida</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="w-32 h-32 mx-auto rounded-2xl bg-white flex items-center justify-center mb-4">
          {sign.image
            ? <img src={sign.image} alt={sign.name} className="w-24 h-24 object-contain" />
            : <span className="text-4xl">🚧</span>
          }
        </div>
        <h3 className="text-center font-bold text-base mb-1">{sign.name}</h3>
        <p className="text-center text-xs text-muted mb-3">{sign.legalRef}</p>
        <p className="text-sm text-muted leading-relaxed mb-5">{sign.description}</p>
        <button onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-elevated text-fg font-semibold hover:bg-line transition-colors">
          Yopish
        </button>
      </div>
    </div>
  )
}

function CategoryGrid({ onSelect }: { onSelect: (cat: Category) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {signCategories.map((cat) => (
        <button key={cat.id} onClick={() => onSelect(cat)}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 active:scale-95 transition-transform text-left">
          <span className="text-2xl">{cat.emoji}</span>
          <div>
            <p className="text-xs font-semibold leading-tight">{cat.name}</p>
            <p className="text-[10px] text-muted mt-0.5">{cat.count} ta belgi</p>
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
        <button onClick={onBack} className="text-muted hover:text-white text-lg px-1">←</button>
        <h2 className="text-base font-bold">{category.name}</h2>
        <span className="text-xs text-muted ml-auto">{category.count} ta</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {signs.map((sign) => (
          <button key={sign.id} onClick={() => onSignSelect(sign)}
            className="flex flex-col items-center rounded-2xl border border-line bg-surface p-3 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center mb-2">
              {sign.image
                ? <img src={sign.image} alt={sign.name} className="w-10 h-10 object-contain" />
                : <span className="text-2xl">🚧</span>
              }
            </div>
            <span className="text-[10px] text-muted text-center leading-tight line-clamp-2">
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
    return <p className="text-center text-sm text-muted py-10">Hech narsa topilmadi</p>
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {results.map((sign) => (
        <button key={sign.id} onClick={() => onSignSelect(sign)}
          className="flex flex-col items-center rounded-2xl border border-line bg-surface p-3 active:scale-95 transition-transform">
          <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center mb-2">
            {sign.image
              ? <img src={sign.image} alt={sign.name} className="w-10 h-10 object-contain" />
              : <span className="text-2xl">🚧</span>
            }
          </div>
          <span className="text-[10px] text-muted text-center leading-tight line-clamp-2">
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
    <div className="px-4 pt-4 pb-6">
      {!selectedCategory && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate(-1)} aria-label="Orqaga"
              className="text-muted hover:text-white text-xl px-1">←</button>
            <h1 className="text-xl font-black">Yo'l belgilari</h1>
          </div>

          {/* Qidiruv */}
          <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-3 py-2.5 mb-4">
            <Search size={16} className="text-muted flex-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Belgi qidirish..."
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted hover:text-white">
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
