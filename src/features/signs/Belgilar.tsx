import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
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
      <div className="relative w-full bg-[#161b22] rounded-t-2xl border-t border-[#30363d] p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Belgi haqida</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-white"><X size={20} /></button>
        </div>
        <div className="w-32 h-32 mx-auto rounded-2xl bg-white flex items-center justify-center mb-4">
          {sign.image
            ? <img src={sign.image} alt={sign.name} className="w-24 h-24 object-contain" />
            : <span className="text-4xl">🚧</span>
          }
        </div>
        <h3 className="text-center font-bold text-base mb-1">{sign.name}</h3>
        <p className="text-center text-xs text-[#8b949e] mb-3">{sign.legalRef}</p>
        <p className="text-sm text-[#c9d1d9] leading-relaxed mb-5">{sign.description}</p>
        <button onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-[#21262d] text-[#e6edf3] font-semibold hover:bg-[#30363d] transition-colors">
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
          className="flex items-center gap-3 rounded-2xl border border-[#30363d] bg-[#161b22] p-3.5 active:scale-95 transition-transform text-left">
          <span className="text-2xl">{cat.emoji}</span>
          <div>
            <p className="text-xs font-semibold leading-tight">{cat.name}</p>
            <p className="text-[10px] text-[#8b949e] mt-0.5">{cat.count} ta belgi</p>
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
        <button onClick={onBack} className="text-[#8b949e] hover:text-white text-lg px-1">←</button>
        <h2 className="text-base font-bold">{category.name}</h2>
        <span className="text-xs text-[#8b949e] ml-auto">{category.count} ta</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {signs.map((sign) => (
          <button key={sign.id} onClick={() => onSignSelect(sign)}
            className="flex flex-col items-center rounded-2xl border border-[#30363d] bg-[#161b22] p-3 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center mb-2">
              {sign.image
                ? <img src={sign.image} alt={sign.name} className="w-10 h-10 object-contain" />
                : <span className="text-2xl">🚧</span>
              }
            </div>
            <span className="text-[10px] text-[#8b949e] text-center leading-tight line-clamp-2">
              {sign.shortName}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

export default function Belgilar() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedSign, setSelectedSign]         = useState<Sign | null>(null)
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-4 pb-6">
      {!selectedCategory && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate(-1)} aria-label="Orqaga"
              className="text-[#8b949e] hover:text-white text-xl px-1">←</button>
            <h1 className="text-xl font-black">Yo'l belgilari</h1>
          </div>
          <CategoryGrid onSelect={setSelectedCategory} />
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
