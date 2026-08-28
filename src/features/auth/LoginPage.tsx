import { useEffect, useRef, useState } from 'react'
import { api, type AuthResponse } from '../../shared/api'
import { config } from '../../shared/config'
import { setSessionToken } from '../../shared/lib/session'
import { track } from '../../shared/lib/analytics'
import { ensureAccountOwner } from '../../shared/store/account'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { getTelegramUser, getTelegramWebApp } from '../../platform/telegram'
import { isNativeApp } from '../../platform/native'
import { flushOutbox } from '../../shared/lib/outbox'
import { useT } from '../../shared/i18n'
import { authErrorKey } from './validation'
import { usePhoneInput } from './hooks/usePhoneInput'
import PasswordInput from './components/PasswordInput'
import OTPInput from './components/OTPInput'
import EmailAuthForm from './components/EmailAuthForm'
import ForgotPasswordForm from './components/ForgotPasswordForm'
import TelegramQrSheet from './components/TelegramQrSheet'

/** Mobil brauzer = Telegram app o'rnatilgan bo'lishi ehtimoli yuqori → to'g'ridan-to'g'ri ochamiz.
 *  Desktop = Telegram Desktop bo'lmasligi mumkin → QR kod variantini ko'rsatamiz. */
function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent)
}

/**
 * LoginPage — mehmon rejim YO'Q: initData'siz (APK/brauzer) foydalanuvchi
 * shu sahifada telefon+parol yoki Telegram Login Widget orqali kiradi.
 * Muvaffaqiyat: sessionToken saqlanadi → profile store'ga hydrate → initialized.
 */
