import { useState, useEffect, useRef, memo } from 'react'
import {
  X,
  ChevronLeft,
  Check,
  Headphones,
  ShieldCheck,
  Pencil,
  Ticket,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { PREMIUM_PLANS, HIGHLIGHT_PLAN, getPlan, formatUzs, applyDiscount, type PlanKey, type PremiumPlan } from '../../../../shared/premium-plans'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { api } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import { track } from '../../../shared/lib/analytics'
import { openTelegramLink } from '../../../platform/telegram'
import Confetti from '../../../shared/components/Confetti'
import { cn } from '../../../shared/lib/cn'

interface SubscriptionModalProps {
  onClose: () => void
  initialPlanKey?: PlanKey
  onSuccess?: () => void
}

type Step = 'choose_plan' | 'payment_method'
type PaymentProvider = 'click' | 'payme' | 'stars'

// Tarif darajasi ikonkasi (payment.svg — money-diamond, currentColor)
const ClaudeTreeIcon = memo(function ClaudeTreeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || 'size-10 text-white/90'}
    >
      <path fill="currentColor" d="M30.47 28.95H32v1.53h-1.53Zm0-27.43h-1.52v1.53h-1.52v1.52h1.52V6.1h1.52V4.57H32V3.05h-1.53zm-1.52 21.34h1.52v1.52h-1.52Zm-1.52 1.52h1.52v1.53h-1.52Zm0-3.05h1.52v1.53h-1.52Zm0-6.09h1.52v1.52h-1.52Zm0-6.1h1.52v1.53h-1.52ZM25.9 22.86h1.53v1.52H25.9Zm0-6.1h1.53v1.53H25.9Zm0-9.14h1.53v1.52H25.9Zm-1.52 10.67h1.52v1.52h-1.52Zm0-12.19h1.52v1.52h-1.52Zm0 25.9v-1.52h1.52v-1.53h-1.52v-1.52h-1.53v1.52h-1.52v1.53h1.52V32zm-1.53-12.19h1.53v1.52h-1.53Zm-1.52 1.52h1.52v1.53h-1.52Zm0-6.09h1.52v1.52h-1.52Zm0-6.1h1.52v1.53h-1.52Zm0-7.62h1.52v1.53h-1.52Zm-1.52 21.34h1.52v1.52h-1.52Zm0-6.1h1.52v3.05h-1.52Zm0-9.14h1.52v1.52h-1.52Z"/>
      <path fill="currentColor" d="M18.28 19.81h1.53v3.05h-1.53Zm0 3.05h-1.52v4.57h1.52v-1.52h1.53v-1.53h-1.53zM16.76 0h1.52v1.52h-1.52Zm-3.05 27.43h3.05v1.52h-3.05Zm0-4.57h-1.52v1.52h-1.53v1.53h1.53v1.52h1.52zm-3.05-3.05h1.53v3.05h-1.53Zm-1.52 3.05h1.52v1.52H9.14Zm0-6.1h1.52v3.05H9.14Zm0-9.14h1.52v1.52H9.14Zm0-6.1h1.52v1.53H9.14ZM7.62 27.43h1.52v1.52H7.62Zm0-6.1h1.52v1.53H7.62Zm0-6.09h1.52v1.52H7.62Zm0-6.1h1.52v1.53H7.62Zm3.04-3.04v1.52h1.53V6.1h6.09v1.52h1.53V6.1h4.57V4.57H6.09V6.1zM6.09 19.81h1.53v1.52H6.09Zm-1.52-1.52h1.52v1.52H4.57Zm0-12.19h1.52v1.52H4.57ZM3.04 24.38h1.53v1.53H3.04Zm0-7.62h1.53v1.53H3.04Zm0-9.14h1.53v1.52H3.04ZM1.52 30.48h1.52V32H1.52Zm0-4.57h1.52v1.52H1.52Zm0-3.05h1.52v1.52H1.52Zm0-7.62h1.52v1.52H1.52Zm0-1.53h4.57v1.53h1.53v-1.53h15.23v1.53h1.53v-1.53h4.57v1.53h1.52v-4.57h-1.52v1.52h-4.57v-1.52h-1.53v1.52H7.62v-1.52H6.09v1.52H1.52v-1.52H0v4.57h1.52zm0-4.57h1.52v1.53H1.52Zm0-4.57h1.52V3.05h1.53V1.52H3.04V0H1.52v1.52H0v1.53h1.52zM0 24.38h1.52v1.53H0Z"/>
    </svg>
  )
})
const ClickLogo = memo(function ClickLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 157 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || 'h-[18px] w-auto'}
      aria-label="Click"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M39.3739 20.1572C39.3739 27.7941 27.2594 40.0006 19.6797 40.0006C12.1 40.0006 -0.0146637 27.7941 -0.0146637 20.1572C-0.0146637 12.5203 12.1 0.313477 19.6797 0.313477C27.2594 0.313477 39.3739 12.5203 39.3739 20.1572ZM27.5573 20.1572C27.5573 23.212 22.7113 28.0945 19.6797 28.0945C16.6477 28.0945 11.8019 23.212 11.8019 20.1572C11.8019 17.1025 16.6479 12.2197 19.6797 12.2197C22.7113 12.2197 27.5573 17.1025 27.5573 20.1572Z"
        fill="#0065FF"
      />
      <path
        d="M60.8212 39.9981C68.1709 39.9981 72.7769 35.3571 74.1744 29.2556H66.1004C65.1172 31.3415 63.5644 32.906 60.8212 32.906C57.5088 32.906 55.0764 30.5073 55.0764 26.3874C55.0764 22.2678 57.5088 19.8687 60.8212 19.8687C63.5644 19.8687 65.1172 21.4332 66.1004 23.5194H74.1744C72.7769 17.4179 68.1709 12.7766 60.8212 12.7766C52.9541 12.7766 47.2093 18.826 47.2093 26.3874C47.2093 33.9491 52.9541 39.9981 60.8212 39.9981ZM76.9305 39.4246H84.7459V0.313209H76.9305V39.4246ZM93.2986 9.80409C96.0417 9.80409 98.2155 7.61389 98.2155 4.90212C98.2155 2.19056 96.0417 0.000366211 93.2986 0.000366211C90.6592 0.000366211 88.4334 2.19056 88.4334 4.90212C88.4334 7.61389 90.6592 9.80409 93.2986 9.80409ZM89.4169 39.4246H97.2323V13.3504H89.4169V39.4246ZM113.963 39.9981C121.312 39.9981 125.918 35.3571 127.316 29.2556H119.242C118.258 31.3415 116.706 32.906 113.963 32.906C110.65 32.906 108.218 30.5073 108.218 26.3874C108.218 22.2678 110.65 19.8687 113.963 19.8687C116.706 19.8687 118.258 21.4332 119.242 23.5194H127.316C125.918 17.4179 121.312 12.7766 113.963 12.7766C106.096 12.7766 100.351 18.826 100.351 26.3874C100.351 33.9491 106.096 39.9981 113.963 39.9981ZM147.514 39.4246H156.985L145.185 25.136L154.708 13.3504H145.443L137.887 22.6849V0.313209H130.072V39.4246H137.887V27.7954L147.514 39.4246Z"
        fill="currentColor"
      />
    </svg>
  )
})

