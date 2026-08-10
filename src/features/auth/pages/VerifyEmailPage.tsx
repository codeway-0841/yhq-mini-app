import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../../../shared/api'
import { useAppStore } from '../../../shared/store/useAppStore'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="card-premium p-8 text-center space-y-4">
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-full bg-duo-green/10 flex items-center justify-center mx-auto">
                <div className="w-8 h-8 border-4 border-duo-green/30 border-t-duo-green rounded-full animate-spin" />
              </div>
              <h1 className="text-[20px] font-black text-fg">
                {language === 'ru' ? 'Проверяем...' : 'Tekshirilmoqda...'}
              </h1>
              <p className="text-[14px] text-muted">
                {language === 'ru'
                  ? 'Подтверждаем ваш email адрес'
                  : 'Email manzilingiz tasdiqlanmoqda'}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-duo-green/10 flex items-center justify-center mx-auto animate-premiumIn">
                <svg className="w-10 h-10 text-duo-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[20px] font-black text-fg">
                {language === 'ru' ? '✓ Подтверждено!' : '✓ Tasdiqlandi!'}
              </h1>
              <p className="text-[14px] text-muted">
                {language === 'ru'
                  ? 'Ваш email успешно подтверждён'
                  : 'Emailingiz muvaffaqiyatli tasdiqlandi'}
              </p>
              <p className="text-[12px] text-muted/70">
                {language === 'ru'
                  ? 'Перенаправление на главную...'
                  : 'Bosh sahifaga yo\'naltirilmoqda...'}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-duo-red/10 flex items-center justify-center mx-auto animate-premiumIn">
                <svg className="w-10 h-10 text-duo-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-[20px] font-black text-fg">
                {language === 'ru' ? 'Ошибка' : 'Xatolik'}
              </h1>
              <p className="text-[14px] text-duo-red">
                {error || (language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi')}
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn-premium w-full py-3 rounded-2xl font-black text-[14px] mt-4"
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
