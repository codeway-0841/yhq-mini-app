/**
 * Question-content TOKEN — R2/Worker orqali beriladigan savol kontentiga
 * qisqa muddatli kirish huquqi (AUDIT-NEON-EGRESS phase 2, fizika pilot).
 *
 * Model:
 *  - Vercel `POST /api/content/token` sessiyani tekshirib, 5-15 daqiqalik
 *    HMAC imzolangan token chiqaradi;
 *  - Cloudflare Worker token'ni LOKAL tekshiradi (Neon chaqirilmaydi) —
 *    imzo + exp + subject scope + versiya scope;
 *  - token'da FAQAT zarur claim'lar: userId (sub), fan segmenti (sid),
 *    kontent versiyasi (v), tugash vaqti (exp), borsa token id (jti).
 *    PII/parol/email/telefon YO'Q.
 *
 * Format (Worker WebCrypto implementatsiyasi bilan BAYT-BAYT bir xil
 * bo'lishi SHART — paritet tests/unit/worker/auth.test.ts'da qulflangan):
 *
 *   payload  = base64url(JSON.stringify(claims))
 *   token    = "v1." + payload + "." + base64url(HMAC-SHA256(secret, "v1." + payload))
 *
 * Imzo FAQAT "v1." + payload ustidan olinadi — canonical string ikkala
 * tomonda deterministik (JSON parse/stringify qayta qilinmaydi).
 *
 * `delivery-proof.ts` pattern'i (HMAC + timingSafeEqual) — JWT kutubxonasi
 * kiritilmaydi.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export interface ContentTokenClaims {
  /** userId — canonical TEXT id (TG raqam-string yoki `p_<digits>`) */
  sub: string
  /** R2 path subject segmenti (masalan 'physics') — app subjectId EMAS */
  sid: string
  /** R2'da PUBLISH qilingan kontent versiyasi (integer, manifest v<N>) */
  v: number
  /** Unix seconds — shu vaqtdan keyin token YAROQSIZ */
  exp: number
  /** Token id — abuse log'larda xom token'siz korrelyatsiya uchun */
  jti?: string
}

export type ContentTokenVerifyError = 'malformed' | 'bad_signature' | 'expired'

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function sign(secret: string, signingInput: string): string {
  return b64url(createHmac('sha256', secret).update(signingInput).digest())
}

/**
 * Yangi kontent tokeni. `jti` berilmasa avtomatik randomUUID.
 * Claims shu yerda normalize qilinadi (faqat whitelist maydonlar).
 */
export function issueContentToken(
  secret: string,
  claims: Omit<ContentTokenClaims, 'jti'> & { jti?: string },
): string {
  const clean: ContentTokenClaims = {
    sub: claims.sub,
    sid: claims.sid,
    v: claims.v,
    exp: claims.exp,
    jti: claims.jti ?? randomUUID(),
  }
  const payload = b64url(Buffer.from(JSON.stringify(clean), 'utf8'))
  const signingInput = `v1.${payload}`
  return `${signingInput}.${sign(secret, signingInput)}`
}

/**
 * Token tekshiruvi — HMAC + exp. Scope (sid/v) tekshiruvi caller'da
 * (Worker path segmentlari bilan solishtiradi). `nowSec` injektsiya —
 * deterministik testlar uchun.
 */
export function verifyContentToken(
  secret: string,
  token: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): { ok: true; claims: ContentTokenClaims } | { ok: false; error: ContentTokenVerifyError } {
  if (typeof token !== 'string' || token.length < 16 || token.length > 2048) {
    return { ok: false, error: 'malformed' }
  }
  const parts = token.split('.')
  // "v1.<payload>.<mac>" — base64url segmentlari '.' o'z ichiga olmaydi
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) {
    return { ok: false, error: 'malformed' }
  }
  const signingInput = `v1.${parts[1]}`
  const expected = sign(secret, signingInput)
  const a = Buffer.from(expected)
  const b = Buffer.from(parts[2])
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'bad_signature' }
  }
  let claims: ContentTokenClaims
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as ContentTokenClaims
  } catch {
    return { ok: false, error: 'malformed' }
  }
  if (
    typeof claims !== 'object' || claims === null
    || typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 64
    || typeof claims.sid !== 'string' || claims.sid.length === 0 || claims.sid.length > 32
    || !Number.isInteger(claims.v) || (claims.v as number) <= 0
    || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)
  ) {
    return { ok: false, error: 'malformed' }
  }
  if (claims.exp <= nowSec) {
    return { ok: false, error: 'expired' }
  }
  return { ok: true, claims }
}
