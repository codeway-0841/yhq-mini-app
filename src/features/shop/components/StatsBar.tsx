import { ArrowRight } from 'lucide-react'

interface Props {
  tokens: number
  badges: number
  avatars: number
  lang: 'uz' | 'ru'
  onGetMoreTokens?: () => void
  onViewBadges?: () => void
  onViewAvatars?: () => void
}

interface CardCfg {
  labelUz: string
  labelRu: string
  value: string
  image: string
  btnUz: string
  btnRu: string
  bg: string
  border: string
  onClick?: () => void
  ariaUz: string
  ariaRu: string
}

export function StatsBar({ tokens, badges, avatars, lang, onGetMoreTokens, onViewBadges, onViewAvatars }: Props) {
  const cards: CardCfg[] = [
    {
      labelUz: 'Mening tokenlarim', labelRu: 'Мои токены',
      value: tokens.toLocaleString(), image: '/shop/ui/coins.png',
      btnUz: "Ko'proq olish", btnRu: 'Получить больше',
      bg: 'linear-gradient(135deg, rgba(91,227,0,0.22) 0%, rgba(91,227,0,0.06) 60%), var(--p-card)',
      border: '1px solid rgba(91,227,0,0.35)',
      onClick: onGetMoreTokens,
      ariaUz: "Ko'proq token olish", ariaRu: 'Получить больше токенов',
    },
    {
      labelUz: 'Mening merjlarim', labelRu: 'Мои мерджи',
      value: String(badges), image: '/shop/ui/boy.png',
      btnUz: "Ko'rish", btnRu: 'Смотреть',
      bg: 'linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.06) 60%), var(--p-card)',
      border: '1px solid rgba(139,92,246,0.35)',
      onClick: onViewBadges,
      ariaUz: "Merjlarni ko'rish", ariaRu: 'Смотреть награды',
    },
    {
      labelUz: 'Mening avatarlarim', labelRu: 'Мои аватары',
      value: String(avatars), image: '/shop/ui/panda.png',
      btnUz: "Ko'rish", btnRu: 'Смотреть',
      bg: 'var(--p-card)',
      border: '1px solid var(--p-line)',
      onClick: onViewAvatars,
      ariaUz: "Avatarlarni ko'rish", ariaRu: 'Смотреть аватары',
    },
  ]

  return (
    <>
      {cards.map((c, i) => (
        <div key={i} className="rounded-2xl p-4 relative overflow-hidden min-h-[130px] flex flex-col"
          style={{ background: c.bg, border: c.border }}>
          <p className="text-[11px] text-pmuted font-medium">
            {lang === 'ru' ? c.labelRu : c.labelUz}
          </p>
          <p className="text-[26px] font-black text-pfg mt-1">{c.value}</p>
          <button
            type="button"
            onClick={c.onClick}
            aria-label={lang === 'ru' ? c.ariaRu : c.ariaUz}
            className="mt-auto self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 text-pfg text-[11px] font-semibold transition-all active:scale-95 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-pprimary/50">
            <span>{lang === 'ru' ? c.btnRu : c.btnUz}</span>
            <ArrowRight size={12} />
          </button>
          <img src={c.image} alt="" loading="lazy" draggable={false}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-16 h-16 object-contain pointer-events-none" />
        </div>
      ))}
    </>
  )
}
