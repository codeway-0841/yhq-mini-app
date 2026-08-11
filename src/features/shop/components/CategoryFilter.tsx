interface CategoryItem {
  key: string
  uz: string
  ru: string
}

interface Props {
  categories: CategoryItem[]
  active: string
  onChange: (key: string) => void
  lang: 'uz' | 'ru'
}

export function CategoryFilter({ categories, active, onChange, lang }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 scroll-smooth-x">
      {categories.map((cat) => {
        const isActive = cat.key === active
        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`flex-none px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-pprimary text-ponprimary'
                : 'bg-pcard border border-pline text-pmuted'
            }`}
          >
            {lang === 'ru' ? cat.ru : cat.uz}
          </button>
        )
      })}
    </div>
  )
}
