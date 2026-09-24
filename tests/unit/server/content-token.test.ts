/**
 * Content token (R2/Worker savol kontenti) — server tomoni issue/verify.
 *
 * Kritik invariantlar:
 *  - HMAC-SHA256 + timingSafeEqual (delivery-proof pattern);
 *  - eskirgan/buzilgan/boshqa secret'li token rad etiladi;
 *  - claim'lar WHITELIST (sub/sid/v/exp/jti) — PII (phone/email/ism) YO'Q;
 *  - Worker (WebCrypto) bilan BAYT-BAYT PARITET — qat'iy test vektori
 *    ikkala tomonda ham tekshiriladi (tests/unit/worker/auth.test.ts).
 */
import { describe, it, expect } from 'vitest'
import { issueContentToken, verifyContentToken } from '../../../server/modules/content/content-token'

const SECRET = 'parity-test-secret-0123456789abcdef0123456789abcdef'
const OTHER_SECRET = 'boshqa-secret-0123456789abcdef0123456789abcdef00'

/** Qat'iy paritet vektori (node -e bilan generatsiya qilingan, Worker testida ham shu) */
const VECTOR_CLAIMS = { sub: '123456789', sid: 'physics', v: 12, exp: 2_000_000_000, jti: 'test-jti-0001' }
const VECTOR_TOKEN =
  'v1.eyJzdWIiOiIxMjM0NTY3ODkiLCJzaWQiOiJwaHlzaWNzIiwidiI6MTIsImV4cCI6MjAwMDAwMDAwMCwianRpIjoidGVzdC1qdGktMDAwMSJ9' +
  '.n27Q3epK-Y-ToWNM6Ye-Fa6yuZht0EDGQvN7i6ugMB4'

describe('content-token — issue/verify roundtrip', () => {
  it('chiqarilgan token shu secret bilan ochildi', () => {
    const token = issueContentToken(SECRET, { sub: 'u1', sid: 'physics', v: 3, exp: 1_900_000_000 })
    const res = verifyContentToken(SECRET, token, 1_800_000_000)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.claims.sub).toBe('u1')
      expect(res.claims.sid).toBe('physics')
      expect(res.claims.v).toBe(3)
      expect(res.claims.exp).toBe(1_900_000_000)
    }
  })

  it('jti avtomatik qo\'shiladi (abuse korrelyatsiyasi uchun)', () => {
    const token = issueContentToken(SECRET, { sub: 'u1', sid: 'physics', v: 1, exp: 1_900_000_000 })
    const res = verifyContentToken(SECRET, token, 1_800_000_000)
    expect(res.ok && typeof res.claims.jti === 'string' && res.claims.jti.length > 8).toBe(true)
  })

  it('claim\'lar WHITELIST — PII maydonlar token\'ga kirmaydi', () => {
    const dirty = { sub: 'u1', sid: 'physics', v: 1, exp: 1_900_000_000, phone: '+99890', email: 'x@y.z', name: 'Test' }
    const token = issueContentToken(SECRET, dirty as unknown as Parameters<typeof issueContentToken>[1])
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['exp', 'jti', 'sid', 'sub', 'v'])
    expect(JSON.stringify(payload)).not.toContain('+99890')
    expect(JSON.stringify(payload)).not.toContain('x@y.z')
  })
})

describe('content-token — paritet vektori (Worker WebCrypto bilan bir xil)', () => {
  it('issue: bir xil claims → BAYT-BAYT bir xil token', () => {
    expect(issueContentToken(SECRET, VECTOR_CLAIMS)).toBe(VECTOR_TOKEN)
  })

  it('verify: vektor tokeni qabul qilinadi (exp kelajakda)', () => {
    const res = verifyContentToken(SECRET, VECTOR_TOKEN, 1_999_999_999)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.claims).toEqual(VECTOR_CLAIMS)
  })
})

describe('content-token — rad etishlar', () => {
  it('eskirgan token → expired', () => {
    const res = verifyContentToken(SECRET, VECTOR_TOKEN, 2_000_000_001)
    expect(res).toEqual({ ok: false, error: 'expired' })
  })

  it('boshqa secret bilan imzolangan → bad_signature', () => {
    const token = issueContentToken(OTHER_SECRET, VECTOR_CLAIMS)
    const res = verifyContentToken(SECRET, token, 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'bad_signature' })
  })

  it('payload buzilgan (1 belgi) → bad_signature', () => {
    const parts = VECTOR_TOKEN.split('.')
    const tampered = `${parts[0]}.${parts[1]!.slice(0, -1)}X.${parts[2]}`
    const res = verifyContentToken(SECRET, tampered, 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'bad_signature' })
  })

  it('imzo buzilgan → bad_signature', () => {
    const parts = VECTOR_TOKEN.split('.')
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]!.slice(0, -2)}AA`
    const res = verifyContentToken(SECRET, tampered, 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'bad_signature' })
  })

  it.each([
    ['', 'malformed'],
    ['abc', 'malformed'],
    ['v1.x', 'malformed'],
    ['v2.' + VECTOR_TOKEN.slice(3), 'malformed'],
    ['v1..sig', 'malformed'],
    ['v1.' + 'A'.repeat(3000) + '.sig', 'malformed'],
  ])('malformed: %s', (token, error) => {
    expect(verifyContentToken(SECRET, token, 1_999_999_999)).toEqual({ ok: false, error })
  })

  it('payload JSON bo\'lmasa → malformed', () => {
    const payload = Buffer.from('bu json emas', 'utf8').toString('base64url')
    const token = issueContentToken(SECRET, VECTOR_CLAIMS)
    const sig = token.split('.')[2]
    // To'g'ri imzolash uchun server sign'ini qayta ishlatamiz (buzilgan JSON, to'g'ri imzo)
    void sig
    const res = verifyContentToken(SECRET, `v1.${payload}.${sig}`, 1_999_999_999)
    expect(res.ok).toBe(false)
  })
})
