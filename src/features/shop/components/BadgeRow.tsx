import { Coins } from 'lucide-react'
import type { ShopBadge } from '../data'

interface Props {
  badges: ShopBadge[]
  lang: 'uz' | 'ru'
}

export function BadgeRow({ badges, lang }: Props) {
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
        {badges.map((badge) => (
          <button
            key={badge.id}
            className="flex-none w-[90px] flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-pcard border border-pline flex items-center justify-center text-[26px]">
              {badge.icon}
            </div>
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
    </div>
  )
}
