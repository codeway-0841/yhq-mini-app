/**
 * Premium sahifasi — obuna showcase.
 *  - Hero: gold Crown + sarlavha
 *  - Imkoniyatlar ro'yxati (semantik ikonlar)
 *  - Premium temalar showcase (src/config/themes.ts dan — YAGONA MANBA)
 *  - CTA → Telegram bot (to'lov Telegram Stars orqali)
 *  KPI: banner'dagi track('premium_click') saqlanadi.
 */
import { Crown, Sparkles, Bot, Palette, HeartCrack, Zap, Check, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { openTelegramLink } from '../../lib/telegram'
import { ACCENT_THEMES } from '../../config/themes'
import { track } from '../../lib/analytics'

const BENEFITS = [
  { icon: Sparkles,  color: '#facc15', uz: 'Reklamasiz tajriba',          ru: 'Без рекламы' },
  { icon: Bot,       color: '#8b5cf6', uz: 'AI Tutor — chuqur tushuntirishlar', ru: 'ИИ-тьютор — подробные объяснения' },
  { icon: Palette,   color: '#5be300', uz: `${ACCENT_THEMES.filter((t) => t.premium).length} ta eksklyuziv tema`, ru: `${ACCENT_THEMES.filter((t) => t.premium).length} эксклюзивных тем` },
  { icon: HeartCrack, color: '#ef4444', uz: "Xatolar bo'yicha chuqur tahlil", ru: 'Глубокий анализ ошибок' },
  { icon: Zap,       color: '#3b82f6', uz: 'Cheksiz mashq rejimlari',     ru: 'Безлимитные режимы практики' },
]

export default function PremiumPage() {
  const navigate = useNavigate()
  const lang     = useAppStore((s) => s.settings.language)
  const isPremium = useAppStore((s) => s.tariff === 'premium')

  const premiumThemes = ACCENT_THEMES.filter((t) => t.premium)

  const buy = () => {
    track('premium_click')
    openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')
  }

  return (
    <div className="font-display min-h-screen bg-pcanvas text-pfg pb-10">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-2">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="text-psubtle hover:text-pfg text-xl px-1 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold tracking-tight">Premium</h1>
      </div>

      {/* Hero — dark glass + oltin */}
      <div className="mx-5 mt-2 rounded-[28px] p-6 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(250,204,21,0.10) 0%, var(--p-card) 55%)',
          border: '1px solid rgba(250, 204, 21, 0.30)',
          boxShadow: '0 0 60px -20px rgba(250, 204, 21, 0.35)',
        }}>
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(135deg, #fde047, #eab308)',
            boxShadow: '0 8px 24px rgba(250, 204, 21, 0.35)',
          }}>
          <Crown size={30} className="text-[#241a00]" fill="currentColor" />
        </div>
        <h2 className="text-[24px] font-bold tracking-tight">KIWI Premium</h2>
        <p className="text-[13px] text-pmuted mt-1.5 leading-relaxed max-w-[260px] mx-auto">
          {lang === 'ru'
            ? 'Все возможности без ограничений — в одной подписке'
            : 'Barcha imkoniyatlar — bitta obunada, cheksiz'}
        </p>
        {isPremium && (
          <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e' }}>
            <Check size={13} /> {lang === 'ru' ? 'Подписка активна' : 'Obuna faol'}
          </span>
        )}
      </div>

      {/* Imkoniyatlar */}
      <div className="mx-5 mt-4 card-premium divide-y divide-pline">
        {BENEFITS.map((b, i) => (
          <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: `${b.color}1A`, border: `1px solid ${b.color}33` }}>
              <b.icon size={18} style={{ color: b.color }} />
            </div>
            <span className="text-[13.5px] font-semibold text-pfg">{lang === 'ru' ? b.ru : b.uz}</span>
          </div>
        ))}
      </div>

      {/* Temalar showcase */}
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">
        {lang === 'ru' ? 'Эксклюзивные темы' : 'Eksklyuziv temalar'}
      </p>
      <div className="flex gap-3 px-5 overflow-x-auto pb-2 scroll-smooth-x">
        {premiumThemes.map((t) => (
          <div key={t.id} className="flex-none w-[110px]">
            <div className="h-[72px] rounded-2xl overflow-hidden border border-pline relative"
              style={{ background: t.bg }}>
              <div className="absolute left-2 right-2 top-2 h-6 rounded-lg"
                style={{ background: t.card, border: `1px solid ${t.color}4d` }} />
              <span className="absolute bottom-2 left-2 w-8 h-2 rounded-full"
                style={{ background: t.color, boxShadow: t.glow ? `0 0 8px ${t.color}` : undefined }} />
              {t.glow && (
                <span className="absolute bottom-2.5 right-2 w-2.5 h-2.5 rounded-full"
                  style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
              )}
              <Crown size={12} className="absolute top-2 right-2 text-pgold" fill="currentColor" />
            </div>
            <p className="text-[11px] font-semibold text-pmuted mt-1.5 text-center truncate">
              {t.label[lang]}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      {!isPremium && (
        <div className="mx-5 mt-6">
          <button onClick={buy} className="btn-premium-gold w-full h-[58px] rounded-[18px] text-[15px]">
            <Crown size={18} fill="currentColor" />
            {lang === 'ru' ? 'Получить Premium' : 'Premium olish'}
          </button>
          <p className="text-center text-[11px] text-psubtle mt-3">
            {lang === 'ru'
              ? "Оплата через Telegram Stars — безопасно и мгновенно"
              : "To'lov Telegram Stars orqali — xavfsiz va bir zumda"}
          </p>
        </div>
      )}
    </div>
  )
}
