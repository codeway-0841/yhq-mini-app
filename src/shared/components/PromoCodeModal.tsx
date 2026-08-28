import { useState } from 'react'
import { X, Ticket, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import { useT } from '../i18n'
import type { Lang } from '../i18n'
import { api, ApiError } from '../api'
import { useAppStore } from '../store/useAppStore'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import Confetti from './Confetti'
import DialogOverlay from './DialogOverlay'
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
    <DialogOverlay onClose={onClose} position="center" labelId="promo-code-title" className="animate-premiumIn" backdropClassName="bg-black/80 backdrop-blur-md">
      {successData && <Confetti />}
      <div className="relative w-full max-w-sm rounded-container bg-pcard border border-plineStrong p-6 shadow-2xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-[rgb(var(--p-purple-rgb)/0.20)] rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          aria-label={tt('cancelExit')}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        {successData ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-container bg-[rgb(var(--p-primary-rgb)/0.15)] border border-[rgb(var(--p-primary-rgb)/0.40)] flex items-center justify-center mx-auto mb-4 text-pprimary animate-bounce">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-lg font-semibold text-pfg mb-2">
              {tt('promoCodeSuccessTitle')}
            </h3>

            <p className="text-xs text-pmuted leading-relaxed mb-6">
              {language === 'ru'
                ? `Вам успешно предоставлен Premium доступ на ${successData.value} дней!`
                : `Sizga ${successData.value} kunlik bepul Premium obuna faollashtirildi!`}
            </p>

            <Button block onClick={onClose}>
              {tt('close')}
            </Button>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 rounded-container bg-[rgb(var(--p-purple-rgb)/0.15)] border border-[rgb(var(--p-purple-rgb)/0.40)] flex items-center justify-center mx-auto mb-3 text-ppurple">
              <Ticket size={24} />
            </div>

            <h3 id="promo-code-title" className="text-base font-semibold text-pfg text-center mb-1">
              {tt('promoCodeTitle')}
            </h3>

            <p className="text-xs text-pmuted text-center mb-5 leading-relaxed">
              {tt('promoCodeDesc')}
            </p>

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
                  className="w-full bg-pcanvas border border-pline rounded-control px-4 py-3.5 text-center text-base font-semibold tracking-widest text-pfg placeholder:text-psubtle placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-ppurple transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-control bg-[rgb(var(--p-danger-rgb)/0.10)] border border-[rgb(var(--p-danger-rgb)/0.30)] text-pdanger text-xs font-semibold">
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
                <Sparkles size={16} />
                {tt('promoCodeActivateBtn')}
              </Button>
            </form>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
