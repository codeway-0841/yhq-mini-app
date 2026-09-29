import { describe, it, expect } from 'vitest'
import { issueLiveJoinToken, verifyLiveJoinToken } from '../../../server/modules/live/live.token'

const SECRET = 'kivvi-live-test-secret-32chars-minimum!!'
const OTHER = 'other-secret-32chars-minimum-00000000'

describe('live join-token (HMAC bileti)', () => {
  it('issue -> verify round-trip', () => {
    const token = issueLiveJoinToken(SECRET, {
      roomId: 3, room: 'live_3', sub: '123', role: 'student', canSpeak: false, ttlSeconds: 600,
    })
    const claims = verifyLiveJoinToken(SECRET, token, { expectedRoomId: 3, expectedRoom: 'live_3' })
    expect(claims).not.toBeNull()
    expect(claims?.sub).toBe('123')
    expect(claims?.role).toBe('student')
    expect(claims?.spk).toBe(false)
  })

  it('teacher canSpeak=true saqlanadi; eski spk siz token rad etiladi', () => {
    const token = issueLiveJoinToken(SECRET, {
      roomId: 3, room: 'live_3', sub: 't1', role: 'teacher', canSpeak: true, ttlSeconds: 600,
    })
    expect(verifyLiveJoinToken(SECRET, token)?.spk).toBe(true)
    // spk maydonisiz (eski format) token — fail-closed
    const [body, sig] = token.split('.') as [string, string]
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    delete payload.spk
    const forgedBody = Buffer.from(JSON.stringify(payload), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(verifyLiveJoinToken(SECRET, `${forgedBody}.${sig}`)).toBeNull()
  })

  it('rol soxtalashtirish (student->teacher) imzoni buzadi', () => {
    const token = issueLiveJoinToken(SECRET, {
      roomId: 3, room: 'live_3', sub: '123', role: 'student', ttlSeconds: 600,
    })
    const [body] = token.split('.')
    const payload = JSON.parse(Buffer.from(body!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    payload.role = 'teacher'
    const forgedBody = Buffer.from(JSON.stringify(payload), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const forged = `${forgedBody}.${token.split('.')[1]}`
    expect(verifyLiveJoinToken(SECRET, forged)).toBeNull()
  })

  it('boshqa secret / boshqa xona / muddat tugashi -> null', () => {
    const token = issueLiveJoinToken(SECRET, {
      roomId: 3, room: 'live_3', sub: '123', role: 'student', canSpeak: false, ttlSeconds: 600, nowMs: 1_000_000,
    })
    expect(verifyLiveJoinToken(OTHER, token)).toBeNull()
    expect(verifyLiveJoinToken(SECRET, token, { expectedRoomId: 4 })).toBeNull()
    expect(verifyLiveJoinToken(SECRET, token, { nowMs: 1_000_000 + 601_000 })).toBeNull()
  })
})
