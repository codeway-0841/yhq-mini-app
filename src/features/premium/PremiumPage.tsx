/**
 * Premium sahifasi — obuna showcase.
 *  - Hero: gold Crown + sarlavha
 *  - Imkoniyatlar ro'yxati (semantik ikonlar)
 *  - Premium temalar showcase (src/config/themes.ts dan — YAGONA MANBA)
 *  - CTA → Telegram bot (to'lov Telegram Stars orqali)
 *  KPI: banner'dagi track('premium_click') saqlanadi.
 */
import { useState } from 'react'
import { Crown, Sparkles, Bot, Palette, HeartCrack, Zap, Check, ChevronLeft, Gift, Loader2, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { api } from '../../shared/api'
import { ACCENT_THEMES } from '../../shared/config/themes'
import { PREMIUM_PLANS, HIGHLIGHT_PLAN, type PremiumPlan, formatUzs } from '../../../shared/premium-plans'
import { playSound } from '../../shared/lib/sounds'
import { track } from '../../shared/lib/analytics'
import Confetti from '../../shared/components/Confetti'
import PromoCodeModal from '../../shared/components/PromoCodeModal'
import PaymentMethodModal from './components/PaymentMethodModal'

const BENEFITS = [
  { icon: Sparkles,   color: 'var(--p-gold)',    uz: 'Reklamasiz tajriba',                 ru: 'Без рекламы' },
  { icon: Bot,        color: 'var(--p-purple)',  uz: 'AI Tutor — chuqur tushuntirishlar', ru: 'ИИ-тьютор — подробные объяснения' },
  { icon: Palette,    color: 'var(--p-primary)', uz: `${ACCENT_THEMES.filter((t) => t.premium).length} ta eksklyuziv tema`, ru: `${ACCENT_THEMES.filter((t) => t.premium).length} эксклюзивных тем` },
  { icon: HeartCrack, color: 'var(--p-danger)',  uz: "Xatolar bo'yicha chuqur tahlil",       ru: 'Глубокий анализ ошибок' },
  { icon: Zap,        color: 'var(--p-blue)',    uz: 'Cheksiz mashq rejimlari',            ru: 'Безлимитные режимы практики' },
]

export default function PremiumPage() {
  const navigate = useNavigate()
  const lang     = useAppStore((s) => s.settings.language)
  const isPremium = useAppStore((s) => s.tariff === 'premium')

  const premiumThemes = ACCENT_THEMES.filter((t) => t.premium)

  const [trialBusy, setTrialBusy]   = useState(false)
  const [trialDone, setTrialDone]   = useState(false)
  const [trialError, setTrialError] = useState<string | null>(null)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PremiumPlan | null>(null)
  const userId = useAppStore((s) => s.user?.id)
  const syncFromServer = useAppStore((s) => s.syncFromServer)

  // 3 kunlik BEPUL trial — backend faqat 1 marta beradi
  const startTrial = async () => {
    if (!userId || trialBusy) return
    setTrialBusy(true)
    setTrialError(null)
    try {
      const r = await api.startTrial(userId)
      if (r.granted) {
        track('premium_trial_start')
        playSound('win')
        setTrialDone(true)
        await syncFromServer(userId)  // tariff darhol yangilanadi
      } else {
        setTrialError(lang === 'ru'
          ? 'Пробный период уже был использован'
          : "Sinov muddati allaqachon ishlatilgan")
      }
    } catch {
      setTrialError(lang === 'ru' ? 'Ошибка. Попробуйте ещё раз' : 'Xatolik. Qayta urinib ko\'ring')
    } finally {
      setTrialBusy(false)
    }
  }

  return (
    <div className="font-display min-h-screen bg-pcanvas text-pfg pb-10">
      {trialDone && <Confetti count={36} />}
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

      {/* 🎁 3 kunlik BEPUL trial — 1 marta */}
      {!isPremium && !trialDone && (
        <div className="mx-5 mt-4">
          <button onClick={startTrial} disabled={trialBusy}
            className="btn-neon w-full h-[58px] rounded-[18px] text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {trialBusy ? <Loader2 size={19} className="animate-spin" /> : <Gift size={19} />}
            {lang === 'ru' ? '🎁 3 дня Premium — бесплатно' : '🎁 3 kun Premium — BEPUL'}
          </button>
          {trialError && (
            <p className="text-center text-[11.5px] text-pwarning font-medium mt-2">{trialError}</p>
          )}
          <p className="text-center text-[10.5px] text-psubtle mt-1.5">
            {lang === 'ru' ? 'Один раз · без оплаты · отмена не нужна' : "Faqat 1 marta · to'lovsiz · bekor qilish shart emas"}
          </p>
        </div>
      )}
      {trialDone && (
        <div className="mx-5 mt-4 card-premium p-4 text-center"
          style={{ borderColor: 'rgba(34,197,94,0.4)' }}>
          <p className="text-[14px] font-bold text-psuccess">🎉 {lang === 'ru' ? 'Пробный период активирован!' : 'Sinov muddati faollashdi!'}</p>
          <p className="text-[11.5px] text-pmuted mt-1">
            {lang === 'ru' ? '3 дня полного доступа ко всем функциям' : "3 kun davomida barcha funksiyalardan to'liq foydalaning"}
          </p>
        </div>
      )}

      {/* Tarif rejalari */}
      {!isPremium && (
        <>
          <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">
            {lang === 'ru' ? 'Выберите тариф' : 'Tarifni tanlang'}
          </p>
          <div className="mx-5 flex flex-col gap-3">
            {PREMIUM_PLANS.map((plan) => {
              const highlight = plan.key === HIGHLIGHT_PLAN
              return (
                <button key={plan.key} onClick={() => setSelectedPlanForPayment(plan)}
                  className="card-premium relative w-full p-4 text-left active:scale-[0.98] transition-transform"
                  style={highlight ? { borderColor: 'var(--p-gold)', borderWidth: 1.5, boxShadow: '0 0 30px -8px rgba(250,204,21,0.35)' } : undefined}>
                  {highlight && (
                    <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-[#fde047] to-[#eab308] text-[#241a00] text-[9.5px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full">
                      ★ {lang === 'ru' ? 'Самый популярный' : 'Eng mashhur'}
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold text-pfg">
                        {lang === 'ru' ? plan.titleRu : plan.titleUz}
                      </p>
                      <p className="text-[11.5px] text-psubtle mt-0.5">
                        {lang === 'ru' ? plan.periodRu : plan.periodUz}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="btn-premium-gold px-3.5 py-1.5 rounded-xl text-[13px] inline-block font-black">
                        {formatUzs(plan.priceUzs, lang)}
                      </span>
                      <span className="text-[10px] text-pmuted block mt-0.5">
                        ⭐ {plan.stars} Stars
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-center text-[11px] text-psubtle mt-3 px-5">
            {lang === 'ru'
              ? "Оплата через Click (Uzcard / Humo) или Telegram Stars"
              : "To'lov Click (Uzcard / Humo) yoki Telegram Stars orqali"}
          </p>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setShowPromoModal(true)}
              className="text-xs font-bold text-duo-purple hover:underline inline-flex items-center gap-1.5 active:opacity-70 transition-opacity"
            >
              <Ticket size={14} />
              {lang === 'ru' ? 'У вас есть промокод?' : 'Promokodingiz bormi?'}
            </button>
          </div>
        </>
      )}

      {/* To'lov usulini tanlash modali */}
      {selectedPlanForPayment && (
        <PaymentMethodModal
          plan={selectedPlanForPayment}
          language={lang}
          onClose={() => setSelectedPlanForPayment(null)}
        />
      )}

      {/* Promokod kiritish modali */}
      {showPromoModal && (
        <PromoCodeModal
          language={lang}
          onClose={() => setShowPromoModal(false)}
        />
      )}
    </div>
  )
}
