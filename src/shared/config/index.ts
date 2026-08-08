const API_BASE     = import.meta.env['VITE_API_BASE_URL'] as string | undefined
const WS_ENV       = import.meta.env['VITE_WS_URL']       as string | undefined
const BOT_USERNAME = import.meta.env['VITE_BOT_USERNAME'] as string | undefined

function deriveWsUrl(): string {
  if (WS_ENV) return WS_ENV
  if (typeof window === 'undefined') return 'ws://localhost/ws/octagon'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/octagon`
}

export const config = {
  apiBaseUrl: API_BASE || '/api',
  wsUrl: deriveWsUrl(),
  /** @ belgisisiz bot username — TG Login Widget + "Telegram ulash" deep-link uchun */
  botUsername: BOT_USERNAME || undefined,
} as const
