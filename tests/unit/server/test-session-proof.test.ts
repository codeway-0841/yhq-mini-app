import { describe, expect, it } from 'vitest'
import {
  createDeliveryToken,
  verifyDeliveryToken,
  type DeliveryProofClaims,
} from '../../../server/modules/test-sessions/delivery-proof'
import { testSessionInternals } from '../../../server/modules/test-sessions/test-sessions.service'

const SECRET = '0123456789abcdef0123456789abcdef'
const CLAIMS: DeliveryProofClaims = {
  userId: 'user-1',
  sessionId: '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa',
  subjectId: 'yhq',
  position: 4,
  expiresAt: '2026-09-07T12:00:00.000Z',
}

describe('test-session delivery proof', () => {
  it('accepts only the exact canonical delivery claims', () => {
    const token = createDeliveryToken(SECRET, CLAIMS)
    expect(verifyDeliveryToken(SECRET, CLAIMS, token)).toBe(true)

    for (const changed of [
      { ...CLAIMS, userId: 'user-2' },
      { ...CLAIMS, sessionId: 'd450807d-ab34-48ca-adff-e64bd0f5c490' },
      { ...CLAIMS, subjectId: 'rustili' },
      { ...CLAIMS, position: 5 },
      { ...CLAIMS, expiresAt: '2026-09-07T12:01:00.000Z' },
    ]) {
      expect(verifyDeliveryToken(SECRET, changed, token)).toBe(false)
    }
  })

  it('rejects malformed and tampered tokens without throwing', () => {
    const token = createDeliveryToken(SECRET, CLAIMS)
    expect(verifyDeliveryToken(SECRET, CLAIMS, `${token}x`)).toBe(false)
    expect(verifyDeliveryToken(SECRET, CLAIMS, 'not-a-token')).toBe(false)
  })
})

describe('bounded session selection', () => {
  it('is deterministic, bounded, and duplicate-free', () => {
    const pool = Array.from({ length: 200 }, (_, index) => index + 1)
    const first = testSessionInternals.selectQuestionIds(pool, 'seed-a', 50)
    const retry = testSessionInternals.selectQuestionIds(pool, 'seed-a', 50)
    const other = testSessionInternals.selectQuestionIds(pool, 'seed-b', 50)

    expect(first).toEqual(retry)
    expect(first).toHaveLength(50)
    expect(new Set(first).size).toBe(50)
    expect(first).not.toEqual(other)
  })
})
