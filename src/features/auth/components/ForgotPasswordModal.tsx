import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../../../shared/api'
import { usePhoneInput } from '../hooks/usePhoneInput'
import OTPInput from './OTPInput'
import PasswordInput from './PasswordInput'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type Step = 'phone' | 'otp' | 'new-password'

/**
 * INCOMPLETE: Backend needs these endpoints for secure password reset:
 * 1. POST /auth/password/request-reset {phone} → sends OTP, returns resetToken
 * 2. POST /auth/password/verify-reset {resetToken, code} → verifies OTP, returns verifiedToken
 * 3. POST /auth/password/reset {verifiedToken, newPassword} → updates password
 *
 * Current issue: using verifyOTPLogin creates session (security risk - OTP reuse).
 * Proper flow needs separate OTP verification that doesn't grant login session.
 */
export default function ForgotPasswordModal({ isOpen, onClose, onSuccess }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('phone')
  const [otpCode, setOtpCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phone = usePhoneInput()

  if (!isOpen) return null

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.isValid || busy) return

    setBusy(true)
    setError(null)
    try {
      await api.requestOTP({ phone: phone.value })
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP yuborishda xatolik")
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpCode.length !== 6 || busy) return

    setBusy(true)
    setError(null)
    try {
      // Verify OTP is valid for this phone
      await api.verifyOTPLogin({ phone: phone.value, code: otpCode })
      setStep('new-password')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod noto'g'ri")
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || password !== confirmPassword || busy) return

    setBusy(true)
    setError(null)
    try {
      // TODO: Backend needs /auth/password/reset endpoint
      // For now, show error that feature is incomplete
      throw new Error("Parol tiklash funksiyasi hali tayyor emas. Backend'da /auth/password/reset endpoint kerak.")

      // When backend ready, should be:
      // await api.resetPassword({ phone: phone.value, code: otpCode, newPassword: password })
      // onSuccess?.()
      // handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parol o'zgartirishda xatolik")
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    setStep('phone')
    setOtpCode('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    phone.reset()
    onClose()
  }

  const inputCls =
    'w-full bg-elevated border border-line rounded-xl px-3.5 py-3 text-[15px] text-fg ' +
    'placeholder:text-muted outline-none focus:border-duo-green transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-canvas border border-line rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-lg font-bold text-fg">Parolni tiklash</h2>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-line/50 rounded-lg transition-colors"
            aria-label="Yopish"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Enter Phone */}
          {step === 'phone' && (
            <form onSubmit={handleRequestOTP} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <div className="text-4xl mb-3">🔑</div>
                <p className="text-[13px] text-muted">
                  Telefon raqamingizni kiriting. Sizga tasdiqlash kodi yuboramiz.
                </p>
              </div>

              <label htmlFor="reset-phone" className="text-[11px] font-bold text-muted uppercase tracking-wide">
                Telefon raqam
              </label>
              <div className={`${inputCls} flex items-center gap-2 px-3.5`}>
                <span className="text-muted font-bold select-none">+998</span>
                <input
                  id="reset-phone"
                  value={phone.digits}
                  onChange={(e) => phone.setDigits(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="90 123 45 67"
                  maxLength={11}
                  disabled={busy}
                  className="flex-1 min-w-0 bg-transparent outline-none py-3 text-[15px] text-fg placeholder:text-muted tracking-widest"
                />
              </div>

              {error && <p className="text-[12px] font-semibold text-duo-red text-center">{error}</p>}

              <button
                type="submit"
                disabled={!phone.isValid || busy}
                className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                Kod yuborish
              </button>
            </form>
          )}

          {/* Step 2: Verify OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <p className="text-[13px] text-muted mb-1">SMS kod yuborildi</p>
                <p className="text-[15px] font-bold text-fg">{phone.value}</p>
              </div>

              <OTPInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={busy}
                error={!!error}
              />

              {error && <p className="text-[12px] font-semibold text-duo-red text-center">{error}</p>}

              <button
                type="submit"
                disabled={otpCode.length !== 6 || busy}
                className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                Tasdiqlash
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setOtpCode(''); setError(null) }}
                className="text-[13px] text-muted hover:text-fg transition-colors text-center"
              >
                ← Orqaga
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'new-password' && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-[13px] text-muted">Yangi parol yarating</p>
              </div>

              <PasswordInput
                id="new-password"
                value={password}
                onChange={setPassword}
                label="Yangi parol"
                autoComplete="new-password"
                disabled={busy}
                showStrengthMeter
              />

              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                label="Parolni tasdiqlang"
                autoComplete="new-password"
                disabled={busy}
              />

              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-duo-red -mt-2">Parollar mos kelmayapti</p>
              )}

              {error && <p className="text-[12px] font-semibold text-duo-red text-center">{error}</p>}

              <button
                type="submit"
                disabled={password.length < 8 || password !== confirmPassword || busy}
                className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                Parolni saqlash
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
