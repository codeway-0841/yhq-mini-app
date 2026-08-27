import { useState, useEffect, useRef } from 'react'
import { X, CreditCard, Sparkles, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { type PremiumPlan, formatUzs } from '../../../../shared/premium-plans'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { openTelegramLink } from '../../../platform/telegram'
import { playSound } from '../../../shared/lib/sounds'
import { track } from '../../../shared/lib/analytics'
import Confetti from '../../../shared/components/Confetti'
import DialogOverlay from '../../../shared/components/DialogOverlay'

interface PaymentMethodModalProps {
  plan: PremiumPlan
  language: 'uz' | 'ru'
  onClose: () => void
  onSuccess?: () => void
}

export default function PaymentMethodModal({
  plan,
  language: lang,
  onClose,
  onSuccess,
}: PaymentMethodModalProps) {
  const [loadingProvider, setLoadingProvider] = useState<'click' | 'stars' | null>(null)
  const [isWaitingPayment, setIsWaitingPayment] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const userId = useAppStore((s) => s.user?.id)
  const syncFromServer = useAppStore((s) => s.syncFromServer)
  const pollTimerRef = useRef<any>(null)

  // Clean up poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // Poll for payment completion
  const startPolling = (orderId: string) => {
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
          track('premium_payment_success', { plan: plan.key, provider: 'click' })
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
        // Ignore transient poll errors
      }

      // Stop after 60 attempts (3 minutes)
      if (attempts >= 60) {
        clearInterval(pollTimerRef.current)
        setIsWaitingPayment(false)
      }
    }, 3000)
  }

  const handlePayWithClick = async () => {
    setErrorMsg(null)
    setLoadingProvider('click')
    track('premium_click_checkout', { plan: plan.key })

    try {
      const res = await api.createPaymentOrder({
        plan: plan.key,
        provider: 'click',
      })

      if (res.paymentUrl) {
        openTelegramLink(res.paymentUrl)
        startPolling(res.orderId)
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

  const handlePayWithStars = () => {
    track('premium_stars_click', { plan: plan.key })
    openTelegramLink(`https://t.me/kiwi_uz_bot?start=premium_${plan.key}`)
    onClose()
  }

  return (
    <DialogOverlay
      onClose={onClose}
      position="center"
      labelId="payment-method-title"
      className="animate-fadeIn"
      backdropClassName="bg-black/80 backdrop-blur-sm"
    >
      {isSuccess && <Confetti count={40} />}

      <div
        className="w-full sm:max-w-md bg-pcard border border-pline rounded-t-sheet sm:rounded-container p-6 shadow-2xl relative animate-slideUp text-pfg select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pline">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-control bg-pgold/15 border border-pgold/30 flex items-center justify-center text-pgold">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 id="payment-method-title" className="text-base font-semibold">
                {lang === 'ru' ? 'Оплата подписки' : "To'lov usulini tanlang"}
              </h2>
              <p className="text-xs text-pmuted">
                {lang === 'ru' ? plan.titleRu : plan.titleUz} ({lang === 'ru' ? plan.periodRu : plan.periodUz})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'ru' ? 'Закрыть' : 'Yopish'}
            className="p-2 rounded-full hover:bg-psurface text-psubtle hover:text-pfg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-psuccess/20 border border-psuccess text-psuccess mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-psuccess">
                {lang === 'ru' ? 'Оплата прошла успешно!' : "To'lov muvaffaqiyatli amalga oshirildi!"}
              </h3>
              <p className="text-xs text-pmuted mt-1">
                {lang === 'ru'
                  ? 'Премиум подписка активирована. Приятного обучения!'
                  : "Premium obuna faollashdi. Unumli bilim olishingizni tilaymiz!"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 flex items-center justify-center gap-2 w-full py-3 rounded-container font-semibold text-sm"
            >
              {lang === 'ru' ? 'Отлично' : 'Ajoyib'}
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Price Badge */}
            <div className="p-4 rounded-container bg-psurface/60 border border-pline flex items-center justify-between">
              <span className="text-xs font-semibold text-pmuted">
                {lang === 'ru' ? 'К оплате:' : "To'lov summasi:"}
              </span>
              <div className="text-right">
                <span className="text-lg font-semibold text-pfg block">
                  {formatUzs(plan.priceUzs, lang)}
                </span>
                <span className="text-[11px] text-pgold font-semibold block">
                  yoki ⭐ {plan.stars} Stars
                </span>
              </div>
            </div>

            {/* Waiting for payment indicator */}
            {isWaitingPayment && (
              <div className="p-3.5 rounded-container bg-pblue/10 border border-pblue/30 flex items-center gap-3">
                <Loader2 size={20} className="text-pblue animate-spin flex-shrink-0" />
                <div className="text-xs leading-tight">
                  <p className="font-semibold text-pblue">
                    {lang === 'ru' ? 'Ожидание подтверждения оплаты...' : "To'lov tasdiqlanishi kutilmoqda..."}
                  </p>
                  <p className="text-[11px] text-pmuted mt-0.5">
                    {lang === 'ru'
                      ? 'Оплатите в Click, Premium включится автоматически'
                      : "Click orqali to'lang, Premium avtomatik yoqiladi"}
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-control bg-pdanger/10 border border-pdanger/30 text-pdanger text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Provider 1: Click.uz */}
            <button
              onClick={handlePayWithClick}
              disabled={loadingProvider === 'click' || isWaitingPayment}
              className="w-full p-4 rounded-container bg-psurface border border-pline hover:border-pblue/50 active:scale-[0.98] transition-all flex items-center justify-between group disabled:opacity-60 text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-control bg-[#0073ff]/15 border border-[#0073ff]/30 flex items-center justify-center font-semibold text-[#0073ff] text-base flex-shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-pfg">Click.uz</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-psuccess/15 text-psuccess border border-psuccess/30">
                      Humo / Uzcard
                    </span>
                  </div>
                  <p className="text-xs text-pmuted mt-0.5">
                    {formatUzs(plan.priceUzs, lang)} (Click ilovasi yoki sayti)
                  </p>
                </div>
              </div>
              <div className="text-psubtle group-hover:text-pfg transition-colors">
                {loadingProvider === 'click' ? (
                  <Loader2 size={18} className="animate-spin text-pblue" />
                ) : (
                  <ExternalLink size={18} />
                )}
              </div>
            </button>

            {/* Provider 2: Telegram Stars */}
            <button
              onClick={handlePayWithStars}
              disabled={loadingProvider !== null || isWaitingPayment}
              className="w-full p-4 rounded-container bg-psurface border border-pline hover:border-pgold/50 active:scale-[0.98] transition-all flex items-center justify-between group disabled:opacity-60 text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-control bg-pgold/15 border border-pgold/30 flex items-center justify-center font-semibold text-pgold text-base flex-shrink-0">
                  ⭐
                </div>
                <div>
                  <span className="text-sm font-semibold text-pfg">Telegram Stars</span>
                  <p className="text-xs text-pmuted mt-0.5">
                    ⭐ {plan.stars} Stars (Telegram hisobidan)
                  </p>
                </div>
              </div>
              <div className="text-psubtle group-hover:text-pfg transition-colors">
                <ExternalLink size={18} />
              </div>
            </button>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
