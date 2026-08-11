import type { TokenPackage } from '../data'

interface Props {
  packages: TokenPackage[]
  lang: 'uz' | 'ru'
}

export function TokenPackages({ packages, lang }: Props) {
  return (
    <div className="mt-6 px-4">
      <h3 className="text-[15px] font-bold text-pfg mb-3">
        {lang === 'ru' ? 'Пакеты токенов' : 'Token paketlari'}
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            className="rounded-2xl p-3 bg-pcard border border-pline flex flex-col items-center gap-1.5 relative active:scale-95 transition-transform"
          >
            {pkg.discount && (
              <span className="absolute -top-1.5 -right-1 bg-pdanger text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                -{pkg.discount}%
              </span>
            )}
            <img src={pkg.image} alt="" loading="lazy" draggable={false} className="h-12 object-contain" />
            <p className="text-[13px] font-black text-pfg">{pkg.amount.toLocaleString()}</p>
            <p className="text-[9.5px] text-psubtle">
              {pkg.price.toLocaleString()} {lang === 'ru' ? "сум" : "so'm"}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
