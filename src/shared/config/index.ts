const API_BASE     = import.meta.env['VITE_API_BASE_URL'] as string | undefined
const WS_ENV       = import.meta.env['VITE_WS_URL']       as string | undefined
const BOT_USERNAME = import.meta.env['VITE_BOT_USERNAME'] as string | undefined
const TEST_SESSIONS_V2 = import.meta.env['VITE_TEST_SESSIONS_V2'] as string | undefined
const LIBRARY_PDF_BASE = import.meta.env['VITE_LIBRARY_PDF_BASE_URL'] as string | undefined
const CONTENT_WORKER_URL = import.meta.env['VITE_CONTENT_WORKER_URL'] as string | undefined
const R2_QBANK = import.meta.env['VITE_R2_QUESTION_BANK'] as string | undefined

/** Derivation uchun minimal env ko'rinishi — testlar to'g'ridan-to'g'ri chaqiradi. */
export interface ClientEnv {
  DEV:   boolean
  MODE:  string
  VITE_API_BASE_URL?: string | undefined
  VITE_WS_URL?:       string | undefined
}

/**
 * HAQIQIY dev-server belgisi — MODE orqali, import.meta.env.DEV orqali EMAS.
 *
 * 2026-08-27 incident: `.env` ga `NODE_ENV=development` yozilib qolgan, Vite
 * buni build default'idan USTUN qo'yib, prod'ga DEV-bundle chiqargan
 * (import.meta.env.DEV=true, MODE=production). Eski kod DEV'ga qaraganligi
 * uchun wsUrl `ws://localhost:3001`ga tushib, prod'dagi BARCHA userlarda
 * duel "WebSocket connection error" bergan. `vite build` MODE'ni har doim
 * 'production' qiladi (NODE_ENV buzilgan bo'lsa ham) — shuning uchun
 * dev-server'ni FAQAT MODE orqali aniqlash xavfsiz.
 */
function isDevServer(env: ClientEnv): boolean {
  return env.DEV && env.MODE === 'development'
}

export function resolveApiBase(env: ClientEnv): string {
  if (isDevServer(env)) return '/api'
  return env.VITE_API_BASE_URL || '/api'
}

export function resolveWsUrl(env: ClientEnv, location?: { protocol: string; host: string }): string {
  if (isDevServer(env) && (!env.VITE_WS_URL || env.VITE_WS_URL.startsWith('wss://'))) {
    return 'ws://localhost:3001/ws/octagon'
  }
  if (env.VITE_WS_URL) return env.VITE_WS_URL
  if (!location) return 'ws://localhost/ws/octagon'
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws/octagon`
}

/** Content Worker bazasi (R2 savol kontenti) — trailing slash'siz, bo'sh bo'lsa null.
 *  Sof funksiya (test uchun): runtime-config.test.ts naqshi. */
export function resolveContentWorkerUrl(raw?: string): string | null {
  const trimmed = raw?.trim().replace(/\/+$/, '')
  return trimmed && /^https:\/\//.test(trimmed) ? trimmed : null
}

/** Kutubxona PDF bazasi — env (trailing slash'siz), bo'sh bo'lsa lokal fallback.
 *  Sof funksiya (test uchun): runtime-config.test.ts naqshi. */
export function resolveLibraryPdfBase(raw?: string): string {
  const trimmed = raw?.trim().replace(/\/+$/, '')
  return trimmed || '/kutubxona/pdf'
}

const env: ClientEnv = {
  DEV:  import.meta.env.DEV,
  MODE: import.meta.env.MODE,
  VITE_API_BASE_URL: API_BASE,
  VITE_WS_URL:       WS_ENV,
}

export const config = {
  apiBaseUrl: resolveApiBase(env),
  wsUrl: resolveWsUrl(env, typeof window === 'undefined' ? undefined : window.location),
  /** @ belgisisiz bot username — TG Login Widget + "Telegram ulash" deep-link uchun */
  botUsername: BOT_USERNAME || 'kiwi_uz_bot',
  /**
   * Telefon (SMS OTP) + Email login UI — VAQTINCHA o'chiq (SMS xarajati).
   * Qayta yoqish: `true` qiling — LoginPage'dagi barcha forma/segment'lar tiklanadi.
   * Backend endpoint'lar ochiq qoladi (faqat client UI yashirilgan).
   */
  phoneEmailAuthEnabled: false,
  /** Server-authoritative bounded random/saved tests. Default off; rollback = env false. */
  testSessionsV2Enabled: TEST_SESSIONS_V2 === 'true',
  /**
   * Kutubxona PDF bazasi (trailing slash'siz). PDF'lar repo'da emas (~3GB) —
   * prod'da R2/S3/CDN manzili beriladi (masalan `https://cdn.kivvi.uz/kutubxona/pdf`).
   * Berilmasa lokal `/kutubxona/pdf` (dev fallback).
   */
  libraryPdfBaseUrl: resolveLibraryPdfBase(LIBRARY_PDF_BASE),
  /** R2/Worker savol kontenti (fizika pilot) — Worker domeni (https, trailing slash'siz).
   *  null bo'lsa R2 yo'li butunlay o'chiq (legacy /api/questions ishlatiladi). */
  contentWorkerUrl: resolveContentWorkerUrl(CONTENT_WORKER_URL),
  /**
   * Savol banklarini R2/Worker'dan yuklash flag'i (BARCHA fanlar — per-fan
   * gate server'da: /questions/version javobida r2v bo'lmasa client legacy
   * yo'lga tushadi). Worker URL'siz BEMA'NI — ikkalasi birga tekshiriladi.
   * Server-side kill switch: QBANK_R2_ENABLED=false → r2v yo'qoladi.
   */
  r2QuestionBank: R2_QBANK === 'true' && resolveContentWorkerUrl(CONTENT_WORKER_URL) !== null,
} as const
