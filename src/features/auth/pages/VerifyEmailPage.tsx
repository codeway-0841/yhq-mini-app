import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token') ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null)
    if (!token) {
      setStatus('error')
      setError(language === 'ru' ? 'Токен отсутствует' : 'Token topilmadi')
      return
    }

    let cancelled = false

    api.verifyEmail(token)
      .then(() => {
        if (cancelled) return
        setStatus('success')
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : (language === 'ru' ? 'Ошибка' : 'Xatolik'))
      })

    return () => {
      cancelled = true
    }
  }, [searchParams, language])

  // Auto-redirect on success
  useEffect(() => {
    if (status === 'success') {
      const timeoutId = setTimeout(() => navigate('/'), 3000)
      return () => clearTimeout(timeoutId)
    }
  }, [status, navigate])

  return (
    <div className="min-h-screen bg-pcanvas flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="rounded-container border border-pline bg-pcard p-8 text-center space-y-4">
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-full bg-pwash flex items-center justify-center mx-auto">
                <div aria-hidden="true" className="w-8 h-8 border-4 border-pprimary/30 border-t-pprimary rounded-full motion-safe:animate-spin" />
              </div>
              <h1 className="text-[20px] font-semibold text-pfg">
                {language === 'ru' ? 'Проверяем...' : 'Tekshirilmoqda...'}
              </h1>
              <p className="text-[14px] text-pmuted">
                {language === 'ru'
                  ? 'Подтверждаем ваш email адрес'
                  : 'Email manzilingiz tasdiqlanmoqda'}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-pwash flex items-center justify-center mx-auto motion-safe:animate-premiumIn">
                <CheckCircle2 size={36} strokeWidth={1.75} className="text-pprimary" />
              </div>
              <h1 className="text-[20px] font-semibold text-pfg">
                {language === 'ru' ? 'Подтверждено' : 'Tasdiqlandi'}
              </h1>
              <p className="text-[14px] text-pmuted">
                {language === 'ru'
                  ? 'Ваш email успешно подтверждён'
                  : 'Emailingiz muvaffaqiyatli tasdiqlandi'}
              </p>
              <p className="text-[12px] text-pmuted/70">
                {language === 'ru'
                  ? 'Перенаправление на главную...'
                  : 'Bosh sahifaga yo\'naltirilmoqda...'}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-[rgb(var(--p-danger-rgb)/0.10)] flex items-center justify-center mx-auto motion-safe:animate-premiumIn">
                <XCircle size={36} strokeWidth={1.75} className="text-pdanger" />
              </div>
              <h1 className="text-[20px] font-semibold text-pfg">
                {language === 'ru' ? 'Ошибка' : 'Xatolik'}
              </h1>
              <p className="text-[14px] text-pdanger">
                {error || (language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi')}
              </p>
              <button
                onClick={() => navigate('/')}
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none transition-[transform,filter] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 rounded-2xl flex h-12 w-full items-center justify-center font-semibold text-[14px] mt-4 shadow-xs"
              >
                {language === 'ru' ? 'На главную' : 'Bosh sahifaga'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
