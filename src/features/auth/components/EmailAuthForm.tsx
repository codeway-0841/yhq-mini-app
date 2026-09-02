import { useState } from 'react'
import { api, type AuthResponse } from '../../../shared/api'
import { track } from '../../../shared/lib/analytics'
import { authErrorKey } from '../validation'
import { useT } from '../../../shared/i18n'
import PasswordInput from './PasswordInput'
import PasswordStrengthMeter from './PasswordStrengthMeter'

interface EmailAuthFormProps {
  mode: 'login' | 'register'
  language: 'uz' | 'ru'
  onSuccess: (data: AuthResponse) => void
  onToggleMode?: () => void
}

export default function EmailAuthForm({ mode, language, onSuccess, onToggleMode }: EmailAuthFormProps) {
  const tt = useT(language)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    if (!isValidEmail(email)) {
      setError(tt('authInvalidEmail'))
      return
    }
    if (mode === 'register' && !firstName.trim()) return

    setBusy(true)
    setError(null)
    try {
      let data: AuthResponse
      if (mode === 'register') {
        data = await api.registerWithEmail({ email: email.toLowerCase(), password, firstName: firstName.trim() })
        track('register', { provider: 'email' })
      } else {
        data = await api.loginWithEmail({ email: email.toLowerCase(), password })
        track('login', { provider: 'email' })
      }
      onSuccess(data)
    } catch (err) {
      setError(tt(authErrorKey(err)))
      setBusy(false)
    }
  }

  const inputCls =
    'w-full bg-psurface rounded-2xl px-3.5 py-3 text-[15px] text-pfg ' +
    'placeholder:text-pmuted outline-none focus:ring-2 focus:ring-pprimary shadow-xs transition-all'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="email" className="text-[11px] font-semibold text-pmuted uppercase tracking-wide -mb-1.5">
        {tt('authEmail')}
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete={mode === 'register' ? 'email' : 'username'}
        placeholder="example@email.com"
        disabled={busy}
        className={inputCls}
      />

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
            placeholder={tt('authFirstNamePlaceholder')}
          />
        </>
      )}

      <PasswordInput
        id="password"
        value={password}
        onChange={setPassword}
        label={tt('authPassword')}
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        disabled={busy}
        showStrengthMeter={mode === 'register'}
      />

      {mode === 'register' && password.length > 0 && (
        <PasswordStrengthMeter password={password} language={language} />
      )}

      {error && (
        <p className="text-[12px] font-semibold text-pdanger animate-fadeIn">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          !email.trim() ||
          !password.trim() ||
          (mode === 'register' && !firstName.trim()) ||
          busy
        }
        className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-2xl font-semibold text-[15px] mt-1 flex items-center justify-center gap-2 shadow-md"
      >
        {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
        {tt(mode === 'login' ? 'authLogin' : 'authRegister')}
      </button>

      {onToggleMode && (
        <button
          type="button"
          onClick={onToggleMode}
          className="text-[13px] text-pmuted hover:text-pfg transition-colors text-center"
          disabled={busy}
        >
          {mode === 'login' ? tt('authNoAccount') : tt('authHaveAccount')}
        </button>
      )}
    </form>
  )
}
