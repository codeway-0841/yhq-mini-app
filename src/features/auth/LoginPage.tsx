import { useEffect, useRef, useState } from 'react'
import { api, type AuthResponse, type TelegramWidgetFields } from '../../shared/api'
import { config } from '../../shared/config'
import { setSessionToken } from '../../shared/lib/session'
import { track } from '../../shared/lib/analytics'
import { ensureAccountOwner } from '../../shared/store/account'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { getTelegramUser } from '../../platform/telegram'
import { flushOutbox } from '../../shared/lib/outbox'
import { useT } from '../../shared/i18n'
import { authErrorKey } from './validation'
import { usePhoneInput } from './hooks/usePhoneInput'

/**
 * LoginPage — mehmon rejim YO'Q: initData'siz (APK/brauzer) foydalanuvchi
 * shu sahifada telefon+parol yoki Telegram Login Widget orqali kiradi.
 * Muvaffaqiyat: sessionToken saqlanadi → profile store'ga hydrate → initialized.
 */
export default function LoginPage() {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phone = usePhoneInput()

  const showWidget = !getTelegramUser() && Boolean(config.botUsername)
  const widgetRef = useRef<HTMLDivElement>(null)

  /** Login/register/link muvaffaqiyatining YAGONA hydrate yo'li (App boot bilan bir xil). */
  const applyAuth = (data: AuthResponse) => {
    setSessionToken(data.sessionToken)
    // Adopt-merge yoki boshqa akkaunt cache'i bo'lsa — atomik reset
    ensureAccountOwner(data.user.id)
    useAppStore.getState().hydrateFromProfile(data)
    void useQuestionsStore.getState().load(data.settings.language).catch(() => {})
    void flushOutbox(data.user.id)
    useAppStore.setState({ initialized: true })
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.isValid || busy) return
    if (mode === 'register') {
      if (!firstName.trim() || password.length < 8) return
    }

    setBusy(true)
    setError(null)
    try {
      await api.requestOTP({ phone: phone.value })
      setStep('otp')
      track('otp_requested', { provider: mode })
    } catch (err) {
      setError(tt(authErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpCode.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'register') {
        const data = await api.verifyOTPRegister({
          phone: phone.value,
          code: otpCode,
          password,
          firstName: firstName.trim(),
        })
        track('register', { provider: 'phone_otp' })
        applyAuth(data)
      } else {
        const data = await api.verifyOTPLogin({ phone: phone.value, code: otpCode })
        track('login', { provider: 'phone_otp' })
        applyAuth(data)
      }
    } catch (err) {
      setError(tt(authErrorKey(err)))
      setBusy(false)
    }
  }


  // ── Telegram Login Widget (faqat TG WebApp tashqarisida + BOT_USERNAME sozlanganida)
  useEffect(() => {
    if (!showWidget || !widgetRef.current) return
    const w = window as unknown as { onTelegramAuth?: (user: unknown) => void }
    w.onTelegramAuth = (raw) => {
      void (async () => {
        setBusy(true)
        setError(null)
        try {
          const data = await api.loginTelegramWidget(raw as TelegramWidgetFields)
          track('login', { provider: 'telegram_widget' })
          applyAuth(data)
        } catch (err) {
          setError(tt(authErrorKey(err)))
          setBusy(false)
        }
      })()
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', config.botUsername!)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    const container = widgetRef.current
    container.appendChild(script)
    return () => {
      delete w.onTelegramAuth
      container.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWidget])

  const inputCls =
    'w-full bg-elevated border border-line rounded-xl px-3.5 py-3 text-[15px] text-fg ' +
    'placeholder:text-muted outline-none focus:border-duo-green transition-colors'

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[380px] animate-premiumIn">
        <img src="/images/splash-brand.png" alt="KIWI" className="w-36 rounded-[1.75rem] mx-auto" />
        <h1 className="text-[22px] font-black text-fg text-center mt-5">{tt('authWelcome')}</h1>
        <p className="text-[13px] text-muted text-center mt-1 mb-6">{tt('authTagline')}</p>

        <div className="card-premium p-4">
          {/* Segment: Kirish | Ro'yxatdan o'tish */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-elevated border border-line mb-4">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setStep('form'); setError(null) }}
                className={`py-2 rounded-lg text-[13px] font-bold transition-colors ${
                  mode === m ? 'bg-duo-green text-ponprimary' : 'text-muted'
                }`}
              >
                {tt(m === 'login' ? 'authLogin' : 'authRegister')}
              </button>
            ))}
          </div>

          {/* Form: Telefon + Parol (+ Ism register'da) */}
          {step === 'form' && (
            <form onSubmit={submitForm} className="flex flex-col gap-3" noValidate>
              <label htmlFor="phone" className="text-[11px] font-bold text-muted uppercase tracking-wide -mb-1.5">
                {tt('authPhone')}
              </label>
              <div className={`${inputCls} flex items-center gap-2 px-3.5`}>
                <span className="text-muted font-bold select-none">+998</span>
                <input
                  id="phone"
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

              {mode === 'register' && (
                <>
                  <label htmlFor="firstName" className="text-[11px] font-bold text-muted uppercase tracking-wide -mb-1.5">
                    {tt('authFirstName')}
                  </label>
                  <input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    maxLength={64}
                    disabled={busy}
                    className={inputCls}
                  />

                  <label htmlFor="password" className="text-[11px] font-bold text-muted uppercase tracking-wide -mb-1.5">
                    {tt('authPassword')}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    maxLength={72}
                    disabled={busy}
                    className={inputCls}
                  />
                  <p className="text-[11px] text-muted -mt-1.5">{tt('authPasswordHint')}</p>
                </>
              )}

              {error && <p className="text-[12px] font-semibold text-duo-red">{error}</p>}

              <button
                type="submit"
                disabled={
                  !phone.isValid ||
                  (mode === 'register' && (!firstName.trim() || password.length < 8)) ||
                  busy
                }
                className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] mt-1 flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                {tt(mode === 'login' ? 'authLogin' : 'authRegister')}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOTP} className="flex flex-col gap-3" noValidate>
              <p className="text-[13px] text-muted">
                <strong className="text-fg">{phone.value}</strong> raqamiga SMS kod yuborildi
              </p>
              <label htmlFor="otp-code" className="text-[11px] font-bold text-muted uppercase tracking-wide -mb-1.5">
                6 raqamli kod
              </label>
              <input
                id="otp-code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                maxLength={6}
                disabled={busy}
                className={inputCls}
                placeholder="123456"
              />
              {error && <p className="text-[12px] font-semibold text-duo-red">{error}</p>}
              <button
                type="submit"
                disabled={otpCode.length !== 6 || busy}
                className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] mt-1 flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                {tt(mode === 'login' ? 'authLogin' : 'authRegister')}
              </button>
              <button
                type="button"
                onClick={() => { setStep('form'); setOtpCode(''); setError(null) }}
                className="text-[13px] text-muted hover:text-fg transition-colors"
              >
                ← Orqaga
              </button>
            </form>
          )}


          {/* Telegram Login Widget — faqat brauzer/APK'da (Mini App'da initData yo'li bor) */}
          {showWidget && (
            <>
              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-line" />
                <span className="text-[11px] font-bold text-muted uppercase">{tt('authOr')}</span>
                <span className="flex-1 h-px bg-line" />
              </div>
              <div ref={widgetRef} className="flex justify-center min-h-[40px]" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
