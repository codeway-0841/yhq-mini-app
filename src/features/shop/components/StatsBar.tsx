import { Coins, Award, Image, ArrowRight } from 'lucide-react'

interface Props {
  tokens: number
  badges: number
  avatars: number
  lang: 'uz' | 'ru'
  onGetMoreTokens?: () => void
  onViewBadges?: () => void
  onViewAvatars?: () => void
}

export function StatsBar({ tokens, badges, avatars, lang, onGetMoreTokens, onViewBadges, onViewAvatars }: Props) {

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-2xl p-4 relative overflow-hidden min-h-[120px] flex flex-col"
        style={{
          background: 'linear-gradient(135deg, rgba(91,227,0,0.12) 0%, var(--p-card) 60%)',
          border: '1px solid rgba(91,227,0,0.3)',
        }}>
        <div className="flex-1">
          <p className="text-[11px] text-pmuted font-medium">
            {lang === 'ru' ? 'Мои токены' : 'Mening tokenlarim'}
          </p>
          <p className="text-[24px] font-black text-pfg mt-1.5 mb-3">{tokens.toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={onGetMoreTokens}
          aria-label={lang === 'ru' ? 'Получить больше токенов' : "Ko'proq token olish"}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-pprimary/40 bg-transparent text-pprimary text-[11px] font-semibold transition-all active:scale-95 hover:bg-pprimary/5 focus:outline-none focus:ring-2 focus:ring-pprimary/50 w-full">
          <span>{lang === 'ru' ? 'Получить больше' : "Ko'proq olish"}</span>
          <ArrowRight size={12} />
        </button>
        <div className="absolute top-3 right-3 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(250,204,21,0.15)' }}>
          <Coins size={24} className="text-pgold" />
        </div>
      </div>

      <div className="rounded-2xl p-4 relative overflow-hidden min-h-[120px] flex flex-col"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, var(--p-card) 60%)',
          border: '1px solid rgba(139,92,246,0.3)',
        }}>
        <div className="flex-1">
          <p className="text-[11px] text-pmuted font-medium">
            {lang === 'ru' ? 'Мои награды' : 'Mening mukofotlarim'}
          </p>
          <p className="text-[24px] font-black text-pfg mt-1.5 mb-3">{badges}</p>
        </div>
        <button
          type="button"
          onClick={onViewBadges}
          aria-label={lang === 'ru' ? 'Смотреть награды' : "Mukofotlarni ko'rish"}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-ppurple/40 bg-transparent text-ppurple text-[11px] font-semibold transition-all active:scale-95 hover:bg-ppurple/5 focus:outline-none focus:ring-2 focus:ring-ppurple/50 w-full">
          <span>{lang === 'ru' ? 'Смотреть' : "Ko'rish"}</span>
          <ArrowRight size={12} />
        </button>
        <div className="absolute top-3 right-3 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,0.15)' }}>
          <Award size={22} className="text-ppurple" />
        </div>
      </div>

      <div className="rounded-2xl p-4 relative overflow-hidden min-h-[120px] flex flex-col"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, var(--p-card) 60%)',
          border: '1px solid rgba(59,130,246,0.3)',
        }}>
        <div className="flex-1">
          <p className="text-[11px] text-pmuted font-medium">
            {lang === 'ru' ? 'Мои аватары' : 'Mening avatarlarim'}
          </p>
          <p className="text-[24px] font-black text-pfg mt-1.5 mb-3">{avatars}</p>
        </div>
        <button
          type="button"
          onClick={onViewAvatars}
          aria-label={lang === 'ru' ? 'Смотреть аватары' : "Avatarlarni ko'rish"}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-pblue/40 bg-transparent text-pblue text-[11px] font-semibold transition-all active:scale-95 hover:bg-pblue/5 focus:outline-none focus:ring-2 focus:ring-pblue/50 w-full">
          <span>{lang === 'ru' ? 'Смотреть' : "Ko'rish"}</span>
          <ArrowRight size={12} />
        </button>
        <div className="absolute top-3 right-3 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(59,130,246,0.15)' }}>
          <Image size={22} className="text-pblue" />
        </div>
      </div>
    </div>
  )
}