export default function LoginPage() {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  const [method, setMethod] = useState<'phone' | 'email' | 'forgot'>('phone')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phone = usePhoneInput()

  const showTelegramLogin = !getTelegramUser() && Boolean(config.botUsername)
  const [telegramLoginUrl, setTelegramLoginUrl] = useState<string | null>(null)
  const [telegramLoginCode, setTelegramLoginCode] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** Login/register/link muvaffaqiyatining YAGONA hydrate yo'li (App boot bilan bir xil). */
  const applyAuth = (data: AuthResponse) => {
    // Adopt-merge yoki boshqa akkaunt cache'i bo'lsa — atomik reset.
    // TARTIB MUHIM (audit H-7): owner-check AVVAL — reset 'yhq-session' kalitini
    // ham o'chiradi; token avval yozilsa u darhol o'chirib yuborilardi
    // (tokensiz "login" holati: keyingi so'rovlar auth'siz 401 olardi).
    ensureAccountOwner(data.user.id)
    setSessionToken(data.sessionToken)
    useAppStore.getState().hydrateFromProfile(data)
    void useQuestionsStore.getState().load(data.settings.language).catch(() => {})
    void flushOutbox(data.user.id)
    if (typeof window !== 'undefined') {
      window.location.hash = '#/'
    }
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


  // Telegram Login polling — bot session yaratganda avtomatik kirish
  useEffect(() => {
    if (!telegramLoginCode) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.checkTelegramLogin(telegramLoginCode)
        if (res.status === 'completed' && res.sessionToken) {
          if (pollRef.current) clearInterval(pollRef.current)
          track('login', { provider: 'telegram_bot' })
          applyAuth(res)
        } else if (res.status === 'expired') {
          if (pollRef.current) clearInterval(pollRef.current)
          setTelegramLoginCode(null)
          setTelegramLoginUrl(null)
          setQrOpen(false)
          setError(tt('authCodeExpired'))
        }
      } catch { /* ignore polling errors */ }
    }, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramLoginCode])

  const startTelegramLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.createTelegramLogin()
      if (res.url) {
        setTelegramLoginUrl(res.url)
        setTelegramLoginCode(res.code)
        // Desktop'da Telegram app bo'lmasligi mumkin — QR kodli variant ochamiz;
        // mobilda Telegram app borligi deyarli kafolatlangan → to'g'ridan-to'g'ri ochamiz.
        if (isMobileBrowser()) {
          window.open(res.url, '_blank')
        } else {
          setQrOpen(true)
        }
      } else {
        setError(tt('authTelegramNotConfigured'))
      }
    } catch (err) {
      setError(tt(authErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full bg-psurface border border-pline rounded-control px-3.5 py-3 text-[15px] text-pfg ' +
    'placeholder:text-pmuted outline-none focus:border-pprimary transition-colors'

  const isWeb = !getTelegramWebApp() && !isNativeApp()

  return (
    <div className="min-h-screen bg-pcanvas flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[380px] animate-premiumIn">
        {isWeb ? (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src="/images/splash-brand.png" alt="KIWI" className="w-14 rounded-control" />
              <div>
                <h1 className="text-[18px] font-semibold text-pfg leading-tight">{tt('authWelcome')}</h1>
                <p className="text-[12px] text-pmuted">{tt('authTagline')}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <img src="/images/splash-brand.png" alt="KIWI" className="w-36 rounded-[1.75rem] mx-auto" />
            <h1 className="text-[22px] font-semibold text-pfg text-center mt-5">{tt('authWelcome')}</h1>
            <p className="text-[13px] text-pmuted text-center mt-1 mb-6">{tt('authTagline')}</p>
          </>
        )}

        <div className="rounded-container border border-pline bg-pcard p-4">
          {/* Segment: Kirish | Ro'yxatdan o'tish — faqat phone/email auth yoqilganda
              (Telegram login o'zi register/login'ni avtomatik hal qiladi) */}
          {config.phoneEmailAuthEnabled && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-control bg-psurface border border-pline mb-4">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setStep('form'); setMethod(method === 'forgot' ? 'phone' : method); setError(null) }}
                className={`py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                  mode === m ? 'bg-pprimary text-ponprimary' : 'text-pmuted'
                }`}
              >
                {tt(m === 'login' ? 'authLogin' : 'authRegister')}
              </button>
            ))}
          </div>
          )}

          {/* Method switcher: Phone | Email */}
          {config.phoneEmailAuthEnabled && method !== 'forgot' && step === 'form' && (
            <div className="flex gap-2 mb-4">
              {(['phone', 'email'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMethod(m); setError(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                    method === m ? 'bg-psurface border border-pprimary text-pprimary' : 'text-pmuted border border-pline'
                  }`}
                >
                  {m === 'phone' ? tt('authPhone') : 'Email'}
                </button>
              ))}
            </div>
          )}

          {/* Forgot Password Form */}
          {config.phoneEmailAuthEnabled && method === 'forgot' && (
            <ForgotPasswordForm
              language={language}
              onBack={() => setMethod('phone')}
            />
          )}

          {/* Email Auth Form */}
          {config.phoneEmailAuthEnabled && method === 'email' && step === 'form' && (
            <>
              <EmailAuthForm
                mode={mode}
                language={language}
                onSuccess={applyAuth}
              />
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMethod('forgot')}
                  className="text-[12px] text-pprimary hover:underline mt-2 w-full text-center"
                >
                  {language === 'ru' ? 'Забыли пароль?' : 'Parolingizni unutdingizmi?'}
                </button>
              )}
            </>
          )}

          {/* Phone Form */}
          {config.phoneEmailAuthEnabled && method === 'phone' && step === 'form' && (
            <form onSubmit={submitForm} className="flex flex-col gap-3" noValidate>
              <label htmlFor="phone" className="text-[11px] font-semibold text-pmuted uppercase tracking-wide -mb-1.5">
                {tt('authPhone')}
              </label>
              <div className={`${inputCls} flex items-center gap-2 px-3.5`}>
                <span className="text-pmuted font-semibold select-none">+998</span>
                <input
                  id="phone"
                  value={phone.digits}
                  onChange={(e) => phone.setDigits(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="90 123 45 67"
                  maxLength={11}
                  disabled={busy}
                  className="flex-1 min-w-0 bg-transparent outline-none py-3 text-[15px] text-pfg placeholder:text-pmuted tracking-widest"
                />
              </div>

              {mode === 'register' && (
                <>
                  <label htmlFor="firstName" className="text-[11px] font-semibold text-pmuted uppercase tracking-wide -mb-1.5">
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

                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={setPassword}
                    label={tt('authPassword')}
                    autoComplete="new-password"
                    disabled={busy}
                    showStrengthMeter
                  />
                </>
              )}

              {error && <p className="text-[12px] font-semibold text-pdanger">{error}</p>}

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMethod('forgot')}
                  className="text-[12px] text-pprimary hover:underline -mt-2"
                  disabled={busy}
                >
                  {language === 'ru' ? 'Забыли пароль?' : 'Parolingizni unutdingizmi?'}
                </button>
              )}

              <button
                type="submit"
                disabled={
                  !phone.isValid ||
                  (mode === 'register' && (!firstName.trim() || password.length < 8)) ||
                  busy
                }
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-container font-semibold text-[15px] mt-1 flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                {tt(mode === 'login' ? 'authLogin' : 'authRegister')}
              </button>
            </form>
          )}

          {/* OTP step (phone only) */}
          {config.phoneEmailAuthEnabled && method === 'phone' && step === 'otp' && (
            <form onSubmit={verifyOTP} className="flex flex-col gap-4" noValidate>
              <div className="text-center">
                <p className="text-[13px] text-pmuted mb-1">
                  {tt('authSmsCodeSent')}
                </p>
                <p className="text-[15px] font-semibold text-pfg">{phone.value}</p>
              </div>

              <OTPInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={busy}
                error={!!error}
              />

              {error && (
                <p className="text-[12px] font-semibold text-pdanger text-center animate-fadeIn">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={otpCode.length !== 6 || busy}
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-container font-semibold text-[15px] flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
                {tt(mode === 'login' ? 'authLogin' : 'authRegister')}
              </button>

              <button
                type="button"
                onClick={() => { setStep('form'); setOtpCode(''); setError(null) }}
                className="text-[13px] text-pmuted hover:text-pfg transition-colors text-center"
              >
                {tt('authBack')}
              </button>
            </form>
          )}

          {/* Telegram Login */}
          {method !== 'forgot' && step === 'form' && showTelegramLogin && (
            <>
              {/* "YOKI" ajratgichi — faqat yuqorida phone/email formalar ko'rinib turganda kerak */}
              {config.phoneEmailAuthEnabled && (
              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-plineStrong" />
                <span className="text-[11px] font-semibold text-pmuted uppercase">{tt('authOr')}</span>
                <span className="flex-1 h-px bg-plineStrong" />
              </div>
              )}
              {/* Xato xabari — phone/email o'chirilganda Telegram oqimi xatolari shu yerda ko'rinadi
                  (flag yoqilganda phone formadagi joyida ko'rsatiladi — dublikat bo'lmasligi uchun) */}
              {!config.phoneEmailAuthEnabled && error && (
                <p className="text-[12px] font-semibold text-pdanger text-center mb-2 animate-fadeIn">{error}</p>
              )}
              {telegramLoginCode ? (
                <div className="flex flex-col items-center gap-2 py-3">
                  <span className="w-5 h-5 border-2 border-[#0088cc]/40 border-t-[#0088cc] rounded-full animate-spin" />
                  <p className="text-[12px] text-pmuted text-center">
                    {tt('authTgSharePhone')}
                  </p>
                  {!isMobileBrowser() && (
                    <button
                      type="button"
                      onClick={() => setQrOpen(true)}
                      className="text-[12px] font-semibold text-[#0088cc] hover:underline"
                    >
                      {tt('authQrTitle')}
                    </button>
                  )}
                  <a
                    href={telegramLoginUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[#0088cc] hover:underline"
                  >
                    {tt('authQrOpenBot')}
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startTelegramLogin}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#0088cc] rounded-control hover:bg-[#0077b5] transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  <span className="text-[15px] font-semibold text-white">{tt('authTelegramLogin')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {qrOpen && telegramLoginUrl && (
        <TelegramQrSheet url={telegramLoginUrl} onClose={() => setQrOpen(false)} />
      )}
    </div>
  )
}
