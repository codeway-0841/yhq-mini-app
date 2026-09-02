import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
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

  // Auto-redirect on success — EARLY RETURN'lardan OLDIN deklaratsiya qilinishi shart
  // (react-hooks/rules-of-hooks: hook'lar har render'da bir xil tartibda bo'lishi kerak)
  useEffect(() => {
    if (success) {
      const timeoutId = setTimeout(() => navigate('/'), 3000)
      return () => clearTimeout(timeoutId)
    }
  }, [success, navigate])

  if (!token) {
    return (
      <div className="min-h-screen bg-pcanvas flex items-center justify-center px-6">
        <div className="rounded-container border border-pline bg-pcard p-8 text-center">
          <h1 className="text-[18px] font-semibold text-pfg mb-2">
            {language === 'ru' ? 'Ссылка недействительна' : 'Havola yaroqsiz'}
          </h1>
          <p className="text-[13px] text-pmuted mb-4">
            {language === 'ru'
              ? 'Запросите новую ссылку для сброса пароля'
              : 'Parol tiklash uchun yangi havola so\'rang'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] shadow-xs"
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

  if (success) {
    return (
      <div className="min-h-screen bg-pcanvas flex items-center justify-center px-6">
        <div className="rounded-container border border-pline bg-pcard p-8 text-center space-y-4 max-w-md animate-premiumIn">
          <div className="w-16 h-16 rounded-full bg-pwash flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} strokeWidth={1.75} className="text-pprimary" />
          </div>
          <h1 className="text-[20px] font-semibold text-pfg">
            {language === 'ru' ? 'Пароль изменён' : 'Parol o\'zgartirildi'}
          </h1>
          <p className="text-[14px] text-pmuted">
            {language === 'ru'
              ? 'Ваш пароль успешно изменён. Перенаправление...'
              : 'Parolingiz muvaffaqiyatli o\'zgartirildi. Yo\'naltirilmoqda...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pcanvas flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-container border border-pline bg-pcard p-6">
          <h1 className="text-[20px] font-semibold text-pfg text-center mb-2">
            {language === 'ru' ? 'Новый пароль' : 'Yangi parol'}
          </h1>
          <p className="text-[13px] text-pmuted text-center mb-6">
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
              <p className="text-[12px] font-semibold text-pdanger animate-fadeIn">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!trimmedPassword || !trimmedConfirmPassword || trimmedPassword.length < 8 || trimmedPassword !== trimmedConfirmPassword || busy}
              className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 w-full py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 shadow-xs"
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
