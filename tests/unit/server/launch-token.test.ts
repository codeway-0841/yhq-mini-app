import { describe, expect, it } from 'vitest'
import {
  LAUNCH_TOKEN_TTL_SECONDS,
  createLaunchToken,
  issueLaunchToken,
  verifyLaunchToken,
} from '../../../server/modules/test-sessions/launch-token'

const SECRET = '0123456789abcdef0123456789abcdef'
const FUTURE = Math.floor(Date.now() / 1000) + LAUNCH_TOKEN_TTL_SECONDS

function token(overrides: Partial<{ userId: string; subjectId: string; questionId: number; expiresAt: number }> = {}) {
  return createLaunchToken(SECRET, {
    userId: 'user-1',
    subjectId: 'yhq',
    questionId: 101,
    expiresAt: FUTURE,
    ...overrides,
  })
}

describe('launch token (single-question safe launch)', () => {
  it('round-trips the questionId for the same user and subject', () => {
    const verified = verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq' }, token())
    expect(verified).toEqual({ questionId: 101, expiresAt: FUTURE })
  })

  it('never leaks the questionId in plaintext', () => {
    // Deterministik expiry — epoch raqamlari tasodifan questionId'ni takrorlamasin
    const value = token({ questionId: 12345, expiresAt: 2_000_000_000 })
    expect(value).not.toContain('12345')
    expect(value.startsWith('lt1.')).toBe(true)
  })

  it('rejects a token presented by another user or subject', () => {
    const value = token()
    expect(verifyLaunchToken(SECRET, { userId: 'user-2', subjectId: 'yhq' }, value)).toBeNull()
    expect(verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'fizika' }, value)).toBeNull()
  })

  it('rejects expired, tampered, malformed and foreign-secret tokens', () => {
    const past = Math.floor(Date.now() / 1000) - 10
    expect(verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq' }, token({ expiresAt: past }))).toBeNull()

    const value = token()
    const parts = value.split('.')
    const tampered = [...parts]
    tampered[3] = `${tampered[3]!.slice(0, -2)}AA`
    expect(verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq' }, tampered.join('.'))).toBeNull()

    expect(verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq' }, 'lt1.not-a-token')).toBeNull()
    expect(verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq' }, '')).toBeNull()
    expect(verifyLaunchToken('another-secret-that-is-long-enough', { userId: 'user-1', subjectId: 'yhq' }, value)).toBeNull()
  })

  it('issues a bounded-ttl token with an ISO expiry for API payloads', () => {
    const issued = issueLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq', questionId: 42 })
    const expiresMs = Date.parse(issued.expiresAt)
    expect(expiresMs).toBeGreaterThan(Date.now())
    expect(expiresMs - Date.now()).toBeLessThanOrEqual(LAUNCH_TOKEN_TTL_SECONDS * 1000)
    expect(verifyLaunchToken(SECRET, { userId: 'user-1', subjectId: 'yhq' }, issued.launchToken)?.questionId).toBe(42)
  })
})
