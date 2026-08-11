import { useState } from 'react'
import { Coins, ChevronDown, RefreshCw } from 'lucide-react'
import type { ShopAvatar, AvatarCategory } from '../data'
import { AVATAR_CATEGORIES } from '../data'
import { CategoryFilter } from './CategoryFilter'
import { PurchaseModal } from './PurchaseModal'
import { ShopImg } from './ShopImg'

interface Props {
  avatars: ShopAvatar[]
  lang: 'uz' | 'ru'
  balance: number
  onPurchase: (id: string) => void
}

export function AvatarGrid({ avatars, lang, balance, onPurchase }: Props) {
  const [category, setCategory] = useState<AvatarCategory>('all')
  const [selected, setSelected] = useState<ShopAvatar | null>(null)
  const [sortOpen, setSortOpen] = useState(false)

  const filtered = category === 'all'
    ? avatars
    : avatars.filter((a) => a.category === category)

  return (
    <div className="mt-6" id="avatars-section">
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-[15px] font-bold text-pfg">
          {lang === 'ru' ? 'Магазин аватаров' : "Avatarlar do'koni"}
        </h3>
        <button
          type="button"
          onClick={() => setSortOpen(!sortOpen)}
          aria-expanded={sortOpen}
          aria-label={lang === 'ru' ? 'Сортировка' : 'Saralash'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pline bg-pcard text-pfg text-[11px] font-semibold transition-all active:scale-95 hover:bg-pline/10"
        >
          <span>{lang === 'ru' ? 'По популярности' : "Mashhurlik bo'yicha"}</span>
          <ChevronDown size={12} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <CategoryFilter
        categories={AVATAR_CATEGORIES}
        active={category}
        onChange={(k) => setCategory(k as AvatarCategory)}
        lang={lang}
      />

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 px-4 mt-3">
        {filtered.map((avatar, i) => (
          <button
            key={avatar.id}
            onClick={() => setSelected(avatar)}
            className="rounded-2xl p-2 bg-pcard border border-pline flex flex-col items-center gap-1.5 active:scale-95 transition-transform opacity-0 animate-[fadeSlideUp_0.3s_ease_forwards]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <ShopImg image={avatar.image} alt={lang === 'ru' ? avatar.nameRu : avatar.name}
              className="w-full aspect-square rounded-xl object-cover border border-white/5 text-[28px]" />
            <p className="text-[11px] font-semibold text-pfg text-center truncate w-full">
              {lang === 'ru' ? avatar.nameRu : avatar.name}
            </p>
            <div className="flex items-center gap-1">
              <Coins size={11} className="text-pgold" />
              <span className="text-[11px] font-bold text-pgold">{avatar.price.toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 mt-4">
        <button
          type="button"
          onClick={() => {
            // Placeholder for pagination - would load more avatars from backend
            console.log('Load more avatars clicked')
          }}
          aria-label={lang === 'ru' ? 'Загрузить ещё аватары' : "Yana ko'proq avatarlar yuklash"}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-pline bg-pcard text-pfg text-[12px] font-semibold transition-all active:scale-95 hover:bg-pline/10"
        >
          <RefreshCw size={14} />
          <span>{lang === 'ru' ? 'Загрузить ещё аватары' : "Yana ko'proq avatarlar yuklash"}</span>
        </button>
      </div>

      {selected && (
        <PurchaseModal
          name={lang === 'ru' ? selected.nameRu : selected.name}
          image={selected.image}
          price={selected.price}
          balance={balance}
          lang={lang}
          type="avatar"
          onClose={() => setSelected(null)}
          onPurchase={() => onPurchase(selected.id)}
        />
      )}
    </div>
  )
}
