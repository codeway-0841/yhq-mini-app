import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, CheckCircle2, CreditCard, Star, ChevronRight } from 'lucide-react'
import { type PremiumPlan, formatUzs } from '../../../../shared/premium-plans'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import { openTelegramLink } from '../../../platform/telegram'
import { config } from '../../../shared/config'
import { playSound } from '../../../shared/lib/sounds'
import { track } from '../../../shared/lib/analytics'
import Confetti from '../../../shared/components/Confetti'
import ModalShell from '../../../shared/components/ModalShell'
import { SpecCard, SpecRow, SpecList, SpecHero, SpecAmount } from '../../../shared/components/ui/spec'

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
    openTelegramLink(`https://t.me/${config.botUsername}?start=premium_${plan.key}`)
    onClose()
  }

  return (
    <>
      {isSuccess && <Confetti count={40} />}
      <ModalShell
        title={lang === 'ru' ? 'Оплата' : "To'lov"}
        onClose={onClose}
        labelId="payment-method-title"
        closeLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
        backdropClassName="bg-black/70"
      >
        {isSuccess ? (
          <div className="relative z-10 px-5 pb-2">
            <SpecHero
              icon={<CheckCircle2 className="size-10 text-white" />}
              iconClassName="bg-[linear-gradient(160deg,#35c47f,#15803d)]"
              title={lang === 'ru' ? 'Оплата прошла успешно!' : "To'lov muvaffaqiyatli o'tdi!"}
              subtitle={lang === 'ru'
                ? 'Премиум подписка активирована. Приятного обучения!'
                : "Premium obuna faollashdi. Unumli bilim olishingizni tilaymiz!"}
            />

            <SpecCard className="mt-6">
              <SpecList>
                <SpecRow
                  tone="gold"
                  icon={<Star strokeWidth={2} />}
                  label={lang === 'ru' ? plan.titleRu : plan.titleUz}
                  value={formatUzs(plan.priceUzs, lang)}
                />
              </SpecList>
            </SpecCard>

            <button
              onClick={onClose}
              className="mt-4 w-full rounded-2xl bg-pprimary py-3 text-sm font-bold text-ponprimary shadow-xs transition-[transform,filter] duration-150 hover:brightness-[1.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-psurface cursor-pointer"
            >
              {lang === 'ru' ? 'Отлично' : 'Ajoyib'}
            </button>
          </div>
        ) : (
          <div className="relative z-10 pb-2">
            {/* Hero — tarif ikonkasi (App Store "Pro Upgrade" uslubi) */}
            <SpecHero
              icon={<Sparkles className="size-9 text-white" strokeWidth={1.9} />}
              iconClassName="bg-[linear-gradient(160deg,#e0a53f,#b8862c)]"
              badge={<img src="/stars.svg" alt="" className="size-4" />}
              title={lang === 'ru' ? plan.titleRu : plan.titleUz}
              subtitle={lang === 'ru' ? plan.periodRu : plan.periodUz}
            />

            {/* Katta raqam — to'lov summasi */}
            <SpecAmount
              className="pt-5"
              value={formatUzs(plan.priceUzs, lang)}
              caption={`${lang === 'ru' ? 'или' : 'yoki'} ${plan.stars} Stars`}
              captionIcon={<img src="/stars.svg" alt="" className="size-4" />}
            />

            <div className="px-5 pt-6">
              <SpecCard>
                {isWaitingPayment ? (
                  <SpecRow
                    tone="blue"
                    icon={<Loader2 className="animate-spin" />}
                    label={lang === 'ru' ? 'Ожидание оплаты…' : "To'lov kutilmoqda…"}
                    hint={lang === 'ru'
                      ? 'Оплатите в Click — Premium включится автоматически'
                      : "Click orqali to'lang — Premium avtomatik yoqiladi"}
                  />
                ) : (
                  <SpecList>
                    <SpecRow
                      tone="blue"
                      icon={<CreditCard />}
                      label="Click"
                      hint={`Humo / Uzcard · ${formatUzs(plan.priceUzs, lang)}`}
                      value={loadingProvider === 'click'
                        ? <Loader2 className="animate-spin text-pblue" />
                        : <ChevronRight />}
                      valueClassName="text-psubtle"
                      onClick={loadingProvider ? undefined : handlePayWithClick}
                    />
                    <SpecRow
                      tone="gold"
                      icon={<Star strokeWidth={2} />}
                      label="Telegram Stars"
                      hint={lang === 'ru'
                        ? `${plan.stars} Stars · со счёта Telegram`
                        : `${plan.stars} Stars · Telegram hisobidan`}
                      value={loadingProvider ? <Loader2 className="animate-spin text-psubtle" /> : <ChevronRight />}
                      valueClassName="text-psubtle"
                      onClick={loadingProvider ? undefined : handlePayWithStars}
                    />
                  </SpecList>
                )}
              </SpecCard>

              {errorMsg && (
                <p
                  role="alert"
                  className="mt-3 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.1)] px-4 py-3 text-[12.5px] font-semibold text-pdanger"
                >
                  {errorMsg}
                </p>
              )}

              <p className="mt-3 px-1 text-center text-[11px] leading-snug text-psubtle">
                {lang === 'ru'
                  ? 'Оплата защищена. Подписка активируется автоматически после подтверждения.'
                  : "To'lov himoyalangan. Obuna tasdiqlangach avtomatik faollashadi."}
              </p>
            </div>
          </div>
        )}
      </ModalShell>
    </>
  )
}
