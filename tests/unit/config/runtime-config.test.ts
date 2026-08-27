/**
 * Runtime config derivation (wsUrl/apiBaseUrl) — 2026-08-27 incident regression.
 *
 * Incident: `.env` ga `NODE_ENV=development` yozilib qolgani uchun prod'ga
 * DEV-bundle chiqqan (import.meta.env.DEV=true, MODE='production'). Eski kod
 * DEV'ga qaraganligi uchun wsUrl `ws://localhost:3001`ga tushgan va prod'dagi
 * BARCHA userlarda duel "WebSocket connection error" bergan.
 *
 * Himoya: dev-server belgisi FAQAT `MODE === 'development'` — `vite build`
 * MODE'ni NODE_ENV buzilgan bo'lsa ham 'production' qiladi. Shu invariant
 * buzilmasligi SHART: hech qanday build kombinatsiyasida prod bundle
 * localhost'ga ishora qilmasligi kerak.
 */
import { describe, it, expect } from 'vitest'
import { resolveWsUrl, resolveApiBase } from '../../../src/shared/config'

const PROD_WS = 'wss://yhq-websocket-server.onrender.com/ws/octagon'
const PROD_API = 'https://www.kivvi.uz/api'

describe('resolveWsUrl — dev-server FAQAT MODE orqali aniqlanadi', () => {
  it('haqiqiy dev server (MODE=development): localhost fallback', () => {
    expect(resolveWsUrl({ DEV: true, MODE: 'development' })).toBe('ws://localhost:3001/ws/octagon')
    // .env.development.local'dagi aniq ws:// URL dev'da hurmat qilinadi
    expect(resolveWsUrl({ DEV: true, MODE: 'development', VITE_WS_URL: 'ws://localhost:3001/ws/octagon' }))
      .toBe('ws://localhost:3001/ws/octagon')
  })

  it('dev server + .env.local dagi PROD wss: dev server localhost\'ga qaytaradi', () => {
    expect(resolveWsUrl({ DEV: true, MODE: 'development', VITE_WS_URL: PROD_WS }))
      .toBe('ws://localhost:3001/ws/octagon')
  })

  it('prod build (MODE=production): VITE_WS_URL hurmat qilinadi', () => {
    expect(resolveWsUrl({ DEV: false, MODE: 'production', VITE_WS_URL: PROD_WS })).toBe(PROD_WS)
  })

  it('REGRESSION: buzilgan DEV-bundle prod\'da (DEV=true + MODE=production) — localhost\'ga TUSHMASLIGI SHART', () => {
    const url = resolveWsUrl({ DEV: true, MODE: 'production', VITE_WS_URL: PROD_WS })
    expect(url).toBe(PROD_WS)
    expect(url).not.toContain('localhost')
  })

  it('VITE_WS_URL yo\'q prod: joriy host\'dan derive (wss https sahifada)', () => {
    const loc = { protocol: 'https:', host: 'www.kivvi.uz' }
    expect(resolveWsUrl({ DEV: false, MODE: 'production' }, loc)).toBe('wss://www.kivvi.uz/ws/octagon')
  })
})

describe('resolveApiBase', () => {
  it('dev server: relative /api (vite proxy)', () => {
    expect(resolveApiBase({ DEV: true, MODE: 'development' })).toBe('/api')
  })

  it('prod build: VITE_API_BASE_URL, bo\'lmasa /api fallback', () => {
    expect(resolveApiBase({ DEV: false, MODE: 'production', VITE_API_BASE_URL: PROD_API })).toBe(PROD_API)
    expect(resolveApiBase({ DEV: false, MODE: 'production' })).toBe('/api')
  })
})
