import { useState, useEffect, useRef, memo } from 'react'
import {
  X,
  ChevronLeft,
  Check,
  Headphones,
  ShieldCheck,
  Pencil,
  Ticket,
  Gift,
  Star,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { PREMIUM_PLANS, HIGHLIGHT_PLAN, getPlan, formatUzs, type PlanKey, type PremiumPlan } from '../../../../shared/premium-plans'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { api } from '../../../shared/api'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import { track } from '../../../shared/lib/analytics'
import { openTelegramLink, shareUrl } from '../../../platform/telegram'
import Confetti from '../../../shared/components/Confetti'
import PromoCodeModal from '../../../shared/components/PromoCodeModal'
import { cn } from '../../../shared/lib/cn'

interface SubscriptionModalProps {
  onClose: () => void
  initialPlanKey?: PlanKey
  onSuccess?: () => void
}

type Step = 'choose_plan' | 'payment_method'
type PaymentProvider = 'click' | 'payme' | 'card' | 'stars'

// Claude.ai xarakterli geometrik daraxt ikonkasi
const ClaudeTreeIcon = memo(function ClaudeTreeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || 'size-10 text-white/90'}
    >
      {/* Yuqori bosh doira */}
      <circle cx="32" cy="16" r="7.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="32" cy="16" r="2.8" fill="currentColor" />
      {/* Markaziy tana */}
      <path d="M32 23.5V50" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {/* Chap shoxlar */}
      <path d="M32 35L19 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="17" cy="27" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M32 43L19 39" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="17" cy="38.5" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      {/* O'ng shoxlar */}
      <path d="M32 35L45 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="47" cy="27" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M32 43L45 39" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="47" cy="38.5" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      {/* Pastki tugunlar */}
      <circle cx="25" cy="50" r="2.8" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="39" cy="50" r="2.8" stroke="currentColor" strokeWidth="2.2" />
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
  const [showPromoModal, setShowPromoModal] = useState(false)

  const pollTimerRef = useRef<any>(null)

  const selectedPlan: PremiumPlan = getPlan(selectedPlanKey) ?? PREMIUM_PLANS[1]

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
        provider: 'click',
      })

      if (res.paymentUrl) {
        openTelegramLink(res.paymentUrl)
        startPolling(res.orderId, selectedProvider)
      } else {
        throw new Error('No payment URL returned')
      }
    } catch {
      setErrorMsg(
        lang === 'ru'
          ? 'Не удалось создать платеж. Попробуйте еще раз.'
          : "To'lov yaratishda xatolik yuz berdi. Qaytadan urinib ko'ring."
      )
    } finally {
      setLoadingProvider(null)
    }
  }

  // "Do'stim to'laydi" havolasi
  const handleShareWithFriend = () => {
    haptics.impact('light')
    const shareLink = `https://t.me/kiwi_uz_bot?start=premium_${selectedPlan.key}`
    shareUrl(shareLink, tt('payFriendShareText'))
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
      backdropClassName="bg-black/80 backdrop-blur-md"
    >
      {isSuccess && <Confetti count={40} />}

      <div
        className="w-full max-w-lg mx-auto bg-[#131312] border-t border-[#262624] sm:border sm:border-[#262624] sm:rounded-t-3xl rounded-t-[28px] shadow-2xl relative animate-slideUp text-white select-none max-h-[94vh] flex flex-col overflow-hidden font-display"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Yuqori surish tutqichi (Drag Handle) */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ── STEP 1: TARIFNI TANLANG (Claude Style Accordion) ── */}
        {step === 'choose_plan' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header: ← Upgrade */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-[#262624] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="size-8 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
                  aria-label="Orqaga"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 id="subscription-modal-title" className="text-[17px] font-semibold text-white tracking-tight">
                  {lang === 'ru' ? 'Обновление тарифа' : 'Tarifni yangilash'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Yopish"
                className="size-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
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
                        ? 'border-2 border-white bg-[#222220] ring-1 ring-white/20 shadow-lg'
                        : 'border border-[#2B2B28] bg-[#1E1E1D] hover:border-[#383834] active:scale-[0.99]'
                    )}
                  >
                    {/* Yuqori qator: Claude Geometrik Daraxt Ikonkasi + Nom + Tavsif + Narx */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ClaudeTreeIcon className={cn('size-10 shrink-0 transition-opacity', isSelected ? 'text-white' : 'text-white/60')} />
                        <div className="min-w-0">
                          <span className="text-[17px] font-bold text-white tracking-tight block">
                            {tierName}
                          </span>
                          <p className="text-[12.5px] text-white/60 mt-0.5 leading-snug font-normal">
                            {badgeText}
                          </p>
                        </div>
                      </div>

                      {/* Narx va Muddat */}
                      <div className="text-right flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-1 rounded-full bg-[#2A2A28] border border-[#383834] px-2.5 py-0.5 text-[10.5px]">
                          <span className="font-semibold text-white/90">
                            {lang === 'ru' ? plan.periodRu : plan.periodUz}
                          </span>
                          {plan.discountPercent > 0 && (
                            <span className="font-bold text-sky-400">
                              -{plan.discountPercent}%
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-end">
                          <span className="text-[18px] font-extrabold text-white tabular-nums tracking-tight">
                            {formatUzs(plan.priceUzs, lang)}
                          </span>
                        </div>
                        {plan.originalPriceUzs > plan.priceUzs && (
                          <span className="text-[11px] text-white/40 line-through tabular-nums -mt-0.5">
                            {formatUzs(plan.originalPriceUzs, lang)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ochiladigan Imkoniyatlar Ro'yxati (Expanded Checklist) */}
                    {isSelected && (
                      <div className="mt-4 pt-3.5 border-t border-[#333330] space-y-2.5 animate-fadeIn">
                        <p className="text-[12.5px] font-semibold text-white/70">
                          {lang === 'ru' ? 'Все возможности тарифа:' : "Tarifdagi barcha imkoniyatlar:"}
                        </p>
                        {features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            {/* Claude uslubidagi oddiy, dumaloqsiz pitechka */}
                            <Check size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-white/75" />
                            <span className="text-[13px] text-white/85 font-normal leading-relaxed">
                              {feat}
                            </span>
                          </div>
                        ))}

                        {plan.key === 'lifetime' && (
                          <div className="pt-1 flex items-center gap-1 text-[11.5px] font-semibold text-white/90">
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

            {/* Pastki Harakat Tugmasi: Davom etish (Oq Claude CTA) */}
            <div className="p-4 sm:p-5 border-t border-[#262624] bg-[#131312] shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSound('toggle')
                  haptics.impact('medium')
                  setStep('payment_method')
                }}
                className="w-full py-4 px-6 rounded-2xl bg-white text-black hover:bg-slate-100 active:scale-[0.98] font-bold text-[15.5px] tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
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
            <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-[#262624] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('choose_plan')}
                  className="size-8 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
                  aria-label="Orqaga"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-[17px] font-bold tracking-tight text-white">
                  {tt('selectPaymentTitle')}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleGetHelp}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1E1E1D] hover:bg-[#2A2A28] border border-[#333330] px-3 py-1 text-[11px] font-semibold text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <Headphones size={12} />
                  <span>{tt('getHelp')}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Yopish"
                  className="size-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
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
                  <div className="size-16 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center animate-bounce shadow-md">
                    <CheckCircle2 size={34} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {lang === 'ru' ? 'Оплата прошла успешно!' : "To'lov muvaffaqiyatli amalga oshirildi!"}
                    </h3>
                    <p className="text-[13px] text-white/60 mt-1">
                      {lang === 'ru'
                        ? 'Премиум подписка активирована. Приятного обучения!'
                        : "Premium obuna faollashdi. Unumli bilim olishingizni tilaymiz!"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-slate-100 active:scale-98 transition-all cursor-pointer shadow-md"
                  >
                    {lang === 'ru' ? 'Отлично' : 'Ajoyib'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Tanlangan Tarif Kartasi */}
                  <div className="rounded-2xl border border-[#2B2B28] bg-[#1E1E1D] p-4 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <ClaudeTreeIcon className="size-8 text-white/90 shrink-0" />
                      <div>
                        <p className="text-[16px] font-bold text-white">
                          {lang === 'ru' ? selectedPlan.tierNameRu : selectedPlan.tierNameUz}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-white/55">
                            {lang === 'ru' ? selectedPlan.periodRu : selectedPlan.periodUz} · {lang === 'ru' ? selectedPlan.badgeRu : selectedPlan.badgeUz}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[17px] font-bold text-white tabular-nums">
                        {formatUzs(selectedPlan.priceUzs, lang)}
                      </span>
                    </div>
                  </div>

                  {/* Tasdiqlangan Raqam */}
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-semibold text-white/60">
                      {tt('verifiedPhone')}
                    </p>
                    <div className="rounded-2xl border border-[#2B2B28] bg-[#1E1E1D] p-3.5 flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck size={19} className="text-white/80" />
                        <span className="text-[14px] font-semibold text-white tabular-nums tracking-wide">
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
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>

                  {/* To'lov Tizimlari Tanlovi */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[12px] font-semibold text-white/60">
                      {tt('paymentMethodLabel')}: <span className="text-white capitalize font-bold">{selectedProvider}</span>
                    </p>
                    <div className="grid grid-cols-4 gap-2.5">
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
                            ? 'border-white bg-white/15 text-white font-bold shadow-sm'
                            : 'border-[#2B2B28] bg-[#1E1E1D] text-white/60 hover:border-white/30 hover:text-white'
                        )}
                      >
                        <span className="text-[13.5px] font-bold tracking-tight">click</span>
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
                            ? 'border-white bg-white/15 text-white font-bold shadow-sm'
                            : 'border-[#2B2B28] bg-[#1E1E1D] text-white/60 hover:border-white/30 hover:text-white'
                        )}
                      >
                        <span className="text-[13.5px] font-bold tracking-tight">payme</span>
                      </button>

                      {/* 3. Karta (Uzcard / Humo) */}
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          setSelectedProvider('card')
                        }}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer',
                          selectedProvider === 'card'
                            ? 'border-white bg-white/15 text-white font-bold shadow-sm'
                            : 'border-[#2B2B28] bg-[#1E1E1D] text-white/60 hover:border-white/30 hover:text-white'
                        )}
                      >
                        <span className="text-[12px] font-bold">Karta</span>
                        <span className="text-[9px] font-semibold text-white/40">Uzcard/Humo</span>
                      </button>

                      {/* 4. Telegram Stars */}
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          setSelectedProvider('stars')
                        }}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer',
                          selectedProvider === 'stars'
                            ? 'border-white bg-white/15 text-white font-bold shadow-sm'
                            : 'border-[#2B2B28] bg-[#1E1E1D] text-white/60 hover:border-white/30 hover:text-white'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <Star size={11} className="fill-white text-white" />
                          <span className="text-[12px] font-bold">Stars</span>
                        </div>
                        <span className="text-[9px] font-semibold text-white/40">{selectedPlan.stars} ⭐</span>
                      </button>
                    </div>
                  </div>

                  {/* Secondary Actions: Promokod & Do'stim to'laydi */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPromoModal(true)}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-[#2B2B28] bg-[#1E1E1D] text-xs font-bold text-white hover:bg-white/10 active:scale-98 transition-all cursor-pointer shadow-sm"
                    >
                      <Ticket size={14} className="text-white/70" />
                      <span>Promokod</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareWithFriend}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-[#2B2B28] bg-[#1E1E1D] text-xs font-bold text-white hover:bg-white/10 active:scale-98 transition-all cursor-pointer shadow-md"
                    >
                      <Gift size={14} className="text-white/70" />
                      <span>{tt('payFriend')}</span>
                    </button>
                  </div>

                  {/* Polling / Waiting Indicator */}
                  {isWaitingPayment && (
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 flex items-center gap-3">
                      <Loader2 size={19} className="text-white animate-spin shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-white">
                          {lang === 'ru' ? 'Ожидание подтверждения оплаты...' : "To'lov tasdiqlanishi kutilmoqda..."}
                        </p>
                        <p className="text-[11.5px] text-white/60 mt-0.5">
                          {lang === 'ru'
                            ? 'Оплатите через приложение, Premium включится автоматически'
                            : "Ilova orqali to'lang, Premium avtomatik yoqiladi"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {errorMsg && (
                    <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pastki Harakat Tugmasi: To'lash (Oq CTA) */}
            {!isSuccess && (
              <div className="p-4 sm:p-5 border-t border-[#262624] bg-[#131312] shrink-0">
                <button
                  type="button"
                  disabled={loadingProvider !== null || isWaitingPayment}
                  onClick={handleProceedToPayment}
                  className="w-full py-4 px-6 rounded-2xl bg-white text-black hover:bg-slate-100 disabled:opacity-50 active:scale-[0.98] font-bold text-[15.5px] tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loadingProvider !== null ? (
                    <Loader2 size={19} className="animate-spin text-black" />
                  ) : (
                    <>
                      <span>
                        {selectedProvider === 'stars'
                          ? `${tt('payWithStarsAction')} (${selectedPlan.stars} Stars)`
                          : `${tt('payAmount')} ${formatUzs(selectedPlan.priceUzs, lang)}`}
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

      {/* Promokod kiritish modali */}
      {showPromoModal && (
        <PromoCodeModal
          language={lang}
          onClose={() => setShowPromoModal(false)}
        />
      )}
    </DialogOverlay>
  )
}
