import { Crown, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  lang: 'uz' | 'ru'
  isPremium: boolean
}

const BENEFITS_UZ = [
  'Kunlik 100 token',
  'Maxsus avatarlar',
  'Reklamasiz foydalanish',
  'Premium merchlar uchun chegirma',
  "VIP belgi profilingizda",
]

const BENEFITS_RU = [
  'Ежедневные 100 токенов',
  'Эксклюзивные аватары',
  'Без рекламы',
  'Скидка на премиум мерч',
  'VIP-значок в профиле',
]

export function VipBanner({ lang, isPremium }: Props) {
  const navigate = useNavigate()
  const benefits = lang === 'ru' ? BENEFITS_RU : BENEFITS_UZ

  return (
    <div className="mx-4 mt-6 mb-6 rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(250,204,21,0.10) 0%, rgba(139,92,246,0.08) 50%, var(--p-card) 100%)',
        border: '1px solid rgba(250,204,21,0.25)',
      }}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-[16px] font-black text-pfg">KIWI VIP</h3>
          <p className="text-[11px] text-pmuted mt-1">
            {lang === 'ru'
              ? "VIP-статус открывает все возможности!"
              : "VIP bo'lib, barcha imkoniyatlarni oching!"}
          </p>
          <ul className="mt-3 space-y-1.5">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-center gap-2">
                <Check size={12} className="text-psuccess flex-shrink-0" />
                <span className="text-[11px] text-pmuted">{b}</span>
              </li>
            ))}
          </ul>
          {!isPremium && (
            <button
              onClick={() => navigate('/premium')}
              className="btn-neon mt-4 px-5 py-2.5 rounded-xl text-[12px] font-bold"
            >
              {lang === 'ru' ? 'Стать VIP' : "VIP bo'lish"}
            </button>
          )}
        </div>
        <Crown size={48} className="text-pgold opacity-40 flex-shrink-0" />
      </div>
    </div>
  )
}
