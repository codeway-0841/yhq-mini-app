import { Coins, Award, Image } from 'lucide-react'

interface Props {
  tokens: number
  badges: number
  avatars: number
  lang: 'uz' | 'ru'
}

export function StatsBar({ tokens, badges, avatars, lang }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2.5 mx-4">
      <div className="rounded-2xl p-3.5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(91,227,0,0.12) 0%, var(--p-card) 60%)',
          border: '1px solid rgba(91,227,0,0.25)',
        }}>
        <p className="text-[10px] text-pmuted font-medium">
          {lang === 'ru' ? 'Мои токены' : 'Mening tokenlarim'}
        </p>
        <p className="text-[20px] font-black text-pfg mt-1">{tokens.toLocaleString()}</p>
        <Coins size={28} className="absolute top-3 right-3 text-pgold opacity-60" />
      </div>

      <div className="rounded-2xl p-3.5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, var(--p-card) 60%)',
          border: '1px solid rgba(139,92,246,0.25)',
        }}>
        <p className="text-[10px] text-pmuted font-medium">
          {lang === 'ru' ? 'Мои мержи' : 'Mening merjlarim'}
        </p>
        <p className="text-[20px] font-black text-pfg mt-1">{badges}</p>
        <Award size={28} className="absolute top-3 right-3 text-ppurple opacity-60" />
      </div>

      <div className="rounded-2xl p-3.5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, var(--p-card) 60%)',
          border: '1px solid rgba(59,130,246,0.25)',
        }}>
        <p className="text-[10px] text-pmuted font-medium">
          {lang === 'ru' ? 'Мои аватары' : 'Mening avatarlarim'}
        </p>
        <p className="text-[20px] font-black text-pfg mt-1">{avatars}</p>
        <Image size={28} className="absolute top-3 right-3 text-pblue opacity-60" />
      </div>
    </div>
  )
}
