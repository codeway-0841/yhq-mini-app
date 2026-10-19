import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useT } from '../i18n'
import type { Lang } from '../i18n'
import { api, ApiError } from '../api'
import { useAppStore } from '../store/useAppStore'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import Confetti from './Confetti'
import ModalShell from './ModalShell'
import { Button } from './ui/button'

interface PromoCodeModalProps {
  language: Lang
  onClose: () => void
}

export default function PromoCodeModal({ language, onClose }: PromoCodeModalProps) {
  const tt = useT(language)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ value: number; premiumUntil: string | null } | null>(null)

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed || trimmed.length < 3) return

    setLoading(true)
    setError(null)

    try {
      const res = await api.redeemPromo(trimmed)
      playSound('win')
      haptics.notify('success')

      // Store'da darhol premium qilish
      useAppStore.setState((s) => ({
        tariff: 'premium',
        user: s.user ? { ...s.user, tariff: 'premium', premiumUntil: res.premiumUntil ?? undefined } : s.user,
      }))

      setSuccessData({ value: res.value, premiumUntil: res.premiumUntil })
    } catch (err: unknown) {
      playSound('error')
      haptics.notify('error')

      if (err instanceof ApiError) {
        if (err.code === 'PROMO_NOT_FOUND') {
          setError(tt('promoCodeInvalid'))
        } else if (err.code === 'PROMO_ALREADY_USED') {
          setError(tt('promoCodeAlreadyUsed'))
        } else if (err.code === 'PROMO_EXPIRED') {
          setError(tt('promoCodeExpired'))
        } else if (err.code === 'PROMO_LIMIT_REACHED') {
          setError(tt('promoCodeLimitReached'))
        } else {
          setError(err.message || tt('promoCodeInvalid'))
        }
      } else {
        setError(tt('promoCodeInvalid'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {successData && <Confetti />}
      <ModalShell
        title={successData ? tt('promoCodeSuccessTitle') : tt('promoCodeTitle')}
        subtitle={successData ? undefined : tt('promoCodeDesc')}
        onClose={onClose}
        labelId="promo-code-title"
        closeLabel={tt('cancelExit')}
        backdropClassName="bg-black/60"
      >
        {successData ? (
          <div className="relative z-10 px-2 py-2 text-center">
            <p className="mb-6 text-[13.5px] leading-relaxed text-pmuted">
              {language === 'ru'
                ? `Вам успешно предоставлен Premium доступ на ${successData.value} дней!`
                : `Sizga ${successData.value} kunlik bepul Premium obuna faollashtirildi!`}
            </p>

            <Button block onClick={onClose}>
              {tt('close')}
            </Button>
          </div>
        ) : (
          <div className="relative z-10">
            <form onSubmit={handleRedeem} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    if (error) setError(null)
                  }}
                  placeholder={tt('promoCodePlaceholder')}
                  autoFocus
                  maxLength={30}
                  className="w-full rounded-2xl bg-pcard px-4 py-3.5 text-center text-base font-semibold tracking-widest text-pfg shadow-2xs transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-psubtle focus:outline-none focus:ring-2 focus:ring-pprimary"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-[rgb(var(--p-danger-rgb)/0.10)] p-3 text-xs font-semibold text-pdanger shadow-xs">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                block
                loading={loading}
                disabled={code.trim().length < 3}
              >
                {tt('promoCodeActivateBtn')}
              </Button>
            </form>
          </div>
        )}
      </ModalShell>
    </>
  )
}
