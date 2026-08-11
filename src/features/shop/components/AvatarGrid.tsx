import { useState } from 'react'
import { Coins } from 'lucide-react'
import type { ShopAvatar, AvatarCategory } from '../data'
import { AVATAR_CATEGORIES } from '../data'
import { CategoryFilter } from './CategoryFilter'

interface Props {
  avatars: ShopAvatar[]
  lang: 'uz' | 'ru'
}

export function AvatarGrid({ avatars, lang }: Props) {
  const [category, setCategory] = useState<AvatarCategory>('all')

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
        {filtered.map((avatar) => (
          <button
            key={avatar.id}
            className="rounded-2xl p-3 bg-pcard border border-pline flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-xl bg-pcanvas flex items-center justify-center text-[28px]">
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
    </div>
  )
}
