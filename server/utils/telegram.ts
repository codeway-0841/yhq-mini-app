/**
 * Telegram Mini App initData verification (HMAC-SHA256).
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import { createHmac, timingSafeEqual } from 'crypto'

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

  // Reject stale data (replay protection) when auth_date is present
  const authDate = Number(params.get('auth_date') ?? 0)
  if (authDate > 0 && Math.abs(Date.now() / 1000 - authDate) > MAX_AGE_SECONDS) {
    return null
  }

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
