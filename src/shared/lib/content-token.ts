/**
 * Kontent tokeni ushlab turuvchi (R2/Worker savol kontenti, BARCHA fanlar).
 *
 *  - Tokenlar FAQAT xotirada (localStorage/IndexedDB'ga YO'Q) — 10 daqiqalik
 *    qisqa TTL allaqachon cheklaydi, persist qilish kerak emas;
 *  - har fan uchun alohida token (Worker scope: sid + versiya) — Map;
 *  - single-flight: parallel so'rovlar BITTA issuance'ga yig'iladi;
 *  - TTL'ning 80%i o'tganda keyingi getContentToken() yangi token oladi;
 *  - Xom token log'lanmaydi.
 *
 * SEGMENT indeksi: server javobidagi `segment` bilan ham indekslanadi —
 * rasm URL'lari (`/images/<segment>/<hash>.webp`) qaysi fan tokenini
 * ishlatishni path'dan o'zi hal qiladi (client'da fan↔segment MAPPING YO'Q —
 * SSOT serverda).
 *
 * Rasmlar (<img>) header yubora olmaydi — ular uchun token `?ct=` query
 * param bilan Worker URL'ga qo'shiladi (buildContentImageUrl).
 */
import { api } from '../api'
import { config } from '../config'

interface TokenState {
  subjectId: string
  segment: string
  token: string
  expiresAtMs: number
  issuedAtMs: number
}

const states = new Map<string, TokenState>()
const bySegment = new Map<string, TokenState>()
const inFlight = new Map<string, Promise<TokenState>>()

/** TTL'ning shu ulushi qolganda yangilaymiz (20%) — so'rov paytida token
 *  o'rtada eskirib qolmasligi uchun. */
const REFRESH_AFTER = 0.8

function isFresh(state: TokenState): boolean {
  const ttl = state.expiresAtMs - state.issuedAtMs
  return Date.now() < state.issuedAtMs + ttl * REFRESH_AFTER
}

/**
 * Fan tokeni holati (token + segment). Xatolarda THROW — caller
 * (r2-question-bank) legacy fallback'ga tushadi.
 */
export async function getContentTokenState(subjectId: string): Promise<TokenState> {
  const cached = states.get(subjectId)
  if (cached && isFresh(cached)) return cached
  const flying = inFlight.get(subjectId)
  if (flying) return flying
  const run = (async () => {
    const res = await api.getContentToken(subjectId)
    const expiresAtMs = new Date(res.expiresAt).getTime()
    const state: TokenState = {
      subjectId,
      segment: res.segment,
      token: res.token,
      expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 10 * 60_000,
      issuedAtMs: Date.now(),
    }
    states.set(subjectId, state)
    if (state.segment) bySegment.set(state.segment, state)
    return state
  })()
  inFlight.set(subjectId, run)
  try {
    return await run
  } finally {
    if (inFlight.get(subjectId) === run) inFlight.delete(subjectId)
  }
}

/** Joriy (yoki yangi) kontent tokeni — chunk/manifest fetch uchun. */
export async function getContentToken(subjectId: string): Promise<string> {
  return (await getContentTokenState(subjectId)).token
}

/** Sinxron o'qish — rasm URL qurishda (render paytida) ishlatiladi. */
export function getCurrentContentToken(subjectId?: string): string | null {
  if (!subjectId) {
    // Fansiz chaqiruv (legacy) — birinchi yaroqli token
    for (const state of states.values()) {
      if (Date.now() < state.expiresAtMs) return state.token
    }
    return null
  }
  const state = states.get(subjectId)
  if (!state || Date.now() >= state.expiresAtMs) return null
  return state.token
}

const IMAGE_PATH_RE = /^\/images\/([a-z][a-z0-9-]{0,31})\/[a-f0-9]{16}\.(webp|png|jpe?g)$/

/**
 * Worker rasm URL'i: `/images/<segment>/<hash>.webp` →
 * `<workerUrl>/images/...?ct=<token>`.
 * Token segment bo'yicha topiladi (fan mapping shart emas).
 * Worker URL sozlanmagan bo'lsa null (caller eski yo'lni ishlatadi).
 */
export function buildContentImageUrl(path: string): string | null {
  const base = config.contentWorkerUrl
  if (!base) return null
  const match = IMAGE_PATH_RE.exec(path)
  if (!match) return null
  const segment = match[1] as string
  const state = bySegment.get(segment)
  const token = state && Date.now() < state.expiresAtMs ? state.token : null
  return token ? `${base}${path}?ct=${encodeURIComponent(token)}` : `${base}${path}`
}

/** Testlar/account-switch uchun reset. */
export function clearContentToken(): void {
  states.clear()
  bySegment.clear()
  inFlight.clear()
}
