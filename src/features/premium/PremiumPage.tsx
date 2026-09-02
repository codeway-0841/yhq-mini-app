/**
 * Premium sahifasi — obuna showcase.
 *  - Ixcham status kartasi (oltin chip + sarlavha; faol obuna — bitta qator)
 *  - Imkoniyatlar ro'yxati (ikonkalar NEYTRAL — rang intizomi, qoida 8)
 *  - Premium temalar showcase (src/config/themes.ts dan — YAGONA MANBA)
 *  - CTA → Telegram bot (to'lov Telegram Stars orqali)
 *  KPI: banner'dagi track('premium_click') saqlanadi.
 */
import { useState } from 'react'
import { Sparkles, Bot, Palette, HeartCrack, Zap, Check, CheckCircle2, ChevronLeft, Gift, Star, Ticket } from 'lucide-react'
import { PremiumIcon } from '../../shared/components/PremiumIcon'
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
import { Button } from '../../shared/components/ui/button'

const BENEFITS = [
  { icon: Sparkles,   uz: 'Reklamasiz tajriba',                 ru: 'Без рекламы' },
  { icon: Bot,        uz: 'AI Tutor — chuqur tushuntirishlar', ru: 'ИИ-тьютор — подробные объяснения' },
  { icon: Palette,    uz: `${ACCENT_THEMES.filter((t) => t.premium).length} ta eksklyuziv tema`, ru: `${ACCENT_THEMES.filter((t) => t.premium).length} эксклюзивных тем` },
  { icon: HeartCrack, uz: "Xatolar bo'yicha chuqur tahlil",       ru: 'Глубокий анализ ошибок' },
  { icon: Zap,        uz: 'Cheksiz mashq rejimlari',            ru: 'Безлимитные режимы практики' },
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
    <div className="font-display bg-pcanvas text-pfg pb-8">
      {trialDone && <Confetti count={36} />}
      {/* Header */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] px-5 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">Premium</h1>
      </header>

      {/* Status kartasi — ixcham, chap tekislangan (profil tarif kartasi ritmi) */}
      <div className="mx-5 mt-2 rounded-2xl border border-pline bg-pcard px-4 py-3.5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <PremiumIcon size={24} className="shrink-0 text-pmuted" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold tracking-tight">KIVVI Premium</h2>
            <p className="text-[12px] text-pmuted mt-0.5 leading-snug">
              {lang === 'ru'
                ? 'Все возможности без ограничений — в одной подписке'
                : 'Barcha imkoniyatlar — bitta obunada, cheksiz'}
            </p>
          </div>
        </div>
        {isPremium && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-pline pt-3 text-[12px]">
            <Check size={13} strokeWidth={2} className="flex-none text-psuccess" />
            <span className="font-semibold text-psuccess">
              {lang === 'ru' ? 'Подписка активна' : 'Obuna faol'}
            </span>
            <span className="text-pmuted">
              · {user?.premiumUntil
                ? (() => {
                    const days = Math.max(0, Math.ceil((new Date(user.premiumUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                    if (days === 0) return lang === 'ru' ? 'заканчивается сегодня' : 'bugun tugaydi'
                    return lang === 'ru' ? `осталось ${days} дн.` : `${days} kun qoldi`
                  })()
                : (lang === 'ru' ? 'навсегда' : 'umrbod')}
            </span>
          </div>
        )}
      </div>

      {/* Imkoniyatlar */}
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">
        {lang === 'ru' ? 'Возможности' : 'Imkoniyatlar'}
      </p>
      <div className="mx-5 rounded-2xl border border-pline bg-pcard divide-y divide-pline shadow-xs overflow-hidden">
        {BENEFITS.map((b, i) => (
          <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
            <b.icon size={20} strokeWidth={1.75} className="shrink-0 text-pmuted" />
            <span className="text-[14.5px] font-medium text-pfg">{lang === 'ru' ? b.ru : b.uz}</span>
          </div>
        ))}
      </div>

      {/* Temalar showcase */}
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">
        {lang === 'ru' ? 'Эксклюзивные темы' : 'Eksklyuziv temalar'}
      </p>
      <div className="flex gap-3 px-5 overflow-x-auto pb-2 scroll-smooth-x">
        {premiumThemes.map((t) => (
          <div key={t.id} className="flex-none w-[104px]">
            <div className="h-[64px] rounded-xl overflow-hidden shadow-xs relative"
              style={{ background: t.bg }}>
              <div className="absolute left-2 right-2 top-2 h-5 rounded-[6px]"
                style={{ background: t.card, border: `1px solid ${t.color}4d` }} />
              <span className="absolute bottom-2 left-2 w-7 h-1.5 rounded-full"
                style={{ background: t.color }} />
            </div>
            <p className="text-[11px] font-medium text-pmuted mt-1.5 text-center truncate">
              {t.label[lang]}
            </p>
          </div>
        ))}
      </div>

      {/* 3 kunlik BEPUL trial — 1 marta */}
      {!isPremium && !trialDone && (
        <div className="mx-5 mt-5">
          <Button block size="lg" loading={trialBusy} onClick={startTrial}>
            <Gift size={18} strokeWidth={1.75} />
            {lang === 'ru' ? '3 дня Premium — бесплатно' : '3 kun Premium — bepul'}
          </Button>
          {trialError && (
            <p className="text-center text-[11.5px] text-pwarning font-medium mt-2">{trialError}</p>
          )}
          <p className="text-center text-[10.5px] text-psubtle mt-1.5">
            {lang === 'ru' ? 'Один раз · без оплаты · отмена не нужна' : "Faqat 1 marta · to'lovsiz · bekor qilish shart emas"}
          </p>
        </div>
      )}
      {trialDone && (
        <div className="mx-5 mt-4 rounded-2xl bg-[rgb(var(--p-success-rgb)/0.09)] p-4 text-center shadow-xs">
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
          <div className="mx-5 flex flex-col gap-2.5">
            {PREMIUM_PLANS.map((plan) => {
              const highlight = plan.key === HIGHLIGHT_PLAN
              return (
                <button key={plan.key} onClick={() => setSelectedPlanForPayment(plan)}
                  className={`rounded-2xl border bg-pcard relative w-full p-4 text-left active:scale-[0.98] transition-all shadow-xs hover:bg-psurface ${
                    highlight ? 'border-pprimary ring-1 ring-pprimary' : 'border-pline'
                  }`}>
                  {highlight && (
                    <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-pwash px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-pprimary shadow-xs">
                      {lang === 'ru' ? 'Самый популярный' : 'Eng mashhur'}
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-pfg">
                        {lang === 'ru' ? plan.tierNameRu : plan.tierNameUz}
                      </p>
                      <p className="text-[11.5px] text-psubtle mt-0.5">
                        {lang === 'ru' ? plan.periodRu : plan.periodUz}
                      </p>
                    </div>
                    <div className="text-right flex-none">
                      <p className="text-[14px] font-semibold text-pfg tabular-nums">
                        {formatUzs(plan.priceUzs, lang)}
                      </p>
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-pmuted tabular-nums">
                        <Star size={10} strokeWidth={1.75} className="text-pgold" fill="currentColor" />
                        {plan.stars} Stars
                      </p>
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