export default function SubscriptionModal({
  onClose,
  initialPlanKey = HIGHLIGHT_PLAN,
  onSuccess,
}: SubscriptionModalProps) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const user = useAppStore((s) => s.user)
  const userId = user?.id
  const syncFromServer = useAppStore((s) => s.syncFromServer)

  const [step, setStep] = useState<Step>('choose_plan')
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>(initialPlanKey)
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('click')

  const [loadingProvider, setLoadingProvider] = useState<PaymentProvider | null>(null)
  const [isWaitingPayment, setIsWaitingPayment] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Promokod (chegirma) holati ──
  const [promoInput, setPromoInput] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  /** Qo'llangan chegirma: { code, percent } — narx SHUNDAN hisoblanadi */
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  const pollTimerRef = useRef<any>(null)

  const selectedPlan: PremiumPlan = getPlan(selectedPlanKey) ?? PREMIUM_PLANS[1]
  /** Yakuniy narx — promokod chegirmasi bilan (server XUDDI SHU summani yozadi) */
  const finalPriceUzs = appliedPromo ? applyDiscount(selectedPlan.priceUzs, appliedPromo.percent) : selectedPlan.priceUzs

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // To'lov holatini tekshirish (polling)
  const startPolling = (orderId: string, providerName: PaymentProvider) => {
    setIsWaitingPayment(true)
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)

    let attempts = 0
    pollTimerRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await api.checkPaymentOrder(orderId)
        if (res.status === 'completed') {
          clearInterval(pollTimerRef.current)
          setIsWaitingPayment(false)
          setIsSuccess(true)
          playSound('win')
          if (userId) {
            await syncFromServer(userId)
          }
          track('premium_payment_success', { plan: selectedPlan.key, provider: providerName })
          if (onSuccess) onSuccess()
        } else if (res.status === 'cancelled' || res.status === 'failed') {
          clearInterval(pollTimerRef.current)
          setIsWaitingPayment(false)
          setErrorMsg(
            lang === 'ru'
              ? 'Оплата была отменена или произошла ошибка'
              : "To'lov bekor qilindi yoki xatolik yuz berdi"
          )
        }
      } catch {
        // network retry
      }

      if (attempts >= 60) {
        clearInterval(pollTimerRef.current)
        setIsWaitingPayment(false)
      }
    }, 3000)
  }

  // Promokodni tekshirish (redeem EMAS — ishlatilgan deb belgilash to'lov
  // completion'da serverda bo'ladi; bekor buyurtma kodni kuydirmaydi)
  const handleApplyPromo = async () => {
    const code = promoInput.trim()
    if (!code || promoBusy) return
    setPromoBusy(true)
    setPromoError(null)
    try {
      const res = await api.checkPromoDiscount(code)
      setAppliedPromo({ code: res.code, percent: res.discountPercent })
      playSound('toggle')
      track('premium_promo_applied', { plan: selectedPlan.key, percent: res.discountPercent })
    } catch (err: any) {
      setAppliedPromo(null)
      const code_ = err?.code as string | undefined
      setPromoError(
        code_ === 'PROMO_NOT_DISCOUNT'
          ? tt('promoNotDiscount')
          : tt('promoInvalid')
      )
    } finally {
      setPromoBusy(false)
    }
  }

  const clearPromo = () => {
    setAppliedPromo(null)
    setPromoInput('')
    setPromoError(null)
  }

  // To'lovni boshlash
  const handleProceedToPayment = async () => {
    setErrorMsg(null)

    if (selectedProvider === 'stars') {
      track('premium_stars_click', { plan: selectedPlan.key })
      openTelegramLink(`https://t.me/kiwi_uz_bot?start=premium_${selectedPlan.key}`)
      onClose()
      return
    }

    setLoadingProvider(selectedProvider)
    track('premium_checkout_start', { plan: selectedPlan.key, provider: selectedProvider })

    try {
      const res = await api.createPaymentOrder({
        plan: selectedPlan.key,
        provider: selectedProvider,
        ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
      })

      if (res.paymentUrl) {
        openTelegramLink(res.paymentUrl)
        startPolling(res.orderId, selectedProvider)
      } else {
        throw new Error('No payment URL returned')
      }
    } catch (err: any) {
      // Promokod serverda rad etilgan bo'lsa (limit/eskirgan) — tozalaymiz
      if (err?.code && String(err.code).startsWith('PROMO_')) {
        clearPromo()
        setPromoError(tt('promoInvalid'))
      }
      setErrorMsg(
        lang === 'ru'
          ? 'Не удалось создать платеж. Попробуйте еще раз.'
          : "To'lov yaratishda xatolik yuz berdi. Qaytadan urinib ko'ring."
      )
    } finally {
      setLoadingProvider(null)
    }
  }

  // Yordam olish
  const handleGetHelp = () => {
    haptics.impact('light')
    openTelegramLink('https://t.me/kiwi_uz_bot')
  }

  return (
    <DialogOverlay
      onClose={onClose}
      position="bottom"
      labelId="subscription-modal-title"
      className="animate-fadeIn"
      backdropClassName="bg-black/60"
    >
      {isSuccess && <Confetti count={40} />}

      <div
        className="w-full max-w-lg mx-auto bg-pcard border-t border-pline sm:border sm:border-pline sm:rounded-t-3xl rounded-t-[28px] shadow-2xl relative animate-slideUp text-pfg select-none max-h-[94vh] flex flex-col overflow-hidden font-display"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Yuqori surish tutqichi (Drag Handle) */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-plineStrong" />
        </div>

        {/* ── STEP 1: TARIFNI TANLANG (Claude Style Accordion) ── */}
        {step === 'choose_plan' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header: ← Upgrade */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-pline shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="size-8 rounded-full hover:bg-psurface text-pmuted hover:text-pfg transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
                  aria-label="Orqaga"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 id="subscription-modal-title" className="text-[17px] font-semibold text-pfg tracking-tight">
                  {lang === 'ru' ? 'Обновление тарифа' : 'Tarifni yangilash'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Yopish"
                className="size-8 rounded-full hover:bg-psurface text-psubtle hover:text-pfg transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Plans List (Claude.ai bosilganda ochiladigan akordeon kartalari) */}
            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 overscroll-contain">
              {PREMIUM_PLANS.map((plan) => {
                const isSelected = selectedPlanKey === plan.key
                const tierName = lang === 'ru' ? plan.tierNameRu : plan.tierNameUz
                const badgeText = lang === 'ru' ? plan.badgeRu : plan.badgeUz
                const features = lang === 'ru' ? plan.featuresRu : plan.featuresUz

                return (
                  <div
                    key={plan.key}
                    onClick={() => {
                      haptics.impact('light')
                      setSelectedPlanKey(plan.key)
                    }}
                    className={cn(
                      'rounded-2xl transition-all duration-200 text-left p-4 cursor-pointer relative overflow-hidden',
                      isSelected
                        ? 'border-2 border-pprimary bg-psurface shadow-lg ring-1 ring-pprimary/20'
                        : 'border border-pline bg-psurface/40 hover:border-plineStrong active:scale-[0.99]'
                    )}
                  >
                    {/* Yuqori qator: Claude Geometrik Daraxt Ikonkasi + Nom + Tavsif + Narx */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ClaudeTreeIcon className={cn('size-10 shrink-0 transition-opacity', isSelected ? 'text-pprimary' : 'text-pmuted')} />
                        <div className="min-w-0">
                          <span className="text-[17px] font-bold text-pfg tracking-tight block">
                            {tierName}
                          </span>
                          <p className="text-[12.5px] text-pmuted mt-0.5 leading-snug font-normal">
                            {badgeText}
                          </p>
                        </div>
                      </div>

                      {/* Narx va Muddat */}
                      <div className="text-right flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-1 rounded-full bg-psurface border border-pline px-2.5 py-0.5 text-[10.5px]">
                          <span className="font-semibold text-pfg">
                            {lang === 'ru' ? plan.periodRu : plan.periodUz}
                          </span>
                          {plan.discountPercent > 0 && (
                            <span className="font-bold text-pblue">
                              -{plan.discountPercent}%
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-end">
                          <span className="text-[18px] font-extrabold text-pfg tabular-nums tracking-tight">
                            {formatUzs(plan.priceUzs, lang)}
                          </span>
                        </div>
                        {plan.originalPriceUzs > plan.priceUzs && (
                          <span className="text-[11px] text-psubtle line-through tabular-nums -mt-0.5">
                            {formatUzs(plan.originalPriceUzs, lang)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ochiladigan Imkoniyatlar Ro'yxati (Expanded Checklist) */}
                    {isSelected && (
                      <div className="mt-4 pt-3.5 border-t border-pline space-y-2.5 animate-fadeIn">
                        <p className="text-[12.5px] font-semibold text-pfg">
                          {lang === 'ru' ? 'Все возможности тарифа:' : "Tarifdagi barcha imkoniyatlar:"}
                        </p>
                        {features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            {/* Claude uslubidagi oddiy, dumaloqsiz pitechka */}
                            <Check size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-pprimary" />
                            <span className="text-[13px] text-pfg/90 font-normal leading-relaxed">
                              {feat}
                            </span>
                          </div>
                        ))}

                        {plan.key === 'lifetime' && (
                          <div className="pt-1 flex items-center gap-1 text-[11.5px] font-semibold text-pprimary">
                            <Sparkles size={13} />
                            <span>{tt('specialOfferDetail')}</span>
                            <ChevronRight size={13} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pastki Harakat Tugmasi: Davom etish (Theme-adaptive CTA) */}
            <div className="p-4 sm:p-5 border-t border-pline bg-pcard shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSound('toggle')
                  haptics.impact('medium')
                  setStep('payment_method')
                }}
                className="w-full py-4 px-6 rounded-2xl bg-pprimary text-ponprimary hover:brightness-[1.06] active:scale-[0.98] font-bold text-[15.5px] tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>{tt('continueAction')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: TO'LOV USULINI TANLANG ── */}
        {step === 'payment_method' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header with Back button & Help link */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-pline shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('choose_plan')}
                  className="size-8 rounded-full hover:bg-psurface text-pmuted hover:text-pfg transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
                  aria-label="Orqaga"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-[17px] font-bold tracking-tight text-pfg">
                  {tt('selectPaymentTitle')}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleGetHelp}
                  className="inline-flex items-center gap-1.5 rounded-full bg-psurface hover:bg-pcanvas border border-pline px-3 py-1 text-[11px] font-semibold text-pmuted hover:text-pfg transition-colors cursor-pointer"
                >
                  <Headphones size={12} />
                  <span>{tt('getHelp')}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Yopish"
                  className="size-8 rounded-full hover:bg-psurface text-psubtle hover:text-pfg transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Success Screen */}
              {isSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="size-16 rounded-full border border-psuccess/40 bg-psuccess/15 text-psuccess mx-auto flex items-center justify-center animate-bounce shadow-md">
                    <CheckCircle2 size={34} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-pfg">
                      {lang === 'ru' ? 'Оплата прошла успешно!' : "To'lov muvaffaqiyatli amalga oshirildi!"}
                    </h3>
                    <p className="text-[13px] text-pmuted mt-1">
                      {lang === 'ru'
                        ? 'Премиум подписка активирована. Приятного обучения!'
                        : "Premium obuna faollashdi. Unumli bilim olishingizni tilaymiz!"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 rounded-xl bg-pprimary text-ponprimary font-bold text-sm hover:brightness-[1.06] active:scale-98 transition-all cursor-pointer shadow-md"
                  >
                    {lang === 'ru' ? 'Отлично' : 'Ajoyib'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Tanlangan Tarif Kartasi */}
                  <div className="rounded-2xl border border-pline bg-psurface p-4 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <ClaudeTreeIcon className="size-8 text-pprimary shrink-0" />
                      <div>
                        <p className="text-[16px] font-bold text-pfg">
                          {lang === 'ru' ? selectedPlan.tierNameRu : selectedPlan.tierNameUz}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-pmuted">
                            {lang === 'ru' ? selectedPlan.periodRu : selectedPlan.periodUz} · {lang === 'ru' ? selectedPlan.badgeRu : selectedPlan.badgeUz}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[17px] font-bold text-pfg tabular-nums">
                        {formatUzs(finalPriceUzs, lang)}
                      </span>
                      {appliedPromo && (
                        <span className="block text-[11px] text-psubtle line-through tabular-nums">
                          {formatUzs(selectedPlan.priceUzs, lang)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tasdiqlangan Raqam */}
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-semibold text-pmuted">
                      {tt('verifiedPhone')}
                    </p>
                    <div className="rounded-2xl border border-pline bg-psurface p-3.5 flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck size={19} className="text-pmuted" />
                        <span className="text-[14px] font-semibold text-pfg tabular-nums tracking-wide">
                          {user?.phone ? user.phone : tt('phoneNotSet')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          onClose()
                        }}
                        aria-label="Tahrirlash"
                        className="p-1.5 rounded-lg text-pmuted hover:text-pfg hover:bg-psurface transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>

                  {/* To'lov Tizimlari Tanlovi */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[12px] font-semibold text-pmuted">
                      {tt('paymentMethodLabel')}: <span className="text-pfg capitalize font-bold">{selectedProvider}</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {/* 1. Click */}
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          setSelectedProvider('click')
                        }}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer',
                          selectedProvider === 'click'
                            ? 'border-2 border-pprimary bg-pprimary/10 text-pfg font-bold shadow-sm'
                            : 'border-pline bg-psurface text-pmuted hover:border-plineStrong hover:text-pfg'
                        )}
                      >
                        <ClickLogo className="h-[18px] w-auto" />
                      </button>

                      {/* 2. Payme */}
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          setSelectedProvider('payme')
                        }}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer',
                          selectedProvider === 'payme'
                            ? 'border-2 border-pprimary bg-pprimary/10 text-pfg font-bold shadow-sm'
                            : 'border-pline bg-psurface text-pmuted hover:border-plineStrong hover:text-pfg'
                        )}
                      >
                        <img src="/payme.svg" alt="Payme" className="h-[18px] w-auto" />
                      </button>

                      {/* 3. Telegram Stars */}
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          setSelectedProvider('stars')
                        }}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer',
                          selectedProvider === 'stars'
                            ? 'border-2 border-pprimary bg-pprimary/10 text-pfg font-bold shadow-sm'
                            : 'border-pline bg-psurface text-pmuted hover:border-plineStrong hover:text-pfg'
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <img src="/stars.svg" alt="" className="h-[18px] w-auto" />
                          <span className="text-[13.5px] font-bold tracking-tight">Stars</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Promokod — chegirma (kod to'lov COMPLETION'da ishlatilgan
                      deb belgilanadi; bekor buyurtma kodni kuydirmaydi) */}
                  <div className="space-y-2 pt-1">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between rounded-2xl border border-psuccess/30 bg-psuccess/10 p-3.5">
                        <div className="flex items-center gap-2.5">
                          <Ticket size={16} className="text-psuccess" />
                          <span className="text-[13px] font-bold text-psuccess">
                            {appliedPromo.code} · −{appliedPromo.percent}%
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={clearPromo}
                          aria-label={tt('cancel')}
                          className="p-1.5 rounded-lg text-psuccess/60 hover:text-psuccess hover:bg-psurface transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2.5">
                        <div className="flex-1 flex items-center gap-2 rounded-2xl border border-pline bg-psurface px-3.5">
                          <Ticket size={14} className="text-pmuted shrink-0" />
                          <input
                            value={promoInput}
                            onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null) }}
                            placeholder={tt('promoInputPlaceholder')}
                            maxLength={30}
                            disabled={promoBusy || isWaitingPayment}
                            className="flex-1 min-w-0 bg-transparent outline-none py-3 text-[13px] font-semibold text-pfg placeholder:text-psubtle tracking-wider uppercase"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={!promoInput.trim() || promoBusy || isWaitingPayment}
                          className="px-4 py-3 rounded-2xl border border-pline bg-psurface text-[13px] font-bold text-pfg hover:bg-pcanvas disabled:opacity-40 active:scale-95 transition-all cursor-pointer shrink-0"
                        >
                          {promoBusy ? <Loader2 size={15} className="animate-spin" /> : tt('promoApply')}
                        </button>
                      </div>
                    )}
                    {promoError && (
                      <p className="text-[12px] text-pdanger px-1">{promoError}</p>
                    )}
                  </div>

                  {/* Polling / Waiting Indicator */}
                  {isWaitingPayment && (
                    <div className="p-3.5 rounded-2xl bg-pblue/10 border border-pblue/30 flex items-center gap-3">
                      <Loader2 size={19} className="text-pblue animate-spin shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-pfg">
                          {lang === 'ru' ? 'Ожидание подтверждения оплаты...' : "To'lov tasdiqlanishi kutilmoqda..."}
                        </p>
                        <p className="text-[11.5px] text-pmuted mt-0.5">
                          {lang === 'ru'
                            ? 'Оплатите через приложение, Premium включится автоматически'
                            : "Ilova orqali to'lang, Premium avtomatik yoqiladi"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {errorMsg && (
                    <div className="p-3.5 rounded-2xl bg-pdanger/10 border border-pdanger/30 text-pdanger text-xs flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pastki Harakat Tugmasi: To'lash (Theme-adaptive CTA) */}
            {!isSuccess && (
              <div className="p-4 sm:p-5 border-t border-pline bg-pcard shrink-0">
                <button
                  type="button"
                  disabled={loadingProvider !== null || isWaitingPayment}
                  onClick={handleProceedToPayment}
                  className="w-full py-4 px-6 rounded-2xl bg-pprimary text-ponprimary hover:brightness-[1.06] disabled:opacity-50 active:scale-[0.98] font-bold text-[15.5px] tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loadingProvider !== null ? (
                    <Loader2 size={19} className="animate-spin text-ponprimary" />
                  ) : (
                    <>
                      <span>
                        {selectedProvider === 'stars'
                          ? `${tt('payWithStarsAction')} (${selectedPlan.stars} Stars)`
                          : `${tt('payAmount')} ${formatUzs(finalPriceUzs, lang)}`}
                      </span>
                      <ExternalLink size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
