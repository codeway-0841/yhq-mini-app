import React from 'react'
import { Sentry } from '../lib/sentry'

interface ErrorState {
  hasError: boolean
  message: string
}

/** Crash ekrani matnlari (audit Q6): Boundary i18n hook'siz klass komponent —
 *  til persist snapshot'idan oddiy o'qilinadi (yhq-app-store → settings.language). */
const CRASH_TEXT = {
  uz: {
    title: 'Ilova kutilmaganda to\'xtadi',
    body: 'Sahifani qayta yuklang. Takrorlansa, ma\'lumotlaringiz saqlanib qoladi — keyinroq urinib ko\'ring.',
    reload: 'Qayta yuklash',
  },
  ru: {
    title: 'Приложение неожиданно остановилось',
    body: 'Перезагрузите страницу. Если ошибка повторится, ваши данные сохранятся — попробуйте позже.',
    reload: 'Перезагрузить',
  },
} as const

function crashLanguage(): 'uz' | 'ru' {
  try {
    const raw = localStorage.getItem('yhq-app-store')
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { settings?: { language?: string } } }
      if (parsed.state?.settings?.language === 'ru') return 'ru'
    }
  } catch { /* ignore */ }
  return 'uz'
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorState {
    return { hasError: true, message: (error as Error)?.message || 'Noma\'lum xato' }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('App error:', error, info)
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    })
  }

  render() {
    if (this.state.hasError) {
      const t = CRASH_TEXT[crashLanguage()]
      return (
        // Ataylab inline style + xom SVG: xato AYNAN UI komponentidan kelgan
        // bo'lishi mumkin, shuning uchun bu ekran ui/ qatlamiga TAYANMAYDI.
        // Faqat CSS tokenlariga bog'lanadi (ular tema bilan birga ishlaydi).
        <div style={{
          minHeight: '100vh',
          background: 'var(--theme-canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: 'var(--theme-fg)',
          fontFamily: "'Inter Tight', system-ui, sans-serif",
        }}>
          <svg
            width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--p-danger)"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" style={{ marginBottom: 16, opacity: 0.7 }}
          >
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <h2 style={{
            fontSize: 19, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.015em',
            fontFamily: "'Bricolage Grotesque', 'Inter Tight', system-ui, sans-serif",
          }}>
            {t.title}
          </h2>
          <p style={{
            fontSize: 14, color: 'var(--theme-fg-muted)', textAlign: 'center',
            marginBottom: 20, maxWidth: '34ch',
          }}>
            {t.body}
          </p>
          {/* Xom xato matni FAQAT dev'da (audit Q6): prod'da ichki tafsilotlar
              (server javoblari, stack parchalari) foydalanuvchiga ko'rinmasligi
              kerak — tafsilotlar Sentry'ga ketadi. */}
          {import.meta.env.DEV && (
            <p style={{
              fontSize: 12.5, color: 'var(--theme-fg-subtle)', textAlign: 'center',
              marginBottom: 24, maxWidth: '40ch', wordBreak: 'break-word',
            }}>
              {this.state.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              height: 44,
              padding: '0 18px',
              border: 'none',
              borderRadius: 'var(--radius-control, 10px)',
              background: 'var(--p-primary)',
              color: 'var(--p-on-primary)',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t.reload}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
