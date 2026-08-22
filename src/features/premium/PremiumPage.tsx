/**
 * Premium sahifasi — obuna showcase.
 *  - Hero: gold Crown + sarlavha
 *  - Imkoniyatlar ro'yxati (semantik ikonlar)
 *  - Premium temalar showcase (src/config/themes.ts dan — YAGONA MANBA)
 *  - CTA → Telegram bot (to'lov Telegram Stars orqali)
 *  KPI: banner'dagi track('premium_click') saqlanadi.
 */
import { useState } from 'react'
import { Crown, Sparkles, Bot, Palette, HeartCrack, Zap, Check, CheckCircle2, ChevronLeft, Gift, Loader2, Star, Ticket } from 'lucide-react'
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
  const user = useAppStore((s) => s.user)
  const userId = user?.id
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
        <h1 className="text-lg font-semibold tracking-tight">Premium</h1>
      </div>

      {/* Hero — dark glass + oltin */}
      <div className="mx-5 mt-2 rounded-[28px] p-6 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgb(var(--p-gold-rgb) / 0.10) 0%, var(--p-card) 55%)',
          border: '1px solid rgb(var(--p-gold-rgb) / 0.30)',
        }}>
        <div className="w-16 h-16 mx-auto rounded-container flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(135deg, var(--p-gold), var(--p-gold-deep))',
          }}>
          <Crown size={28} strokeWidth={1.75} className="text-pongold" />
        </div>
        <h2 className="text-[24px] font-semibold tracking-tight">KIWI Premium</h2>
        <p className="text-[13px] text-pmuted mt-1.5 leading-relaxed max-w-[260px] mx-auto">
          {lang === 'ru'
            ? 'Все возможности без ограничений — в одной подписке'
            : 'Barcha imkoniyatlar — bitta obunada, cheksiz'}
        </p>
        {isPremium && (
          <div className="mt-4 flex flex-col items-center gap-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{
                background: 'rgb(var(--p-success-rgb) / 0.15)',
                border: '1px solid rgb(var(--p-success-rgb) / 0.4)',
                color: 'var(--p-success)',
              }}>
              <Check size={13} /> {lang === 'ru' ? 'Подписка активна' : 'Obuna faol'}
            </span>
            {user?.premiumUntil ? (
              <span className="text-[11.5px] text-pmuted font-medium">
                {(() => {
                  const days = Math.max(0, Math.ceil((new Date(user.premiumUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                  if (days === 0) return lang === 'ru' ? 'Заканчивается сегодня' : 'Bugun tugaydi'
                  return lang === 'ru' ? `Осталось ${days} дн.` : `${days} kun qoldi`
                })()}
              </span>
            ) : (
              <span className="text-[11.5px] text-pgold font-medium">
                {lang === 'ru' ? 'Навсегда' : 'Umrbod faol'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Imkoniyatlar */}
      <div className="mx-5 mt-4 rounded-container border border-pline bg-pcard divide-y divide-pline">
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
            <div className="h-[72px] rounded-container overflow-hidden border border-pline relative"
              style={{ background: t.bg }}>
              <div className="absolute left-2 right-2 top-2 h-6 rounded-lg"
                style={{ background: t.card, border: `1px solid ${t.color}4d` }} />
              <span className="absolute bottom-2 left-2 w-8 h-2 rounded-full"
                style={{ background: t.color }} />
              <Crown size={12} strokeWidth={1.75} className="absolute right-2 top-2 text-pgold" />
            </div>
            <p className="text-[11px] font-semibold text-pmuted mt-1.5 text-center truncate">
              {t.label[lang]}
            </p>
          </div>
        ))}
      </div>

      {/* 3 kunlik BEPUL trial — 1 marta */}
      {!isPremium && !trialDone && (
        <div className="mx-5 mt-4">
          <button onClick={startTrial} disabled={trialBusy}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] rounded-control flex h-[52px] w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40">
            {trialBusy ? <Loader2 size={19} strokeWidth={1.75} className="motion-safe:animate-spin" /> : <Gift size={19} />}
            {lang === 'ru' ? '3 дня Premium — бесплатно' : '3 kun Premium — bepul'}
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
        <div className="mx-5 mt-4 rounded-container border border-[rgb(var(--p-success-rgb)/0.35)] bg-[rgb(var(--p-success-rgb)/0.09)] p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[14px] font-semibold text-psuccess">
            <CheckCircle2 size={16} strokeWidth={1.75} />
            {lang === 'ru' ? 'Пробный период активирован' : 'Sinov muddati faollashdi'}
          </p>
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
                  className="rounded-container border border-pline bg-pcard relative w-full p-4 text-left active:scale-[0.98] transition-transform"
                  style={highlight ? { borderColor: 'var(--p-gold)' } : undefined}>
                  {highlight && (
                    <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-pgold px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-pongold">
                      <Star size={9} strokeWidth={2} />
                      {lang === 'ru' ? 'Самый популярный' : 'Eng mashhur'}
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-pfg">
                        {lang === 'ru' ? plan.titleRu : plan.titleUz}
                      </p>
                      <p className="text-[11.5px] text-psubtle mt-0.5">
                        {lang === 'ru' ? plan.periodRu : plan.periodUz}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="bg-pgold text-pongold font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 px-3.5 py-1.5 rounded-control text-[13px] inline-block font-semibold">
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
              className="text-xs font-semibold text-ppurple hover:underline inline-flex items-center gap-1.5 active:opacity-70 transition-opacity"
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
