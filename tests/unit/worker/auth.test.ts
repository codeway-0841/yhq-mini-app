/**
 * Worker token tekshiruvi (WebCrypto) — server `content-token.ts` bilan
 * BAYT-BAYT PARITET. Umumiy qat'iy test vektori ikkala tomonda ishlatiladi:
 * ikkala implementatsiya bir xil token'ni bir xil qabul/rad qilishi SHART.
 *
 * Radlar: expired → 'expired', buzilgan imzo → 'bad_signature',
 * shakl buzilgan → 'malformed'. Scope (sid/v) solishtiruvi handler'da.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { webcrypto } from 'node:crypto'

beforeAll(() => {
  // jsdom muhitida WebCrypto subtle yo'q bo'lishi mumkin — node webcrypto bilan to'ldiramiz
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

import { verifyContentToken } from '../../../workers/question-content/src/auth'
import { issueContentToken } from '../../../server/modules/content/content-token'

const SECRET = 'parity-test-secret-0123456789abcdef0123456789abcdef'

/** Server testi bilan UMUMIY vektor */
const VECTOR_CLAIMS = { sub: '123456789', sid: 'physics', v: 12, exp: 2_000_000_000, jti: 'test-jti-0001' }
const VECTOR_TOKEN =
  'v1.eyJzdWIiOiIxMjM0NTY3ODkiLCJzaWQiOiJwaHlzaWNzIiwidiI6MTIsImV4cCI6MjAwMDAwMDAwMCwianRpIjoidGVzdC1qdGktMDAwMSJ9' +
  '.n27Q3epK-Y-ToWNM6Ye-Fa6yuZht0EDGQvN7i6ugMB4'

describe('worker auth — paritet vektori (server node-crypto bilan bir xil)', () => {
  it('server chiqargan token Worker\'da ochildi', async () => {
    const res = await verifyContentToken(SECRET, VECTOR_TOKEN, 1_999_999_999)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.claims).toEqual(VECTOR_CLAIMS)
  })

  it('roundtrip: server issue → worker verify (yangi token)', async () => {
    const token = issueContentToken(SECRET, { sub: 'u42', sid: 'physics', v: 7, exp: 1_900_000_000 })
    const res = await verifyContentToken(SECRET, token, 1_800_000_000)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.claims.sub).toBe('u42')
      expect(res.claims.v).toBe(7)
    }
  })
})

describe('worker auth — rad etishlar', () => {
  it('expired → expired', async () => {
    const res = await verifyContentToken(SECRET, VECTOR_TOKEN, 2_000_000_001)
    expect(res).toEqual({ ok: false, error: 'expired' })
  })

  it('boshqa secret → bad_signature', async () => {
    const token = issueContentToken('boshqa-secret-0123456789abcdef0123456789abcdef00', VECTOR_CLAIMS)
    const res = await verifyContentToken(SECRET, token, 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'bad_signature' })
  })

  it('payload buzilgan → bad_signature yoki malformed', async () => {
    const parts = VECTOR_TOKEN.split('.')
    const tampered = `${parts[0]}.${parts[1]!.slice(0, -1)}X.${parts[2]}`
    const res = await verifyContentToken(SECRET, tampered, 1_999_999_999)
    expect(res.ok).toBe(false)
  })

  it.each([
    '',
    'abc',
    'v1.x',
    'v2.' + VECTOR_TOKEN.slice(3),
    'v1..sig',
    'v1.' + 'A'.repeat(3000) + '.sig',
  ])('malformed: %s', async (token) => {
    const res = await verifyContentToken(SECRET, token, 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'malformed' })
  })

  it('payload base64 emas — imzo tekshiruvi BIRINCHI bo\'ladi: bad_signature (server bilan paritet)', async () => {
    const res = await verifyContentToken(SECRET, 'v1.not-base64!!!.sig', 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'bad_signature' })
  })

  it('claims maydonlari buzilgan (v string) → malformed', async () => {
    const bad = { sub: 'u1', sid: 'physics', v: '12', exp: 2_000_000_000 }
    const payload = Buffer.from(JSON.stringify(bad), 'utf8').toString('base64url')
    // To'g'ri imzo — lekin shakl noto'g'ri
    const { createHmac } = await import('node:crypto')
    const mac = createHmac('sha256', SECRET).update(`v1.${payload}`).digest('base64url')
    const res = await verifyContentToken(SECRET, `v1.${payload}.${mac}`, 1_999_999_999)
    expect(res).toEqual({ ok: false, error: 'malformed' })
  })
})
