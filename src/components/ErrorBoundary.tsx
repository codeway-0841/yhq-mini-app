import React from 'react'
import { Sentry } from '../lib/sentry'

interface ErrorState {
  hasError: boolean
  message: string
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
      return (
        <div style={{
          minHeight: '100vh',
          background: 'var(--theme-canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: 'var(--theme-fg)',
          fontFamily: 'Nunito, sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Xato yuz berdi</h2>
          <p style={{ fontSize: 14, color: 'var(--theme-fg-muted)', textAlign: 'center', marginBottom: 24 }}>
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-3d-green"
            style={{
              border: 'none',
              borderRadius: 16,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Qayta yuklash
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
