import { describe, it, expect } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { buildLivekitToken, verifyLivekitWebhook } from '../../../server/modules/live/livekit'

const KEY = 'devkey'
const SECRET = 'livekit-test-secret-32chars-minimum!'

function decodePayload(token: string): Record<string, unknown> {
  const body = token.split('.')[1]!
  return JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>
}

describe('livekit JWT (hand-rolled AccessToken)', () => {
  it('grantlar to‘g‘ri: teacher publish, student yo‘q', () => {
    const teacher = buildLivekitToken({
      apiKey: KEY, apiSecret: SECRET, identity: 't1', room: 'live_5', canPublish: true, ttlSeconds: 600,
    })
    const student = buildLivekitToken({
      apiKey: KEY, apiSecret: SECRET, identity: 's9', room: 'live_5', canPublish: false, ttlSeconds: 600,
    })
    const tg = decodePayload(teacher).video as Record<string, unknown>
    const sg = decodePayload(student).video as Record<string, unknown>
    expect(tg).toMatchObject({ roomJoin: true, room: 'live_5', canPublish: true, canSubscribe: true })
    expect(sg.canPublish).toBe(false)
    expect(decodePayload(teacher).sub).toBe('t1')
    expect(decodePayload(teacher).iss).toBe(KEY)
  })

  it('webhook verify: to‘g‘ri imzo+hash o‘tadi, buzilgan body/secret o‘tmaydi', () => {
    const raw = JSON.stringify({ event: 'participant_joined', room: { name: 'live_5' } })
    const hash = createHash('sha256').update(raw, 'utf8').digest('hex')
    const nowSec = Math.floor(Date.now() / 1000)
    const mkJwt = (sec: string, bodyHash: string, exp: number) => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8')
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const b = Buffer.from(JSON.stringify({ iss: KEY, sha256: bodyHash, exp }), 'utf8')
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const s = createHmac('sha256', sec).update(`${h}.${b}`).digest()
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      return `${h}.${b}.${s}`
    }
    const good = mkJwt(SECRET, hash, nowSec + 300)
    expect(verifyLivekitWebhook(SECRET, raw, `Bearer ${good}`)?.event).toBe('participant_joined')
    // iss tekshiruvi: begona key imzolagan token o'tmaydi
    expect(verifyLivekitWebhook(SECRET, raw, `Bearer ${good}`, { expectedIss: 'APIother' })).toBeNull()
    expect(verifyLivekitWebhook(SECRET, raw, `Bearer ${good}`, { expectedIss: KEY })?.event).toBe('participant_joined')
    // exp'siz token — fail-closed
    const noExp = (() => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8')
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const b = Buffer.from(JSON.stringify({ iss: KEY, sha256: hash }), 'utf8')
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const s = createHmac('sha256', SECRET).update(`${h}.${b}`).digest()
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      return `${h}.${b}.${s}`
    })()
    expect(verifyLivekitWebhook(SECRET, raw, `Bearer ${noExp}`)).toBeNull()
    // noto‘g‘ri secret
    expect(verifyLivekitWebhook('wrong-secret-32chars-minimum-0000', raw, `Bearer ${good}`)).toBeNull()
    // body o‘zgargan (hash mos emas)
    expect(verifyLivekitWebhook(SECRET, `${raw} `, `Bearer ${good}`)).toBeNull()
    // muddati o‘tgan
    const expired = mkJwt(SECRET, hash, nowSec - 10)
    expect(verifyLivekitWebhook(SECRET, raw, `Bearer ${expired}`)).toBeNull()
    // auth header yo‘q
    expect(verifyLivekitWebhook(SECRET, raw, undefined)).toBeNull()
  })
})
