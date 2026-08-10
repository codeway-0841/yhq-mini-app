import { useState } from 'react'
import { api } from '../../../shared/api'
import { useT } from '../../../shared/i18n'

interface ForgotPasswordFormProps {
  language: 'uz' | 'ru'
  onBack: () => void
}

export default function ForgotPasswordForm({ language, onBack }: ForgotPasswordFormProps) {
  const tt = useT(language)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !isValidEmail(email)) {
      setError(tt('authInvalidEmail'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.requestPasswordReset(email.toLowerCase())
      setSent(true)
      setBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : tt('authGenericError'))
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4 animate-fadeIn">
        <div className="w-16 h-16 rounded-full bg-duo-green/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-duo-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-[17px] font-bold text-fg mb-2">
            {language === 'ru' ? 'Проверьте почту' : 'Emailni tekshiring'}
          </h3>
          <p className="text-[13px] text-muted">
            {language === 'ru'
              ? `Мы отправили инструкции по восстановлению пароля на ${email}`
              : `Parol tiklash bo'yicha ko'rsatmalar ${email} manziliga yuborildi`}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-[13px] text-duo-green hover:underline font-semibold"
        >
          {language === 'ru' ? '← Назад ко входу' : '← Kirish sahifasiga qaytish'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="text-center mb-4">
        <h3 className="text-[17px] font-bold text-fg mb-1">
          {language === 'ru' ? 'Забыли пароль?' : 'Parolingizni unutdingizmi?'}
        </h3>
        <p className="text-[13px] text-muted">
          {language === 'ru'
            ? 'Введите email, и мы отправим инструкции'
            : 'Emailingizni kiriting, ko\'rsatmalar yuboramiz'}
        </p>
      </div>

      <div>
        <label htmlFor="reset-email" className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-2">
          Email
        </label>
        <input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="example@email.com"
          disabled={busy}
          className="w-full bg-elevated border border-line rounded-xl px-3.5 py-3 text-[15px] text-fg placeholder:text-muted outline-none focus:border-duo-green transition-colors"
        />
      </div>

      {error && (
        <p className="text-[12px] font-semibold text-duo-red animate-fadeIn">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!email.trim() || busy}
        className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2"
      >
        {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
        {language === 'ru' ? 'Отправить' : 'Yuborish'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-muted hover:text-fg transition-colors text-center w-full"
        disabled={busy}
      >
        {language === 'ru' ? '← Назад' : '← Orqaga'}
      </button>
    </form>
  )
}
