import { useState, useEffect, useRef, memo } from 'react'
import { X, Sparkles, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { type PremiumPlan, formatUzs } from '../../../../shared/premium-plans'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { openTelegramLink } from '../../../platform/telegram'
import { playSound } from '../../../shared/lib/sounds'
import { track } from '../../../shared/lib/analytics'
import Confetti from '../../../shared/components/Confetti'
import DialogOverlay from '../../../shared/components/DialogOverlay'

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
            <div className="w-8 h-8 rounded-control bg-psurface flex items-center justify-center text-pgold">
              <Sparkles size={16} strokeWidth={1.75} />
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
            <div className="w-16 h-16 rounded-full bg-psuccess/15 text-psuccess mx-auto flex items-center justify-center animate-bounce">
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
              className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 flex items-center justify-center gap-2 w-full py-3 rounded-container text-sm"
            >
              {lang === 'ru' ? 'Отлично' : 'Ajoyib'}
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Price Badge */}
            <div className="p-4 rounded-container bg-psurface border border-pline flex items-center justify-between">
              <span className="text-xs font-semibold text-pmuted">
                {lang === 'ru' ? 'К оплате:' : "To'lov summasi:"}
              </span>
              <div className="text-right">
                <span className="text-lg font-semibold text-pfg block tabular-nums">
                  {formatUzs(plan.priceUzs, lang)}
                </span>
                <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-semibold text-pgold tabular-nums">
                  {lang === 'ru' ? 'или' : 'yoki'}
                  <img src="/stars.svg" alt="" className="size-3" />
                  {plan.stars} Stars
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
              className="w-full p-4 rounded-2xl bg-psurface border border-pline hover:border-plineStrong active:scale-[0.98] transition-all flex items-center justify-between group disabled:opacity-60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-xl bg-pcard shadow-xs flex items-center justify-center flex-shrink-0 px-1.5">
                  <ClickLogo className="w-full h-auto" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-pfg">Click</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-psuccess/15 text-psuccess">
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
              className="w-full p-4 rounded-2xl bg-psurface border border-pline hover:border-plineStrong active:scale-[0.98] transition-all flex items-center justify-between group disabled:opacity-60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-xl bg-pcard shadow-xs flex items-center justify-center flex-shrink-0 p-2.5">
                  <img src="/stars.svg" alt="" className="w-full h-full" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-pfg">Telegram Stars</span>
                  <p className="text-xs text-pmuted mt-0.5 tabular-nums">
                    {plan.stars} Stars · {lang === 'ru' ? 'со счёта Telegram' : "Telegram hisobidan"}
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
