import { useState } from 'react'
import { Coins } from 'lucide-react'
import type { ShopBadge } from '../data'
import { PurchaseModal } from './PurchaseModal'
import { ShopImg } from './ShopImg'

interface Props {
  badges: ShopBadge[]
  lang: 'uz' | 'ru'
  balance: number
  onPurchase: (id: string) => void
}

export function BadgeRow({ badges, lang, balance, onPurchase }: Props) {
  const [selected, setSelected] = useState<ShopBadge | null>(null)

  return (
    <div className="mt-6">
      <div className="px-4 mb-1">
        <h3 className="text-[15px] font-bold text-pfg">
          {lang === 'ru' ? 'Мержи' : 'Merjlar'}
        </h3>
        <p className="text-[11px] text-pmuted mt-0.5">
          {lang === 'ru'
            ? 'Украсьте профиль специальными значками!'
            : "Maxsus merjlar bilan profilingizni bezang!"}
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 mt-2.5 pb-2 scroll-smooth-x">
        {badges.map((badge, i) => (
          <button
            key={badge.id}
            onClick={() => setSelected(badge)}
            className="flex-none w-[90px] flex flex-col items-center gap-1.5 active:scale-95 transition-transform opacity-0 animate-[fadeSlideUp_0.3s_ease_forwards]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <ShopImg image={badge.icon} alt={lang === 'ru' ? badge.nameRu : badge.name}
              className="w-14 h-14 object-contain text-[26px]" />
            <p className="text-[10px] font-medium text-pmuted text-center leading-tight w-full truncate">
              {lang === 'ru' ? badge.nameRu : badge.name}
            </p>
            <div className="flex items-center gap-0.5">
              <Coins size={10} className="text-pgold" />
              <span className="text-[10px] font-bold text-pgold">{badge.price.toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <PurchaseModal
          name={lang === 'ru' ? selected.nameRu : selected.name}
          image={selected.icon}
          price={selected.price}
          balance={balance}
          lang={lang}
          type="badge"
          onClose={() => setSelected(null)}
          onPurchase={() => onPurchase(selected.id)}
        />
      )}
    </div>
  )
}
