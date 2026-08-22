import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
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
        <div className="w-16 h-16 rounded-full bg-pprimary/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-pprimary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-[17px] font-semibold text-pfg mb-2">
            {language === 'ru' ? 'Проверьте почту' : 'Emailni tekshiring'}
          </h3>
          <p className="text-[13px] text-pmuted">
            {language === 'ru'
              ? `Мы отправили инструкции по восстановлению пароля на ${email}`
              : `Parol tiklash bo'yicha ko'rsatmalar ${email} manziliga yuborildi`}
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-pprimary hover:underline"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          {language === 'ru' ? 'Назад ко входу' : 'Kirish sahifasiga qaytish'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="text-center mb-4">
        <h3 className="text-[17px] font-semibold text-pfg mb-1">
          {language === 'ru' ? 'Забыли пароль?' : 'Parolingizni unutdingizmi?'}
        </h3>
        <p className="text-[13px] text-pmuted">
          {language === 'ru'
            ? 'Введите email, и мы отправим инструкции'
            : 'Emailingizni kiriting, ko\'rsatmalar yuboramiz'}
        </p>
      </div>

      <div>
        <label htmlFor="reset-email" className="text-[11px] font-semibold text-pmuted uppercase tracking-wide block mb-2">
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
          className="w-full bg-psurface border border-pline rounded-control px-3.5 py-3 text-[15px] text-pfg placeholder:text-pmuted outline-none focus:border-pprimary transition-colors"
        />
      </div>

      {error && (
        <p className="text-[12px] font-semibold text-pdanger animate-fadeIn">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!email.trim() || busy}
        className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-container font-semibold text-[15px] flex items-center justify-center gap-2"
      >
        {busy && <span aria-hidden="true" className="size-4 rounded-full border-2 border-ponprimary/60 border-t-transparent motion-safe:animate-spin" />}
        {language === 'ru' ? 'Отправить' : 'Yuborish'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-full items-center justify-center gap-1 text-[13px] text-pmuted transition-colors hover:text-pfg"
        disabled={busy}
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        {language === 'ru' ? 'Назад' : 'Orqaga'}
      </button>
    </form>
  )
}
