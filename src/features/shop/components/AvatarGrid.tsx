import { useState } from 'react'
import { Coins } from 'lucide-react'
import type { ShopAvatar, AvatarCategory } from '../data'
import { AVATAR_CATEGORIES } from '../data'
import { CategoryFilter } from './CategoryFilter'
import { PurchaseModal } from './PurchaseModal'

const GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 100%)',
  'linear-gradient(135deg, #1a0533 0%, #2d1b69 100%)',
  'linear-gradient(135deg, #1b2838 0%, #1e3a5f 100%)',
  'linear-gradient(135deg, #0d1f0d 0%, #1a3a1a 100%)',
  'linear-gradient(135deg, #2d1b00 0%, #1a1200 100%)',
]

interface Props {
  avatars: ShopAvatar[]
  lang: 'uz' | 'ru'
  balance: number
  onPurchase: (id: string) => void
}

export function AvatarGrid({ avatars, lang, balance, onPurchase }: Props) {
  const [category, setCategory] = useState<AvatarCategory>('all')
  const [selected, setSelected] = useState<ShopAvatar | null>(null)

  const filtered = category === 'all'
    ? avatars
    : avatars.filter((a) => a.category === category)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-[15px] font-bold text-pfg">
          {lang === 'ru' ? 'Магазин аватаров' : "Avatarlar do'koni"}
        </h3>
      </div>

      <CategoryFilter
        categories={AVATAR_CATEGORIES}
        active={category}
        onChange={(k) => setCategory(k as AvatarCategory)}
        lang={lang}
      />

      <div className="grid grid-cols-3 gap-2.5 px-4 mt-3">
        {filtered.map((avatar, i) => (
          <button
            key={avatar.id}
            onClick={() => setSelected(avatar)}
            className="rounded-2xl p-3 bg-pcard border border-pline flex flex-col items-center gap-2 active:scale-95 transition-transform opacity-0 animate-[fadeSlideUp_0.3s_ease_forwards]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-[28px] border border-white/5"
              style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
              {avatar.image}
            </div>
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
