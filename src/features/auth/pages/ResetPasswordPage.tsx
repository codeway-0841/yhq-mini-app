import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'
import PasswordInput from '../components/PasswordInput'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memoize trimmed values to avoid repeated string allocations
  const trimmedPassword = useMemo(() => password.trim(), [password])
  const trimmedConfirmPassword = useMemo(() => confirmPassword.trim(), [confirmPassword])

  const token = searchParams.get('token') ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null)

  if (!token) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
        <div className="card-premium p-8 text-center">
          <h1 className="text-[18px] font-bold text-fg mb-2">
            {language === 'ru' ? 'Ссылка недействительна' : 'Havola yaroqsiz'}
          </h1>
          <p className="text-[13px] text-muted mb-4">
            {language === 'ru'
              ? 'Запросите новую ссылку для сброса пароля'
              : 'Parol tiklash uchun yangi havola so\'rang'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-premium px-6 py-2.5 rounded-xl font-bold text-[14px]"
          >
            {language === 'ru' ? 'На главную' : 'Bosh sahifaga'}
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError(language === 'ru' ? 'Пароли не совпадают' : 'Parollar mos emas')
      return
    }
    if (trimmedPassword.length < 8) {
      setError(language === 'ru' ? 'Пароль слишком короткий (минимум 8 символов)' : 'Parol juda qisqa (kamida 8 belgi)')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.resetPassword(token, trimmedPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === 'ru' ? 'Ошибка' : 'Xatolik'))
      setBusy(false)
    }
  }

  // Auto-redirect on success
  useEffect(() => {
    if (success) {
      const timeoutId = setTimeout(() => navigate('/'), 3000)
      return () => clearTimeout(timeoutId)
    }
  }, [success, navigate])

  if (success) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
        <div className="card-premium p-8 text-center space-y-4 max-w-md animate-premiumIn">
          <div className="w-16 h-16 rounded-full bg-duo-green/10 flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-duo-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-[20px] font-black text-fg">
            {language === 'ru' ? '✓ Пароль изменён!' : '✓ Parol o\'zgartirildi!'}
          </h1>
          <p className="text-[14px] text-muted">
            {language === 'ru'
              ? 'Ваш пароль успешно изменён. Перенаправление...'
              : 'Parolingiz muvaffaqiyatli o\'zgartirildi. Yo\'naltirilmoqda...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="card-premium p-6">
          <h1 className="text-[20px] font-black text-fg text-center mb-2">
            {language === 'ru' ? 'Новый пароль' : 'Yangi parol'}
          </h1>
          <p className="text-[13px] text-muted text-center mb-6">
            {language === 'ru'
              ? 'Введите новый пароль для вашего аккаунта'
              : 'Akkauntingiz uchun yangi parol kiriting'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={setPassword}
                label={language === 'ru' ? 'Новый пароль' : 'Yangi parol'}
                autoComplete="new-password"
                disabled={busy}
              />
              {trimmedPassword.length > 0 && (
                <div className="mt-3">
                  <PasswordStrengthMeter password={trimmedPassword} language={language} />
                </div>
              )}
            </div>

            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              label={language === 'ru' ? 'Подтвердите пароль' : 'Parolni tasdiqlang'}
              autoComplete="new-password"
              disabled={busy}
            />

            {error && (
              <p className="text-[12px] font-semibold text-duo-red animate-fadeIn">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!trimmedPassword || !trimmedConfirmPassword || trimmedPassword.length < 8 || trimmedPassword !== trimmedConfirmPassword || busy}
              className="btn-premium w-full py-3.5 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2"
            >
              {busy && <span className="w-4 h-4 border-2 border-ponprimary/60 border-t-transparent rounded-full animate-spin" />}
              {language === 'ru' ? 'Сохранить пароль' : 'Parolni saqlash'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
