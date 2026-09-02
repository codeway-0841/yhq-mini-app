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
import { useToast } from '../../shared/components/ToastContainer'
import { authErrorKey } from './validation'
import { usePhoneInput } from './hooks/usePhoneInput'
import PasswordInput from './components/PasswordInput'
import OTPInput from './components/OTPInput'
import EmailAuthForm from './components/EmailAuthForm'
import ForgotPasswordForm from './components/ForgotPasswordForm'
import TelegramQrSheet from './components/TelegramQrSheet'
import { BarChart3, QrCode, Smartphone, Target } from 'lucide-react'

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
  const { success } = useToast()

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
    ensureAccountOwner(data.user.id)
    setSessionToken(data.sessionToken)
    useAppStore.getState().hydrateFromProfile(data)
    success(tt('authLoginSuccess'))
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
        if (isMobileBrowser()) {
          window.open(res.url, '_blank')
        } else {
          setQrOpen(true)
        }
      } else {
        setError(tt('authTelegramNotConfigured'))
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        applyAuth({
          user: {
            id: '999999999',
            firstName: 'Lokal Mehmon',
            lastName: '',
            username: 'lokal_user',
            photoUrl: undefined,
            phone: undefined,
            tariff: 'free',
            coins: 100,
            ownedItems: [],
            avatarFrame: null,
          },
          progress: {
            totalCorrect: 0,
            totalWrong: 0,
            totalAnswered: 0,
            streak: 1,
            wrongByTicket: {},
            solvedQuestions: [],
            xp: 50,
          },
          settings: {
            autoNextCorrect: true,
            autoNextWrong: false,
            noAnimation: false,
            shuffleOptions: false,
            fontSize: 'medium',
            fontStyle: 'default',
            language: language ?? 'uz',
            theme: 'dark',
            offlineMode: false,
            dailyReminder: true,
            dailyReminderTime: '20:00',
          },
          savedQuestions: [],
          providers: ['telegram'],
          sessionToken: '0123456789abcdef0123456789abcdef',
        })
        return
      }
      setError(tt(authErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full bg-psurface rounded-2xl px-3.5 py-3 text-[15px] text-pfg ' +
    'placeholder:text-pmuted outline-none focus:ring-2 focus:ring-pprimary shadow-xs transition-all'

  const isWeb = !getTelegramWebApp() && !isNativeApp()

  /** Telegram login bloki — ikkala layout'da (welcome-card / forma kartasi) umumiy. */
  const telegramBlock = showTelegramLogin ? (
    <>
      {/* Xato xabari — phone/email o'chirilganda Telegram oqimi xatolari shu yerda ko'rinadi
          (flag yoqilganda phone formadagi joyida ko'rsatiladi — dublikat bo'lmasligi uchun) */}
      {!config.phoneEmailAuthEnabled && error && (
        <p className="text-[12px] font-semibold text-pdanger text-center mb-3 animate-fadeIn">{error}</p>
      )}
      {telegramLoginCode ? (
        <div className="w-full flex flex-col items-center gap-2">
          <span className="w-5 h-5 border-2 border-[#0088cc]/40 border-t-[#0088cc] rounded-full animate-spin" />
          <p className="text-[12px] text-pmuted text-center">
            {tt('authTgSharePhone')}
          </p>
          {/* QR sheet bekor qilinsa ham client adashib qolmasligi uchun —
              bot'ga o'tish / QR'ni qayta ochish doim ko'rinib turadi */}
          <div className="w-full flex flex-col gap-2 mt-1">
            <a
              href={telegramLoginUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-[#0088cc] rounded-2xl hover:bg-[#0077b5] active:scale-[0.98] transition-all shadow-md"
            >
              <svg className="w-[18px] h-[18px] fill-white" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span className="text-[14px] font-semibold text-white">{tt('authQrOpenBot')}</span>
            </a>
            {!isMobileBrowser() && (
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#0088cc]/15 text-[#0088cc] hover:bg-[#0088cc]/25 active:scale-[0.98] transition-all shadow-xs"
              >
                <QrCode size={16} strokeWidth={2.5} />
                <span className="text-[14px] font-semibold">{tt('authQrTitle')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startTelegramLogin}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-[#0088cc] rounded-2xl hover:bg-[#0077b5] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#0088cc]/25"
        >
          {busy ? (
            <span className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          )}
          <span className="text-[15px] font-semibold text-white">{tt('authTelegramLogin')}</span>
        </button>
      )}
    </>
  ) : null

  /* ── Telegram-first WELCOME ekrani (phone/email o'chiq holat — prod) ───────
     app.kivvi.uz'ga kiritgan mehmon ko'radigan birinchi ekran:
     foyda ro'yxati + bitta katta Telegram CTA (raqibdagi kabi toza modal). */
  if (!config.phoneEmailAuthEnabled) {
    const benefits = [
      { icon: BarChart3,  cls: 'bg-psuccess/10 text-psuccess', key: 'authBenefitCloud' as const },
      { icon: Target,     cls: 'bg-[#0088cc]/10 text-[#0088cc]', key: 'authBenefitDuel' as const },
      { icon: Smartphone, cls: 'bg-pgold/10 text-pgold',           key: 'authBenefitSync' as const },
    ]
    return (
      <div className="min-h-screen bg-pcanvas flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
        {/* Yumshoq aksent glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-pprimary/10 blur-[130px] pointer-events-none" />

        <div className="relative w-full max-w-[400px] animate-premiumIn">
          {/* Brend — K badge + wordmark (landing bilan bir xil assetlar) */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <img src="/images/brand-badge.webp" alt="" width={36} height={36} className="size-9" />
            <img src="/images/brand-wordmark.webp" alt="kivvi" width={96} height={28} className="h-6 w-auto" />
          </div>

          <div className="rounded-sheet bg-pcard px-6 py-8 flex flex-col items-center text-center shadow-2xl">
            {/* Telegram ikonka */}
            <div className="mb-4">
              <div className="w-[68px] h-[68px] rounded-2xl bg-[#0088cc]/12 flex items-center justify-center">
                <svg className="w-9 h-9 fill-[#0088cc]" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </div>
            </div>

            <h1 className="text-[20px] font-bold text-pfg leading-tight mb-5">
              {tt('authTgWelcomeTitle')}
            </h1>

            {/* Foydalar */}
            <div className="w-full flex flex-col gap-2.5 mb-6">
              {benefits.map(({ icon: Icon, cls, key }) => (
                <div
                  key={key}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left shadow-xs ${cls}`}
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                  <span className="text-[13px] font-semibold text-pfg">{tt(key)}</span>
                </div>
              ))}
            </div>

            <div className="w-full">{telegramBlock}</div>
          </div>

          {/* Landing'ga qaytish — faqat veb mehmon uchun */}
          {isWeb && (
            <div className="text-center mt-5">
              <a href="https://kivvi.uz" className="text-[12px] text-pmuted hover:text-pfg transition-colors font-medium">
                {language === 'ru' ? '← На главную' : '← Bosh sahifa'}
              </a>
            </div>
          )}
        </div>

        {qrOpen && telegramLoginUrl && (
          <TelegramQrSheet url={telegramLoginUrl} onClose={() => setQrOpen(false)} />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pcanvas flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[380px] animate-premiumIn">
        {isWeb ? (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src="/images/splash-brand.png" alt="KIVVI" className="w-14 rounded-2xl shadow-xs" />
              <div>
                <h1 className="text-[18px] font-semibold text-pfg leading-tight">{tt('authWelcome')}</h1>
                <p className="text-[12px] text-pmuted">{tt('authTagline')}</p>
              </div>
            </div>
            <a
              href="https://kivvi.uz"
              className="text-xs text-pprimary hover:underline font-medium"
            >
              {language === 'ru' ? 'Главная' : 'Bosh sahifa'}
            </a>
          </div>
        ) : (
          <>
            <img src="/images/splash-brand.png" alt="KIVVI" className="w-36 rounded-3xl mx-auto shadow-md" />
            <h1 className="text-[22px] font-semibold text-pfg text-center mt-5">{tt('authWelcome')}</h1>
            <p className="text-[13px] text-pmuted text-center mt-1 mb-6">{tt('authTagline')}</p>
          </>
        )}

        <div className="rounded-2xl bg-pcard p-4 shadow-xs">
          {config.phoneEmailAuthEnabled && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-psurface mb-4 shadow-xs">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setStep('form'); setMethod(method === 'forgot' ? 'phone' : method); setError(null) }}
                className={`py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                  mode === m ? 'bg-pprimary text-ponprimary' : 'text-pmuted'
                }`}
              >
                {tt(m === 'login' ? 'authLogin' : 'authRegister')}
              </button>
            ))}
          </div>
          )}

          {config.phoneEmailAuthEnabled && method !== 'forgot' && step === 'form' && (
            <div className="flex gap-2 mb-4">
              {(['phone', 'email'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMethod(m); setError(null); }}
                  className={`flex-1 py-1.5 rounded-xl text-[12px] font-semibold transition-all shadow-xs ${
                    method === m ? 'bg-pprimary/15 ring-1 ring-pprimary text-pprimary' : 'text-pmuted bg-psurface/40 hover:bg-psurface'
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
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-2xl font-semibold text-[15px] mt-1 flex items-center justify-center gap-2 shadow-md"
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
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 shadow-md"
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
              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-plineStrong" />
                <span className="text-[11px] font-semibold text-pmuted uppercase">{tt('authOr')}</span>
                <span className="flex-1 h-px bg-plineStrong" />
              </div>
              {telegramBlock}
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
