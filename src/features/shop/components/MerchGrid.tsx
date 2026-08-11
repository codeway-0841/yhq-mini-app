import { useState } from 'react'
import { Coins } from 'lucide-react'
import type { ShopMerch, MerchCategory } from '../data'
import { MERCH_CATEGORIES } from '../data'
import { CategoryFilter } from './CategoryFilter'
import { PurchaseModal } from './PurchaseModal'

interface Props {
  items: ShopMerch[]
  lang: 'uz' | 'ru'
  balance: number
  onPurchase: (id: string) => void
}

export function MerchGrid({ items, lang, balance, onPurchase }: Props) {
  const [category, setCategory] = useState<MerchCategory>('all')
  const [selected, setSelected] = useState<ShopMerch | null>(null)

  const filtered = category === 'all'
    ? items
    : items.filter((m) => m.category === category)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-[15px] font-bold text-pfg">
          {lang === 'ru' ? 'Мерч-магазин' : "Merch do'kon"}
        </h3>
      </div>

      <CategoryFilter
        categories={MERCH_CATEGORIES}
        active={category}
        onChange={(k) => setCategory(k as MerchCategory)}
        lang={lang}
      />

      <div className="flex gap-3 overflow-x-auto px-4 mt-3 pb-2 scroll-smooth-x">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="flex-none w-[130px] rounded-2xl p-3 bg-pcard border border-pline flex flex-col items-center gap-2 active:scale-95 transition-transform opacity-0 animate-[fadeSlideUp_0.3s_ease_forwards]"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-[32px]"
              style={{ background: 'linear-gradient(135deg, rgba(91,227,0,0.08), rgba(59,130,246,0.08))' }}>
              {item.image}
            </div>
            <p className="text-[11px] font-semibold text-pfg text-center truncate w-full">
              {lang === 'ru' ? item.nameRu : item.name}
            </p>
            <div className="flex items-center gap-1">
              <Coins size={11} className="text-pgold" />
              <span className="text-[11px] font-bold text-pgold">{item.price.toLocaleString()}</span>
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
          type="merch"
          onClose={() => setSelected(null)}
          onPurchase={() => onPurchase(selected.id)}
        />
      )}
    </div>
  )
}
