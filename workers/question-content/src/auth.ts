/**
 * Kontent token tekshiruvi (WebCrypto) — server `content-token.ts` (node:crypto)
 * bilan BAYT-BAYT PARITETLI. Paritet tests/unit/worker/auth.test.ts'da umumiy
 * test vektor orqali qulflangan — ikkala implementatsiya bir xil token'ni
 * bir xil qabul/rad qilishi SHART.
 *
 * Format: "v1." + base64url(JSON claims) + "." + base64url(HMAC-SHA256(secret, "v1."+payload))
 * Tekshiruv LOKAL — Neon/HTTP chaqiruv YO'Q.
 */

export interface ContentTokenClaims {
  sub: string
  sid: string
  v: number
  exp: number
  jti?: string
}

export type ContentTokenVerifyError = 'malformed' | 'bad_signature' | 'expired'
export type VerifyResult =
  | { ok: true; claims: ContentTokenClaims }
  | { ok: false; error: ContentTokenVerifyError }

const B64URL_RE = /^[A-Za-z0-9_-]+$/

function b64urlDecode(segment: string): Uint8Array | null {
  if (!B64URL_RE.test(segment)) return null
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  try {
    const bin = atob(padded)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Constant-time solishtirish (uzunlik farqi ham tekshiriladi). */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] as number) ^ (b[i] as number)
  return diff === 0
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return new Uint8Array(mac)
}

export async function verifyContentToken(
  secret: string,
  token: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  if (typeof token !== 'string' || token.length < 16 || token.length > 2048) {
    return { ok: false, error: 'malformed' }
  }
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) {
    return { ok: false, error: 'malformed' }
  }
  const payloadB64 = parts[1]
  const receivedMac = b64urlDecode(parts[2])
  if (!receivedMac) return { ok: false, error: 'malformed' }

  const expectedMac = await hmacSha256(secret, `v1.${payloadB64}`)
  if (!timingSafeEqualBytes(expectedMac, receivedMac)) {
    return { ok: false, error: 'bad_signature' }
  }

  const payloadBytes = b64urlDecode(payloadB64)
  if (!payloadBytes) return { ok: false, error: 'malformed' }
  let claims: ContentTokenClaims
  try {
    claims = JSON.parse(new TextDecoder().decode(payloadBytes)) as ContentTokenClaims
  } catch {
    return { ok: false, error: 'malformed' }
  }
  if (
    typeof claims !== 'object' || claims === null
    || typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 64
    || typeof claims.sid !== 'string' || claims.sid.length === 0 || claims.sid.length > 32
    || !Number.isInteger(claims.v) || claims.v <= 0
    || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)
  ) {
    return { ok: false, error: 'malformed' }
  }
  if (claims.exp <= nowSec) {
    return { ok: false, error: 'expired' }
  }
  return { ok: true, claims }
}
