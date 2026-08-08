/**
 * Telegram Mini App initData verification (HMAC-SHA256).
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import { createHmac, createHash, timingSafeEqual } from 'crypto'

export interface InitDataUser {
  id:          number
  first_name?: string
  last_name?:  string
  username?:   string
  photo_url?:  string
}

/** Max accepted initData age (24 h) — guards against replayed captures. */
const MAX_AGE_SECONDS = 86_400

/**
 * Verify Telegram initData signature.
 * Returns the parsed user object when valid, otherwise null.
 */
export function verifyInitData(initData: string, botToken: string): InitDataUser | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return null
  }

  const hash = params.get('hash')
  if (!hash) return null

  // data-check-string: all fields except hash, sorted, joined with \n
  const entries: string[] = []
  params.forEach((value, key) => { if (key !== 'hash') entries.push(`${key}=${value}`) })
  entries.sort()
  const dataCheckString = entries.join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed  = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(hash,     'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Replay protection: auth_date MAJBURIY (bo'lmasa imzo umrbod yashaydi).
  // Math.abs EMAS — kelajakdagi vaqt ham faqat kichik skew (60s) ruxsat etiladi.
  const authDate = Number(params.get('auth_date') ?? 0)
  const nowSec = Date.now() / 1000
  if (!Number.isFinite(authDate) || authDate <= 0) return null
  if (nowSec - authDate > MAX_AGE_SECONDS) return null       // eski (replay)
  if (authDate - nowSec > 60) return null                    // kelajakdagi vaqt

  const rawUser = params.get('user')
  if (!rawUser) return null

  try {
    const user = JSON.parse(rawUser) as InitDataUser
    if (typeof user.id !== 'number') return null
    return user
  } catch {
    return null
  }
}

// ── Telegram Login Widget (web/brauzer login) ──────────────────────────────

export interface LoginWidgetUser {
  id:          number
  first_name?: string
  last_name?:  string
  username?:   string
  photo_url?:  string
}

/**
 * Telegram Login Widget verifikatsiyasi — Mini App initData'dan FARQLI sxema:
 * secret = SHA256(bot_token) (xom digest kalit), data-check-string esa
 * hash'dan tashqari barcha maydonlar alfavit saralangan `k=v\n` ko'rinishida.
 * Spec: https://core.telegram.org/widgets/login#checking-authorization
 *
 * `fields` — widget qaytargan maydonlar (hash ALOHIDA, ichida bo'lmasin), string qiymatli.
 */
export function verifyLoginWidget(fields: Record<string, string>, botToken: string): LoginWidgetUser | null {
  const entries: string[] = []
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'hash' || value === '') continue
    entries.push(`${key}=${value}`)
  }
  entries.sort()
  const dataCheckString = entries.join('\n')

  const hash = fields['hash']
  if (!dataCheckString || !hash) return null

  const secret  = createHash('sha256').update(botToken).digest()
  const computed = createHmac('sha256', secret).update(dataCheckString).digest('hex')

  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(hash,     'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Replay protection: auth_date MAJBURIY (initData bilan bir xil siyosat).
  const authDate = Number(fields['auth_date'] ?? 0)
  const nowSec = Date.now() / 1000
  if (!Number.isFinite(authDate) || authDate <= 0) return null
  if (nowSec - authDate > MAX_AGE_SECONDS) return null       // eski (replay)
  if (authDate - nowSec > 60) return null                    // kelajakdagi vaqt

  const id = Number(fields['id'] ?? 0)
  if (!Number.isInteger(id) || id <= 0) return null
  return {
    id,
    first_name: fields['first_name'] || undefined,
    last_name:  fields['last_name']  || undefined,
    username:   fields['username']   || undefined,
    photo_url:  fields['photo_url']  || undefined,
  }
}
