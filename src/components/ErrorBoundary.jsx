import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Noma\'lum xato' }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#e6edf3',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Xato yuz berdi</h2>
          <p style={{ fontSize: 14, color: '#8b949e', textAlign: 'center', marginBottom: 24 }}>
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#1f6feb',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 600,
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
